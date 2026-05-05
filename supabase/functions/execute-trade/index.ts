import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ccxt from "npm:ccxt@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TradeRequest {
  exchange: "binance" | "bybit" | "okx";
  symbol: string;
  entry: number;
  tp1: number;
  tp2: number;
  sl: number;
  tpSplitRatio: number;
  leverage: number;
  positionSize: number;
}

function createExchange(
  exchangeName: string,
  apiKey: string,
  secret: string,
  passphrase: string | null
): ccxt.Exchange {
  const config: any = {
    apiKey,
    secret,
    enableRateLimit: true,
    options: { defaultType: "swap" },
  };

  if (exchangeName === "okx" && passphrase) {
    config.password = passphrase;
  }

  switch (exchangeName) {
    case "binance":
      return new ccxt.binanceusdm(config);
    case "bybit":
      return new ccxt.bybit(config);
    case "okx":
      return new ccxt.okx(config);
    default:
      throw new Error(`Unsupported exchange: ${exchangeName}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const body: TradeRequest = await req.json();
    const { exchange: exchangeName, symbol, entry, tp1, tp2, sl, tpSplitRatio, leverage, positionSize } = body;

    // Validate
    if (!exchangeName || !symbol || !entry || !tp1 || !tp2 || !sl) {
      return new Response(JSON.stringify({ error: "Missing required trade parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get API keys
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from("exchange_api_keys")
      .select("api_key, api_secret, passphrase")
      .eq("exchange", exchangeName)
      .eq("user_id", userId)
      .single();

    if (apiKeyError || !apiKeyData) {
      return new Response(
        JSON.stringify({ error: `${exchangeName} API 키를 찾을 수 없습니다. 먼저 API 키를 저장해주세요.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create exchange instance
    const exchange = createExchange(exchangeName, apiKeyData.api_key, apiKeyData.api_secret, apiKeyData.passphrase);

    // Set leverage
    try {
      await exchange.setLeverage(leverage, symbol);
    } catch (e) {
      console.warn("Failed to set leverage (may already be set):", e);
    }

    const totalQuantity = positionSize / entry;
    const tp1Quantity = totalQuantity * (tpSplitRatio / 100);
    const tp2Quantity = totalQuantity * ((100 - tpSplitRatio) / 100);
    const isLong = tp1 > entry;
    const side = isLong ? "buy" : "sell";
    const closeSide = isLong ? "sell" : "buy";

    const orders = [];

    // 1. Entry limit order
    try {
      const entryOrder = await exchange.createOrder(symbol, "limit", side, totalQuantity, entry);
      orders.push({ type: "entry", ...entryOrder });
      console.log("Entry order placed:", entryOrder.id);
    } catch (e: any) {
      throw new Error(`Entry order failed: ${e.message}`);
    }

    // 2. TP1 take-profit limit (reduce only)
    try {
      const tp1Order = await exchange.createOrder(symbol, "limit", closeSide, tp1Quantity, tp1, {
        reduceOnly: true,
      });
      orders.push({ type: "tp1", ...tp1Order });
      console.log("TP1 order placed:", tp1Order.id);
    } catch (e: any) {
      console.error("TP1 order failed:", e.message);
      orders.push({ type: "tp1", error: e.message });
    }

    // 3. TP2 take-profit limit (reduce only)
    try {
      const tp2Order = await exchange.createOrder(symbol, "limit", closeSide, tp2Quantity, tp2, {
        reduceOnly: true,
      });
      orders.push({ type: "tp2", ...tp2Order });
      console.log("TP2 order placed:", tp2Order.id);
    } catch (e: any) {
      console.error("TP2 order failed:", e.message);
      orders.push({ type: "tp2", error: e.message });
    }

    // 4. SL stop-loss (reduce only)
    try {
      const slOrder = await exchange.createOrder(symbol, "stop", closeSide, totalQuantity, sl, {
        stopPrice: sl,
        reduceOnly: true,
      });
      orders.push({ type: "sl", ...slOrder });
      console.log("SL order placed:", slOrder.id);
    } catch (e: any) {
      console.error("SL order failed:", e.message);
      orders.push({ type: "sl", error: e.message });
    }

    // Log trade
    const hasErrors = orders.some((o: any) => o.error);
    await supabase.from("trade_logs").insert({
      user_id: userId,
      exchange: exchangeName,
      symbol,
      entry_price: entry,
      tp1_price: tp1,
      tp2_price: tp2,
      sl_price: sl,
      tp_split_ratio: tpSplitRatio,
      leverage,
      position_size: positionSize,
      status: hasErrors ? "partial" : "executed",
      result: { orders },
    });

    return new Response(
      JSON.stringify({ success: true, orders }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Trade execution error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
