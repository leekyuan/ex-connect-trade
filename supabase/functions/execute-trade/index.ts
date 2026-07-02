import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ccxt from "npm:ccxt@4";
import {
  guardErrorResponse,
  guardTradeRequest,
  isGuardError,
  type GuardedTrade,
} from "../_shared/riskGuard.ts";

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
  idempotencyKey?: string;
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

function clientOrderId(idempotencyKey: string, suffix: string) {
  const compact = idempotencyKey.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 22);
  return `ce_${compact}_${suffix}`.slice(0, 36);
}

async function cancelOrderSafely(exchange: ccxt.Exchange, symbol: string, order: any) {
  if (!order?.id) return;
  try {
    await exchange.cancelOrder(order.id, symbol);
    console.warn("Cancelled order after protective-order failure:", order.id);
  } catch (error) {
    console.error("Failed to cancel order during rollback:", order.id, error);
  }
}

function riskSummary(risk: GuardedTrade) {
  return {
    idempotency_key: risk.idempotencyKey,
    max_leverage_checked: true,
    max_position_checked: true,
    max_loss_checked: true,
    daily_loss_checked: true,
    estimated_loss_usdt: Number(risk.estimatedLossUsdt.toFixed(4)),
  };
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

    const { data: claimsData, error: claimsError } = await supabase.auth.getUser();
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;
    const body: TradeRequest = await req.json();
    const risk = await guardTradeRequest({ supabase, userId, body });
    const { exchange: exchangeName, symbol, entry, tp1, tp2, sl, tpSplitRatio, leverage, positionSize } = risk;

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

    try {
      await exchange.setLeverage(leverage, symbol);
    } catch (e: any) {
      throw new Error(`Set leverage failed: ${e?.message ?? e}`);
    }

    const totalQuantity = positionSize / entry;
    const tp1Quantity = totalQuantity * (tpSplitRatio / 100);
    const tp2Quantity = totalQuantity * ((100 - tpSplitRatio) / 100);
    const isLong = tp1 > entry;
    const side = isLong ? "buy" : "sell";
    const closeSide = isLong ? "sell" : "buy";

    const orders = [];

    let entryOrder: any = null;
    let slOrder: any = null;

    try {
      entryOrder = await exchange.createOrder(symbol, "limit", side, totalQuantity, entry, {
        clientOrderId: clientOrderId(risk.idempotencyKey, "entry"),
      });
      orders.push({ type: "entry", ...entryOrder });
      console.log("Entry order placed:", entryOrder.id);
    } catch (e: any) {
      throw new Error(`Entry order failed: ${e.message}`);
    }

    // Stop-loss is mandatory. If it fails, cancel the entry order and fail closed.
    try {
      slOrder = await exchange.createOrder(symbol, "stop", closeSide, totalQuantity, sl, {
        stopPrice: sl,
        reduceOnly: true,
        clientOrderId: clientOrderId(risk.idempotencyKey, "sl"),
      });
      orders.push({ type: "sl", ...slOrder });
      console.log("SL order placed:", slOrder.id);
    } catch (e: any) {
      await cancelOrderSafely(exchange, symbol, entryOrder);
      throw new Error(`SL order failed; entry order rollback attempted: ${e.message}`);
    }

    try {
      const tp1Order = await exchange.createOrder(symbol, "limit", closeSide, tp1Quantity, tp1, {
        reduceOnly: true,
        clientOrderId: clientOrderId(risk.idempotencyKey, "tp1"),
      });
      orders.push({ type: "tp1", ...tp1Order });
      console.log("TP1 order placed:", tp1Order.id);
    } catch (e: any) {
      console.error("TP1 order failed:", e.message);
      orders.push({ type: "tp1", error: e.message });
    }

    try {
      const tp2Order = await exchange.createOrder(symbol, "limit", closeSide, tp2Quantity, tp2, {
        reduceOnly: true,
        clientOrderId: clientOrderId(risk.idempotencyKey, "tp2"),
      });
      orders.push({ type: "tp2", ...tp2Order });
      console.log("TP2 order placed:", tp2Order.id);
    } catch (e: any) {
      console.error("TP2 order failed:", e.message);
      orders.push({ type: "tp2", error: e.message });
    }

    const hasErrors = orders.some((o: any) => o.error);
    await supabase.from("trade_logs").insert({
      user_id: userId,
      idempotency_key: risk.idempotencyKey,
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
      result: { orders, risk: riskSummary(risk) },
    });

    return new Response(
      JSON.stringify({ success: true, orders }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    if (isGuardError(error)) {
      return guardErrorResponse(error, corsHeaders);
    }
    console.error("Trade execution error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
