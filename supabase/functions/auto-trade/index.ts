import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Placeholder RSI-based auto-trading logic.
 * RSI < 30 → Buy signal
 * RSI > 70 → Sell signal
 */
function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50; // neutral

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
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

    // Fetch user's auto-trade settings
    const { data: settings } = await supabase
      .from("trading_settings")
      .select("*")
      .eq("user_id", userId)
      .eq("auto_trade_enabled", true)
      .single();

    if (!settings) {
      return new Response(
        JSON.stringify({ signal: "none", message: "Auto-trade not enabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const strategyParams = (settings.strategy_params as any) || {
      rsi_period: 14,
      rsi_oversold: 30,
      rsi_overbought: 70,
    };

    // Fetch recent klines from Binance public API for RSI calculation
    const klineRes = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=${strategyParams.rsi_period + 10}`
    );
    const klines = await klineRes.json();
    const closePrices = klines.map((k: any[]) => parseFloat(k[4]));

    const rsi = calculateRSI(closePrices, strategyParams.rsi_period);

    let signal: "buy" | "sell" | "none" = "none";
    if (rsi < strategyParams.rsi_oversold) signal = "buy";
    else if (rsi > strategyParams.rsi_overbought) signal = "sell";

    // Log the signal check
    console.log(`RSI Check — RSI: ${rsi.toFixed(2)}, Signal: ${signal}`);

    return new Response(
      JSON.stringify({
        signal,
        rsi: parseFloat(rsi.toFixed(2)),
        currentPrice: closePrices[closePrices.length - 1],
        params: strategyParams,
        message:
          signal === "buy"
            ? `RSI ${rsi.toFixed(1)} < ${strategyParams.rsi_oversold} → 매수 시그널`
            : signal === "sell"
            ? `RSI ${rsi.toFixed(1)} > ${strategyParams.rsi_overbought} → 매도 시그널`
            : `RSI ${rsi.toFixed(1)} — 관망`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Auto-trade error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
