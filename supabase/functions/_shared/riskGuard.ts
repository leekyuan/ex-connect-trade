export class GuardError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = "GuardError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isGuardError(error: unknown): error is GuardError {
  return error instanceof GuardError;
}

export function guardErrorResponse(error: GuardError, headers: Record<string, string>) {
  return new Response(
    JSON.stringify({
      success: false,
      error: error.message,
      code: error.code,
      details: error.details ?? null,
    }),
    {
      status: error.status,
      headers: { ...headers, "Content-Type": "application/json" },
    },
  );
}

type SupabaseClientLike = {
  from: (table: string) => any;
};

export interface TradeRiskInput {
  exchange: string;
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

export interface GuardedTrade {
  exchange: "binance" | "bybit" | "okx";
  symbol: string;
  entry: number;
  tp1: number;
  tp2: number;
  sl: number;
  tpSplitRatio: number;
  leverage: number;
  positionSize: number;
  idempotencyKey: string;
  estimatedLossUsdt: number;
}

export interface ProxyRiskInput {
  method: string;
  endpoint: string;
  params?: Record<string, string | number | boolean>;
}

export interface GuardedProxyRequest {
  method: "GET" | "POST" | "DELETE";
  endpoint: string;
  params: Record<string, string | number | boolean>;
}

function envString(name: string, fallback = "") {
  const value = Deno.env.get(name);
  return value == null || value.trim() === "" ? fallback : value.trim();
}

function envBool(name: string, fallback = false) {
  const raw = envString(name);
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function envNumber(name: string, fallback: number) {
  const raw = envString(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function assertLiveTradingEnabled() {
  if (!envBool("LIVE_TRADING_ENABLED", false)) {
    throw new GuardError(
      "LIVE_TRADING_DISABLED",
      "Live trading is disabled on the server. Set LIVE_TRADING_ENABLED=true only after safety review.",
      403,
    );
  }
}

function assertFinitePositive(name: string, value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new GuardError("INVALID_NUMBER", `${name} must be a positive number`, 400, { [name]: value });
  }
  return n;
}

function normalizedSymbol(symbol: string) {
  return String(symbol || "").trim().toUpperCase();
}

function allowedSymbols() {
  const raw = envString("ALLOWED_TRADING_SYMBOLS", "BTCUSDT,ETHUSDT,BTC/USDT:USDT,ETH/USDT:USDT");
  return raw.split(",").map((s) => normalizedSymbol(s)).filter(Boolean);
}

function assertAllowedSymbol(symbol: string) {
  const normalized = normalizedSymbol(symbol);
  if (!/^[A-Z0-9/:_-]{5,30}$/.test(normalized)) {
    throw new GuardError("INVALID_SYMBOL", "Invalid symbol format", 400, { symbol });
  }
  if (!allowedSymbols().includes(normalized)) {
    throw new GuardError("SYMBOL_NOT_ALLOWED", "Symbol is not allowed for live trading", 403, {
      symbol: normalized,
      allowed: allowedSymbols(),
    });
  }
  return normalized;
}

function assertIdempotencyKey(value: unknown) {
  const key = String(value || "").trim();
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(key)) {
    throw new GuardError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "A valid idempotencyKey is required for live trade execution",
      400,
    );
  }
  return key;
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GuardError("INVALID_REQUEST_BODY", `${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function tradeDirection(entry: number, tp1: number) {
  if (tp1 > entry) return "long";
  if (tp1 < entry) return "short";
  throw new GuardError("INVALID_TP", "TP1 must be above or below entry to determine direction");
}

function validateTradeGeometry(input: {
  entry: number;
  tp1: number;
  tp2: number;
  sl: number;
}) {
  const direction = tradeDirection(input.entry, input.tp1);
  if (direction === "long") {
    if (input.sl >= input.entry || input.tp1 <= input.entry || input.tp2 <= input.entry) {
      throw new GuardError("INVALID_LONG_BRACKET", "Long trades require SL below entry and TPs above entry");
    }
  } else {
    if (input.sl <= input.entry || input.tp1 >= input.entry || input.tp2 >= input.entry) {
      throw new GuardError("INVALID_SHORT_BRACKET", "Short trades require SL above entry and TPs below entry");
    }
  }
  return direction;
}

async function assertNoDuplicateTrade(
  supabase: SupabaseClientLike,
  userId: string,
  idempotencyKey: string,
) {
  const { data, error } = await supabase
    .from("trade_logs")
    .select("id,status,created_at")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new GuardError("IDEMPOTENCY_CHECK_FAILED", "Could not verify duplicate-order protection", 500, {
      message: error.message,
    });
  }

  if (data) {
    throw new GuardError("DUPLICATE_TRADE_REQUEST", "Duplicate live trade request blocked", 409, data);
  }
}

async function assertDailyLossLimit(supabase: SupabaseClientLike, userId: string) {
  const maxDailyLossUsdt = envNumber("MAX_DAILY_LOSS_USDT", 300);
  if (maxDailyLossUsdt <= 0) return;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("trade_history")
    .select("pnl")
    .eq("user_id", userId)
    .gte("closed_at", since);

  if (error) {
    throw new GuardError("DAILY_LOSS_CHECK_FAILED", "Could not verify daily loss limit", 500, {
      message: error.message,
    });
  }

  const realizedLoss = (data ?? []).reduce((sum: number, row: { pnl: number | null }) => {
    const pnl = Number(row.pnl ?? 0);
    return pnl < 0 ? sum + Math.abs(pnl) : sum;
  }, 0);

  if (realizedLoss >= maxDailyLossUsdt) {
    throw new GuardError("DAILY_LOSS_LIMIT_REACHED", "Daily loss limit reached; live trading is blocked", 403, {
      realizedLoss,
      maxDailyLossUsdt,
    });
  }
}

export async function guardTradeRequest(args: {
  supabase: SupabaseClientLike;
  userId: string;
  body: TradeRiskInput;
}): Promise<GuardedTrade> {
  assertLiveTradingEnabled();
  assertRecord(args.body, "Trade request body");

  const exchange = String(args.body.exchange || "").trim().toLowerCase();
  if (!["binance", "bybit", "okx"].includes(exchange)) {
    throw new GuardError("EXCHANGE_NOT_ALLOWED", "Exchange is not allowed", 400, { exchange });
  }

  const symbol = assertAllowedSymbol(args.body.symbol);
  const entry = assertFinitePositive("entry", args.body.entry);
  const tp1 = assertFinitePositive("tp1", args.body.tp1);
  const tp2 = assertFinitePositive("tp2", args.body.tp2);
  const sl = assertFinitePositive("sl", args.body.sl);
  const positionSize = assertFinitePositive("positionSize", args.body.positionSize);
  const leverage = assertFinitePositive("leverage", args.body.leverage);
  const tpSplitRatio = assertFinitePositive("tpSplitRatio", args.body.tpSplitRatio);
  const idempotencyKey = assertIdempotencyKey(args.body.idempotencyKey);

  if (!Number.isInteger(leverage)) {
    throw new GuardError("INVALID_LEVERAGE", "Leverage must be an integer", 400, { leverage });
  }
  if (tpSplitRatio <= 0 || tpSplitRatio >= 100) {
    throw new GuardError("INVALID_TP_SPLIT", "tpSplitRatio must be greater than 0 and less than 100", 400, {
      tpSplitRatio,
    });
  }

  validateTradeGeometry({ entry, tp1, tp2, sl });

  const maxLeverage = envNumber("MAX_LIVE_LEVERAGE", 5);
  if (leverage > maxLeverage) {
    throw new GuardError("MAX_LEVERAGE_EXCEEDED", "Requested leverage exceeds server limit", 403, {
      leverage,
      maxLeverage,
    });
  }

  const maxPositionUsdt = envNumber("MAX_POSITION_USDT", 100);
  if (positionSize > maxPositionUsdt) {
    throw new GuardError("MAX_POSITION_SIZE_EXCEEDED", "Requested position size exceeds server limit", 403, {
      positionSize,
      maxPositionUsdt,
    });
  }

  const accountEquityUsdt = envNumber("ACCOUNT_EQUITY_USDT", 10000);
  const maxLossPct = envNumber("MAX_PER_TRADE_LOSS_PCT", 1);
  const maxLossByPct = accountEquityUsdt * (maxLossPct / 100);
  const explicitMaxLoss = envNumber("MAX_PER_TRADE_LOSS_USDT", maxLossByPct);
  const maxLossUsdt = Math.min(maxLossByPct, explicitMaxLoss);
  const estimatedLossUsdt = positionSize * (Math.abs(entry - sl) / entry) * leverage;

  if (estimatedLossUsdt > maxLossUsdt) {
    throw new GuardError("MAX_TRADE_LOSS_EXCEEDED", "Estimated trade loss exceeds server limit", 403, {
      estimatedLossUsdt,
      maxLossUsdt,
      accountEquityUsdt,
      maxLossPct,
    });
  }

  await assertNoDuplicateTrade(args.supabase, args.userId, idempotencyKey);
  await assertDailyLossLimit(args.supabase, args.userId);

  return {
    exchange: exchange as "binance" | "bybit" | "okx",
    symbol,
    entry,
    tp1,
    tp2,
    sl,
    tpSplitRatio,
    leverage,
    positionSize,
    idempotencyKey,
    estimatedLossUsdt,
  };
}

function assertProxyEndpoint(method: string, endpoint: string) {
  const normalizedMethod = String(method || "").toUpperCase();
  const normalizedEndpoint = String(endpoint || "").trim();

  const allowed = new Set([
    "GET /fapi/v2/balance",
    "GET /fapi/v2/positionRisk",
    "POST /fapi/v1/leverage",
    "POST /fapi/v1/order",
    "DELETE /fapi/v1/order",
  ]);

  if (!allowed.has(`${normalizedMethod} ${normalizedEndpoint}`)) {
    throw new GuardError("BINANCE_ENDPOINT_NOT_ALLOWED", "Binance Futures endpoint is not allowlisted", 403, {
      method: normalizedMethod,
      endpoint: normalizedEndpoint,
    });
  }

  return {
    method: normalizedMethod as "GET" | "POST" | "DELETE",
    endpoint: normalizedEndpoint,
  };
}

function boolParam(value: unknown) {
  if (typeof value === "boolean") return value;
  return String(value || "").toLowerCase() === "true";
}

function validateOrderParams(params: Record<string, string | number | boolean>) {
  const symbol = assertAllowedSymbol(String(params.symbol || ""));
  const side = String(params.side || "").toUpperCase();
  const type = String(params.type || "").toUpperCase();
  if (!["BUY", "SELL"].includes(side)) {
    throw new GuardError("INVALID_ORDER_SIDE", "Order side must be BUY or SELL", 400, { side });
  }
  if (!["MARKET", "STOP_MARKET", "TAKE_PROFIT_MARKET", "LIMIT"].includes(type)) {
    throw new GuardError("ORDER_TYPE_NOT_ALLOWED", "Order type is not allowed", 403, { type });
  }

  const reduceOnly = boolParam(params.reduceOnly);
  const closePosition = boolParam(params.closePosition);
  const allowUnprotectedMarketOrders = envBool("ALLOW_UNPROTECTED_MARKET_ORDERS", false);

  if (type === "MARKET" && !reduceOnly && !closePosition && !allowUnprotectedMarketOrders) {
    throw new GuardError(
      "UNPROTECTED_MARKET_ORDER_BLOCKED",
      "Opening market orders through binance-proxy are blocked by default; use a guarded bracket executor",
      403,
      { symbol, side, type },
    );
  }

  if (["STOP_MARKET", "TAKE_PROFIT_MARKET"].includes(type)) {
    assertFinitePositive("stopPrice", params.stopPrice);
    if (!reduceOnly && !closePosition) {
      throw new GuardError("PROTECTIVE_ORDER_MUST_REDUCE", "Protective orders must be reduce-only or close-position");
    }
  }

  if (type === "LIMIT" && !reduceOnly) {
    throw new GuardError("OPEN_LIMIT_PROXY_BLOCKED", "Opening limit orders through binance-proxy are blocked");
  }

  if (!closePosition) {
    assertFinitePositive("quantity", params.quantity);
  }
}

export function guardBinanceProxyRequest(input: ProxyRiskInput): GuardedProxyRequest {
  assertRecord(input, "Binance proxy request body");
  const endpoint = assertProxyEndpoint(input.method, input.endpoint);
  const params = input.params ?? {};

  if (endpoint.method !== "GET") {
    assertLiveTradingEnabled();
  }

  if (endpoint.endpoint === "/fapi/v1/leverage") {
    assertAllowedSymbol(String(params.symbol || ""));
    const leverage = assertFinitePositive("leverage", params.leverage);
    const maxLeverage = envNumber("MAX_LIVE_LEVERAGE", 5);
    if (leverage > maxLeverage) {
      throw new GuardError("MAX_LEVERAGE_EXCEEDED", "Requested leverage exceeds server limit", 403, {
        leverage,
        maxLeverage,
      });
    }
  }

  if (endpoint.endpoint === "/fapi/v1/order" && endpoint.method === "POST") {
    validateOrderParams(params);
  }

  if (endpoint.endpoint === "/fapi/v1/order" && endpoint.method === "DELETE") {
    assertAllowedSymbol(String(params.symbol || ""));
    if (!params.orderId && !params.origClientOrderId) {
      throw new GuardError("ORDER_CANCEL_ID_REQUIRED", "Cancel requests require orderId or origClientOrderId");
    }
  }

  return { ...endpoint, params };
}
