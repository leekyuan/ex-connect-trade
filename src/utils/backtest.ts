import {
  calcRSI,
  calcEMA,
  calcATR,
  calcSupertrend,
  type Candle,
} from './indicators';

export interface BacktestConfig {
  symbol: string;
  interval: string;
  mode: 'scalping' | 'daytrading' | 'swing';
  initialCash: number;
  riskPct: number;
  leverage: number;
  feePct: number;       // 매수/매도 각각 적용 (% 단위, 예: 0.04 = 0.04%)
  slippagePct: number;  // 매수/매도 각각 (% 단위)
  period: '1w' | '1m' | '3m' | '6m' | '1y';
}

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;       // 슬리피지 반영된 실체결가
  exitPrice: number;        // 슬리피지 반영된 실체결가
  pnlPct: number;           // 수수료 후 (레버리지 반영)
  pnlPctGross: number;      // 수수료 전 (레버리지 반영)
  pnlUsdt: number;          // 수수료 후
  feeUsdt: number;          // 진입+청산 수수료 합
  exitReason: 'TP' | 'SL';
  holdingMs: number;
}

export interface BacktestResult {
  totalReturnPct: number;       // 수수료 후
  totalReturnPctGross: number;  // 수수료 전
  feesPaidUsdt: number;
  sharpeRatio: number;
  maxDrawdownPct: number;
  winRatePct: number;
  totalTrades: number;
  avgTradePct: number;
  profitFactor: number;
  avgHoldingMin: number;
  maxConsecutiveLosses: number;
  equityCurve: { date: string; equity: number; returnPct: number }[];
  monthlyReturns: { month: string; returnPct: number }[];
  trades: BacktestTrade[];
  candles: Candle[]; // for theory comparison reuse
}

const RR_MAP = {
  scalping: 2.0,
  daytrading: 2.5,
  swing: 3.0,
} as const;

const INTERVAL_MAP = {
  scalping: '15m',
  daytrading: '1h',
  swing: '1d',
} as const;

// Period (in days) → required candle count by mode
const CANDLES_PER_DAY = {
  scalping: 24 * 4,   // 15m
  daytrading: 24,     // 1h
  swing: 1,           // 1d
} as const;

const PERIOD_DAYS: Record<BacktestConfig['period'], number> = {
  '1w': 7,
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

export async function fetchKlines(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<Candle[]> {
  // Binance limit per request = 1000. Page through if needed.
  const all: Candle[] = [];
  let cursor = startTime;
  while (cursor < endTime) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&startTime=${cursor}&endTime=${endTime}&limit=1000`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
    const data = (await res.json()) as any[];
    if (!data.length) break;
    const mapped: Candle[] = data.map((k) => ({
      time: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
    all.push(...mapped);
    const last = data[data.length - 1];
    cursor = last[0] + 1;
    if (data.length < 1000) break;
  }
  return all;
}

export const PERIOD_TO_DAYS: Record<BacktestConfig['period'], number> = PERIOD_DAYS;
export const MODE_TO_INTERVAL = INTERVAL_MAP;

export async function runBacktest(
  config: BacktestConfig,
  onProgress: (msg: string) => void
): Promise<BacktestResult> {
  onProgress('데이터 수집 중...');
  const interval = INTERVAL_MAP[config.mode];
  const days = PERIOD_DAYS[config.period];
  const endTime = Date.now();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;
  const candles = await fetchKlines(config.symbol, interval, startTime, endTime);
  if (candles.length < 50) throw new Error('데이터 부족 (최소 50봉 필요)');

  onProgress('지표 계산 중...');
  const closes = candles.map((c) => c.close);
  const rsi = calcRSI(closes, 14);
  const ema9 = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const atr = calcATR(candles, 14);
  const { trend: stTrend } = calcSupertrend(candles, 10, 2.0);

  onProgress('백테스트 실행 중...');

  const fee = (config.feePct ?? 0.04) / 100;       // per-side fee
  const slip = (config.slippagePct ?? 0.05) / 100; // per-side slippage
  const rr = RR_MAP[config.mode];
  console.log('[Backtest] config:', { symbol: config.symbol, mode: config.mode, period: config.period, feePctPerSide: fee * 100, slippagePctPerSide: slip * 100, leverage: config.leverage, candles: candles.length });
  const trades: BacktestTrade[] = [];
  let cash = config.initialCash;

  // ── Lookahead-bias prevention ──
  // signal at i is computed from data INCLUDING candle i (closed bar i),
  // entry happens at candle (i+1) OPEN price. We never look past i+1
  // for entry decisions; SL/TP fills happen on the high/low of i+1
  // and onwards.
  let position:
    | null
    | {
        side: 'LONG' | 'SHORT';
        entry: number;       // executed entry incl. slippage
        rawEntry: number;    // raw signal price
        sl: number;
        tp: number;
        entryTime: number;
        entryDate: string;
        entryFee: number;    // USDT
        positionUsdt: number;
      } = null;

  const toIso = (t: number) => new Date(t).toISOString();

  for (let i = 22; i < candles.length - 1; i++) {
    const c = candles[i];
    const next = candles[i + 1];

    // ── 1. Position management on next candle (i+1) ──
    if (position) {
      let exitPriceRaw: number | null = null;
      let exitReason: 'TP' | 'SL' | null = null;

      // Pessimistic: if both SL & TP touched in the same candle, assume SL hit first.
      if (position.side === 'LONG') {
        if (next.low <= position.sl) {
          exitPriceRaw = position.sl;
          exitReason = 'SL';
        } else if (next.high >= position.tp) {
          exitPriceRaw = position.tp;
          exitReason = 'TP';
        }
      } else {
        if (next.high >= position.sl) {
          exitPriceRaw = position.sl;
          exitReason = 'SL';
        } else if (next.low <= position.tp) {
          exitPriceRaw = position.tp;
          exitReason = 'TP';
        }
      }

      if (exitPriceRaw && exitReason) {
        // slippage on exit (worse direction)
        const exitPrice =
          position.side === 'LONG'
            ? exitPriceRaw * (1 - slip)
            : exitPriceRaw * (1 + slip);

        const rawPnlPct =
          position.side === 'LONG'
            ? exitPrice / position.entry - 1
            : position.entry / exitPrice - 1;

        const grossPnlUsdt =
          position.positionUsdt * rawPnlPct * config.leverage;

        const exitFee = position.positionUsdt * config.leverage * fee;
        const totalFee = position.entryFee + exitFee;

        const netPnlUsdt = grossPnlUsdt - totalFee;
        const grossPnlPct = rawPnlPct * config.leverage * 100;
        const netPnlPct =
          (netPnlUsdt / position.positionUsdt) * 100;

        cash += netPnlUsdt;
        trades.push({
          entryDate: position.entryDate,
          exitDate: toIso(next.time),
          side: position.side,
          entryPrice: position.entry,
          exitPrice,
          pnlPct: Number(netPnlPct.toFixed(3)),
          pnlPctGross: Number(grossPnlPct.toFixed(3)),
          pnlUsdt: Number(netPnlUsdt.toFixed(2)),
          feeUsdt: Number(totalFee.toFixed(2)),
          exitReason,
          holdingMs: next.time - position.entryTime,
        });
        position = null;
      }
    }

    // ── 2. Signal generation (uses ONLY data up to and including i) ──
    if (!position) {
      const atrVal = atr[i];
      if (!isFinite(atrVal) || atrVal <= 0) continue;

      let side: 'LONG' | 'SHORT' | null = null;

      if (config.mode === 'scalping') {
        if (rsi[i] < 35 && ema9[i] > ema21[i]) side = 'LONG';
        else if (rsi[i] > 65 && ema9[i] < ema21[i]) side = 'SHORT';
      } else if (config.mode === 'daytrading') {
        const crossUp = ema9[i] > ema21[i] && ema9[i - 1] <= ema21[i - 1];
        const crossDown = ema9[i] < ema21[i] && ema9[i - 1] >= ema21[i - 1];
        if (crossUp && rsi[i] >= 40 && rsi[i] <= 65) side = 'LONG';
        else if (crossDown && rsi[i] >= 35 && rsi[i] <= 60) side = 'SHORT';
      } else {
        const flipUp = stTrend[i] === 'up' && stTrend[i - 1] === 'down';
        const flipDown = stTrend[i] === 'down' && stTrend[i - 1] === 'up';
        if (flipUp) side = 'LONG';
        else if (flipDown) side = 'SHORT';
      }

      if (side) {
        // ── Entry on next candle open (lookahead-safe) ──
        const rawEntry = next.open;
        const entry =
          side === 'LONG' ? rawEntry * (1 + slip) : rawEntry * (1 - slip);

        const sl =
          side === 'LONG' ? entry - atrVal * 1.5 : entry + atrVal * 1.5;
        const tp =
          side === 'LONG'
            ? entry + atrVal * 1.5 * rr
            : entry - atrVal * 1.5 * rr;

        const positionUsdt = cash * (config.riskPct / 100);
        const entryFee = positionUsdt * config.leverage * fee;

        position = {
          side,
          entry,
          rawEntry,
          sl,
          tp,
          entryTime: next.time,
          entryDate: toIso(next.time),
          entryFee,
          positionUsdt,
        };
      }
    }
  }

  onProgress('결과 생성 중...');

  // ── Equity curve ──
  let running = config.initialCash;
  const equityCurve = trades.map((t) => {
    running += t.pnlUsdt;
    return {
      date: t.exitDate.slice(0, 10),
      equity: Number(running.toFixed(2)),
      returnPct: Number(((running / config.initialCash - 1) * 100).toFixed(2)),
    };
  });

  // ── Monthly returns ──
  const monthMap: Record<string, number> = {};
  trades.forEach((t) => {
    const m = t.exitDate.slice(0, 7);
    monthMap[m] = (monthMap[m] || 0) + t.pnlUsdt;
  });
  const monthlyReturns = Object.entries(monthMap).map(([month, pnl]) => ({
    month,
    returnPct: Number(((pnl / config.initialCash) * 100).toFixed(2)),
  }));

  const totalReturnPct = equityCurve.length
    ? equityCurve[equityCurve.length - 1].returnPct
    : 0;
  const grossPnlSum = trades.reduce(
    (s, t) => s + (t.pnlUsdt + t.feeUsdt),
    0
  );
  const totalReturnPctGross = Number(
    ((grossPnlSum / config.initialCash) * 100).toFixed(2)
  );
  const feesPaidUsdt = Number(
    trades.reduce((s, t) => s + t.feeUsdt, 0).toFixed(2)
  );

  // ── Sharpe ──
  const returns = trades.map((t) => t.pnlPct);
  const avgRet = returns.length
    ? returns.reduce((a, b) => a + b, 0) / returns.length
    : 0;
  const stdRet =
    returns.length > 1
      ? Math.sqrt(
          returns.reduce((a, b) => a + (b - avgRet) ** 2, 0) / returns.length
        ) || 1
      : 1;
  const periodsPerYear =
    config.mode === 'scalping' ? 252 * 26 : config.mode === 'daytrading' ? 252 * 6 : 252;
  const sharpe = stdRet > 0 ? (avgRet / stdRet) * Math.sqrt(periodsPerYear) : 0;

  // ── Max DD ──
  let peak = config.initialCash;
  let maxDD = 0;
  let runDD = config.initialCash;
  trades.forEach((t) => {
    runDD += t.pnlUsdt;
    if (runDD > peak) peak = runDD;
    const dd = ((peak - runDD) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  });

  // ── Profit Factor ──
  const grossWin = trades.filter((t) => t.pnlUsdt > 0).reduce((s, t) => s + t.pnlUsdt, 0);
  const grossLoss = Math.abs(
    trades.filter((t) => t.pnlUsdt < 0).reduce((s, t) => s + t.pnlUsdt, 0)
  );
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;

  // ── Avg holding ──
  const avgHoldingMs = trades.length
    ? trades.reduce((s, t) => s + t.holdingMs, 0) / trades.length
    : 0;
  const avgHoldingMin = Number((avgHoldingMs / 60000).toFixed(1));

  // ── Max consecutive losses ──
  let maxConsLoss = 0;
  let curConsLoss = 0;
  trades.forEach((t) => {
    if (t.pnlUsdt < 0) {
      curConsLoss++;
      if (curConsLoss > maxConsLoss) maxConsLoss = curConsLoss;
    } else {
      curConsLoss = 0;
    }
  });

  const wins = trades.filter((t) => t.pnlUsdt > 0);

  return {
    totalReturnPct: Number(totalReturnPct.toFixed(2)),
    totalReturnPctGross,
    feesPaidUsdt,
    sharpeRatio: Number(sharpe.toFixed(3)),
    maxDrawdownPct: Number(maxDD.toFixed(2)),
    winRatePct: trades.length
      ? Number(((wins.length / trades.length) * 100).toFixed(1))
      : 0,
    totalTrades: trades.length,
    avgTradePct: Number(avgRet.toFixed(3)),
    profitFactor: Number(profitFactor.toFixed(2)),
    avgHoldingMin,
    maxConsecutiveLosses: maxConsLoss,
    equityCurve,
    monthlyReturns,
    trades,
    candles,
  };
}

// ── CSV export ──
export function backtestTradesToCSV(trades: BacktestTrade[]): string {
  const header = [
    'entry_at',
    'exit_at',
    'side',
    'entry_price',
    'exit_price',
    'pnl_pct',
    'pnl_pct_gross',
    'pnl_usdt',
    'fee_usdt',
    'exit_reason',
    'holding_min',
  ];
  const rows = trades.map((t) =>
    [
      t.entryDate,
      t.exitDate,
      t.side,
      t.entryPrice,
      t.exitPrice,
      t.pnlPct,
      t.pnlPctGross,
      t.pnlUsdt,
      t.feeUsdt,
      t.exitReason,
      (t.holdingMs / 60000).toFixed(1),
    ]
      .map((v) => `"${String(v ?? '')}"`)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}
