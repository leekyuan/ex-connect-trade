/**
 * Profit-First Backtester
 * --------------------------------
 * 통합 신호의 수익률 최악 문제를 해결하기 위한 새 엔진.
 *
 * 핵심 개선:
 *  1) 트레일링 스탑(ATR×N) — 큰 추세를 끝까지 따라가서 평균 수익 극대화
 *  2) 부분 익절 — TP1에서 50%, 나머지 50%는 트레일로 보유
 *  3) 추세 필터 — EMA200 위에서만 LONG, 아래에서만 SHORT
 *  4) 신호 강도별 사이징 — STRONG_BUY = 100% / BUY = 50% (Kelly-lite)
 *  5) 워크포워드 분할 분석(앞 70% IS / 뒤 30% OOS) + 몬테카를로 시뮬
 *  6) Sharpe / Sortino / Calmar / Profit Factor / MAR / Expectancy 모두 계산
 *  7) 매매 내역 CSV 내보내기
 */
import { fetchKlines } from './backtest';
import { computeUnifiedSignal, type UnifiedSignal } from './unifiedSignal';
import { calcEMA, calcATR, type Candle } from './indicators';

export type Period = '1m' | '3m' | '6m' | '1y';

export interface PFBacktestConfig {
  symbol: string;
  period: Period;
  initialCash: number;
  /** ATR × N 거리로 트레일 (기본 2.5) */
  trailAtrMult: number;
  /** TP1 도달 시 부분 청산 비율 0~1 (기본 0.5) */
  partialExitPct: number;
  /** EMA200 추세 필터 사용 여부 */
  useTrendFilter: boolean;
  /** 강신호 사이징 0..1 */
  strongSize: number;
  /** 일반 신호 사이징 0..1 */
  normalSize: number;
}

export interface PFTrade {
  entryDate: string;
  exitDate: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  pnlUsdt: number;
  signalLabel: string;
  exitReason: 'TRAIL' | 'TP1_PARTIAL' | 'SL' | 'OPP';
  holdingHours: number;
}

export interface PFMetrics {
  totalReturnPct: number;
  buyHoldReturnPct: number;
  cagr: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  profitFactor: number;
  expectancy: number;
  winRatePct: number;
  totalTrades: number;
  maxDrawdownPct: number;
  avgWinPct: number;
  avgLossPct: number;
  largestWinPct: number;
  largestLossPct: number;
  maxConsecutiveLosses: number;
}

export interface MonteCarloResult {
  median: number;
  worst5: number;
  best5: number;
  probProfit: number;
  worstDrawdown: number;
}

export interface WalkForwardSlice {
  label: string;
  totalReturnPct: number;
  buyHoldReturnPct: number;
  trades: number;
  winRatePct: number;
}

export interface PFBacktestResult {
  trades: PFTrade[];
  metrics: PFMetrics;
  equityCurve: { date: string; equity: number; bh: number }[];
  startPrice: number;
  endPrice: number;
  walkForward: WalkForwardSlice[];
  monteCarlo: MonteCarloResult;
  candles: Candle[];
}

const PERIOD_DAYS: Record<Period, number> = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 };
const FEE = 0.0004;
const SLIP = 0.0005;
const INTERVAL = '4h'; // 4H봉 — 노이즈 감소, 추세 추종 강화
const COOLDOWN_BARS = 3; // 청산 후 N봉 동안 재진입 금지 (whipsaw 방지)
const MIN_SCORE_BUY = 70;  // 신호 점수가 이 이상일 때만 LONG (STRONG_BUY ≥75, BUY ≥60 → 70으로 타이트)
const MIN_SCORE_SELL = 30; // 이 이하일 때만 SHORT

interface OpenPos {
  side: 'LONG' | 'SHORT';
  entry: number;
  initialSize: number;       // USDT committed
  remainingSize: number;     // after partial exits
  trailAnchor: number;       // best price seen since entry
  sl: number;                // dynamic SL (trail or initial)
  tp1: number;
  tp1Hit: boolean;
  entryDate: string;
  entryTime: number;
  label: string;
}

export async function runProfitFirstBacktest(
  config: PFBacktestConfig,
  onProgress: (msg: string) => void
): Promise<PFBacktestResult> {
  onProgress('과거 데이터 수집 중...');
  const days = PERIOD_DAYS[config.period];
  const WARMUP_BARS = 220; // EMA200 웜업
  const BAR_MS = 4 * 3600_000; // 4H봉
  const end = Date.now();
  const userStart = end - days * 86400_000;
  // 사용자 기간 + 웜업 봉을 미리 받음 → 1개월 백테스트도 가능
  const start = userStart - WARMUP_BARS * BAR_MS;
  const candles = await fetchKlines(config.symbol, INTERVAL, start, end);
  if (candles.length < 50) throw new Error(`데이터 부족 (수신 ${candles.length}봉). Binance에 ${config.symbol}USDT가 상장되어 있는지 확인하세요.`);

  // 사용자 시뮬 시작 인덱스 (웜업 이후)
  const simStartIdx = candles.findIndex(c => c.time >= userStart);
  const startIdx = simStartIdx > 0 ? simStartIdx : Math.min(WARMUP_BARS, candles.length - 1);

  onProgress('지표 사전계산 중...');
  const closes = candles.map(c => c.close);
  const ema200 = calcEMA(closes, 200);
  const atr = calcATR(candles, 14);

  onProgress('통합 신호 시뮬레이션 중...');

  const result = simulate(candles, ema200, atr, config, startIdx, candles.length);

  // ── Walk-forward (사용자 기간 내에서만 분할) ──
  onProgress('워크포워드 분석...');
  const userBars = candles.length - startIdx;
  const split = startIdx + Math.floor(userBars * 0.7);
  const isResult = simulate(candles, ema200, atr, config, startIdx, split);
  const oosResult = simulate(candles, ema200, atr, config, split, candles.length);
  const walkForward: WalkForwardSlice[] = [
    {
      label: 'In-Sample (70%)',
      totalReturnPct: isResult.metrics.totalReturnPct,
      buyHoldReturnPct: isResult.metrics.buyHoldReturnPct,
      trades: isResult.trades.length,
      winRatePct: isResult.metrics.winRatePct,
    },
    {
      label: 'Out-of-Sample (30%)',
      totalReturnPct: oosResult.metrics.totalReturnPct,
      buyHoldReturnPct: oosResult.metrics.buyHoldReturnPct,
      trades: oosResult.trades.length,
      winRatePct: oosResult.metrics.winRatePct,
    },
  ];

  // ── Monte-Carlo (resample trade sequence 1000x) ──
  onProgress('몬테카를로 시뮬레이션...');
  const monteCarlo = runMonteCarlo(result.trades, config.initialCash, 1000);

  return { ...result, walkForward, monteCarlo, candles };
}

// ──────────────────────────────────────────
// Single-pass simulation over [from, to)
// ──────────────────────────────────────────
function simulate(
  candles: Candle[],
  ema200: number[],
  atr: number[],
  config: PFBacktestConfig,
  from: number,
  to: number
): Omit<PFBacktestResult, 'walkForward' | 'monteCarlo' | 'candles'> {
  const trades: PFTrade[] = [];
  let cash = config.initialCash;
  let position: OpenPos | null = null;
  let lastExitIdx = -999;
  const equityCurve: { date: string; equity: number; bh: number }[] = [];

  const startIdx = Math.max(from, 200); // EMA200 웜업 보장 (caller가 이미 webwarm 처리하지만 안전)
  const endIdx = Math.min(to, candles.length - 1);
  const startPrice = candles[startIdx]?.open ?? candles[0].open;

  for (let i = startIdx; i < endIdx; i++) {
    const slice = candles.slice(0, i + 1);
    const cur = candles[i];
    const next = candles[i + 1];
    if (!next) break;
    // Only recompute signal every bar if no position OR cooldown over (cheap optim)
    const sig = computeUnifiedSignal(slice, cur.close);
    if (!sig) continue;
    const a = atr[i] || cur.close * 0.01;

    // ── Manage existing position ──
    if (position) {
      // Update trailing anchor & SL
      if (position.side === 'LONG') {
        if (cur.high > position.trailAnchor) {
          position.trailAnchor = cur.high;
          const newSl = position.trailAnchor - a * config.trailAtrMult;
          if (newSl > position.sl) position.sl = newSl;
        }
      } else {
        if (cur.low < position.trailAnchor) {
          position.trailAnchor = cur.low;
          const newSl = position.trailAnchor + a * config.trailAtrMult;
          if (newSl < position.sl) position.sl = newSl;
        }
      }

      // Check next-bar fills (pessimistic SL-first)
      let exitRaw: number | null = null;
      let reason: PFTrade['exitReason'] | null = null;
      // Opposite-signal exit only on STRONG opposite (avoid noise flips)
      const opp =
        (position.side === 'LONG' && sig.label === 'STRONG_SELL') ||
        (position.side === 'SHORT' && sig.label === 'STRONG_BUY');

      if (position.side === 'LONG') {
        if (next.low <= position.sl) { exitRaw = position.sl; reason = position.tp1Hit ? 'TRAIL' : 'SL'; }
        else if (!position.tp1Hit && next.high >= position.tp1) {
          // Partial exit at TP1
          const exit = position.tp1 * (1 - SLIP);
          const partSize = position.initialSize * config.partialExitPct;
          const pct = (exit / position.entry - 1);
          const pnl = partSize * pct - partSize * FEE * 2;
          cash += pnl;
          trades.push({
            entryDate: position.entryDate,
            exitDate: new Date(next.time).toISOString(),
            side: 'LONG',
            entryPrice: position.entry,
            exitPrice: exit,
            pnlPct: Number((pct * 100 - 0.18).toFixed(3)),
            pnlUsdt: Number(pnl.toFixed(2)),
            signalLabel: position.label + ' (TP1)',
            exitReason: 'TP1_PARTIAL',
            holdingHours: Math.round((next.time - position.entryTime) / 3_600_000),
          });
          position.remainingSize -= partSize;
          position.tp1Hit = true;
          // After TP1, move SL to break-even
          position.sl = Math.max(position.sl, position.entry);
        }
      } else {
        if (next.high >= position.sl) { exitRaw = position.sl; reason = position.tp1Hit ? 'TRAIL' : 'SL'; }
        else if (!position.tp1Hit && next.low <= position.tp1) {
          const exit = position.tp1 * (1 + SLIP);
          const partSize = position.initialSize * config.partialExitPct;
          const pct = (position.entry / exit - 1);
          const pnl = partSize * pct - partSize * FEE * 2;
          cash += pnl;
          trades.push({
            entryDate: position.entryDate,
            exitDate: new Date(next.time).toISOString(),
            side: 'SHORT',
            entryPrice: position.entry,
            exitPrice: exit,
            pnlPct: Number((pct * 100 - 0.18).toFixed(3)),
            pnlUsdt: Number(pnl.toFixed(2)),
            signalLabel: position.label + ' (TP1)',
            exitReason: 'TP1_PARTIAL',
            holdingHours: Math.round((next.time - position.entryTime) / 3_600_000),
          });
          position.remainingSize -= partSize;
          position.tp1Hit = true;
          position.sl = Math.min(position.sl, position.entry);
        }
      }

      // Opposite-signal exit (only if no SL/TP fired this bar)
      if (!exitRaw && opp) {
        exitRaw = next.open;
        reason = 'OPP';
      }

      if (exitRaw && reason) {
        const exit = position.side === 'LONG' ? exitRaw * (1 - SLIP) : exitRaw * (1 + SLIP);
        const pct = position.side === 'LONG'
          ? exit / position.entry - 1
          : position.entry / exit - 1;
        const pnl = position.remainingSize * pct - position.remainingSize * FEE * 2;
        cash += pnl;
        trades.push({
          entryDate: position.entryDate,
          exitDate: new Date(next.time).toISOString(),
          side: position.side,
          entryPrice: position.entry,
          exitPrice: exit,
          pnlPct: Number((pct * 100 - 0.18).toFixed(3)),
          pnlUsdt: Number(pnl.toFixed(2)),
          signalLabel: position.label,
          exitReason: reason,
          holdingHours: Math.round((next.time - position.entryTime) / 3_600_000),
        });
        position = null;
        lastExitIdx = i;
      }
    }

    // ── New entry ──
    if (!position) {
      // Cooldown after recent exit (avoid whipsaw re-entry)
      if (i - lastExitIdx < COOLDOWN_BARS) continue;

      // Strict score threshold — only high-conviction trades
      const goesLong  = sig.label === 'STRONG_BUY'  || (sig.label === 'BUY'  && sig.score >= MIN_SCORE_BUY);
      const goesShort = sig.label === 'STRONG_SELL' || (sig.label === 'SELL' && sig.score <= MIN_SCORE_SELL);
      if (!goesLong && !goesShort) continue;

      // Trend filter — EMA200 + slope must agree
      const e200 = ema200[i];
      const e200Prev = ema200[i - 10];
      if (config.useTrendFilter && isFinite(e200) && isFinite(e200Prev)) {
        const slopeUp = e200 > e200Prev;
        if (goesLong && (cur.close < e200 || !slopeUp)) continue;
        if (goesShort && (cur.close > e200 || slopeUp)) continue;
      }

      const side: 'LONG' | 'SHORT' = goesLong ? 'LONG' : 'SHORT';
      const sizingPct = sig.label === 'STRONG_BUY' || sig.label === 'STRONG_SELL'
        ? config.strongSize
        : config.normalSize;
      const rawEntry = next.open;
      const entry = side === 'LONG' ? rawEntry * (1 + SLIP) : rawEntry * (1 - SLIP);
      const size = cash * sizingPct;
      if (size < 10) continue;
      // Initial SL: signal SL OR ATR×1.5
      const slDist = a * 1.5;
      const sl = side === 'LONG' ? Math.min(sig.sl, entry - slDist) : Math.max(sig.sl, entry + slDist);
      // TP1 = signal tp1 OR 1.5R
      const risk = Math.abs(entry - sl);
      const tp1 = side === 'LONG' ? entry + risk * 1.5 : entry - risk * 1.5;

      position = {
        side,
        entry,
        initialSize: size,
        remainingSize: size,
        trailAnchor: side === 'LONG' ? next.open : next.open,
        sl,
        tp1,
        tp1Hit: false,
        entryDate: new Date(next.time).toISOString(),
        entryTime: next.time,
        label: sig.label,
      };
    }

    // Equity snapshot daily
    if (i % 6 === 0 || i === endIdx - 1) { // 4H봉 × 6 = 일봉 스냅샷
      let mark = cash;
      if (position) {
        const dir = position.side === 'LONG' ? 1 : -1;
        mark = cash + position.remainingSize * ((cur.close - position.entry) / position.entry) * dir;
      }
      const bh = config.initialCash * (cur.close / startPrice);
      equityCurve.push({
        date: new Date(cur.time).toISOString().slice(0, 10),
        equity: Number(mark.toFixed(2)),
        bh: Number(bh.toFixed(2)),
      });
    }
  }

  const endPrice = candles[endIdx]?.close ?? candles[candles.length - 1].close;
  const finalEquity = equityCurve.length ? equityCurve[equityCurve.length - 1].equity : cash;
  const totalReturnPct = Number(((finalEquity / config.initialCash - 1) * 100).toFixed(2));
  const buyHoldReturnPct = Number(((endPrice / startPrice - 1) * 100).toFixed(2));

  // ── Metrics ──
  const wins = trades.filter(t => t.pnlPct > 0);
  const losses = trades.filter(t => t.pnlPct <= 0);
  const grossWin = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;
  const avgWinPct = wins.length ? grossWin / wins.length : 0;
  const avgLossPct = losses.length ? grossLoss / losses.length : 0;
  const expectancy = trades.length
    ? (wins.length / trades.length) * avgWinPct - (losses.length / trades.length) * avgLossPct
    : 0;

  // DD on equity
  let peak = config.initialCash;
  let maxDD = 0;
  equityCurve.forEach(p => {
    if (p.equity > peak) peak = p.equity;
    const dd = ((peak - p.equity) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  });

  // Sharpe / Sortino on per-trade returns
  const rets = trades.map(t => t.pnlPct);
  const avgRet = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const std = rets.length > 1
    ? Math.sqrt(rets.reduce((s, r) => s + (r - avgRet) ** 2, 0) / rets.length) || 1 : 1;
  const downsideRets = rets.filter(r => r < 0);
  const downStd = downsideRets.length > 1
    ? Math.sqrt(downsideRets.reduce((s, r) => s + r * r, 0) / downsideRets.length) || 1 : 1;
  const sharpe = std > 0 ? (avgRet / std) * Math.sqrt(252) : 0;
  const sortino = downStd > 0 ? (avgRet / downStd) * Math.sqrt(252) : 0;

  // CAGR
  const yearFrac = (endIdx - startIdx) / (6 * 365); // 4H봉 기준 (하루 6봉)
  const cagr = yearFrac > 0
    ? (Math.pow(finalEquity / config.initialCash, 1 / yearFrac) - 1) * 100
    : 0;
  const calmar = maxDD > 0 ? cagr / maxDD : 0;

  // Max consecutive losses
  let mc = 0, run = 0;
  trades.forEach(t => {
    if (t.pnlPct <= 0) { run++; if (run > mc) mc = run; }
    else run = 0;
  });

  const metrics: PFMetrics = {
    totalReturnPct,
    buyHoldReturnPct,
    cagr: Number(cagr.toFixed(2)),
    sharpe: Number(sharpe.toFixed(2)),
    sortino: Number(sortino.toFixed(2)),
    calmar: Number(calmar.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
    expectancy: Number(expectancy.toFixed(3)),
    winRatePct: trades.length ? Number(((wins.length / trades.length) * 100).toFixed(1)) : 0,
    totalTrades: trades.length,
    maxDrawdownPct: Number(maxDD.toFixed(2)),
    avgWinPct: Number(avgWinPct.toFixed(2)),
    avgLossPct: Number(avgLossPct.toFixed(2)),
    largestWinPct: wins.length ? Math.max(...wins.map(t => t.pnlPct)) : 0,
    largestLossPct: losses.length ? Math.min(...losses.map(t => t.pnlPct)) : 0,
    maxConsecutiveLosses: mc,
  };

  return { trades, metrics, equityCurve, startPrice, endPrice };
}

// ──────────────────────────────────────────
// Monte Carlo: resample trades 1000x
// ──────────────────────────────────────────
function runMonteCarlo(trades: PFTrade[], initial: number, n: number): MonteCarloResult {
  if (trades.length < 5) {
    return { median: 0, worst5: 0, best5: 0, probProfit: 0, worstDrawdown: 0 };
  }
  const finals: number[] = [];
  const dds: number[] = [];
  const pcts = trades.map(t => t.pnlPct / 100);

  for (let s = 0; s < n; s++) {
    let eq = initial;
    let peak = initial;
    let maxDD = 0;
    for (let k = 0; k < pcts.length; k++) {
      const r = pcts[Math.floor(Math.random() * pcts.length)];
      // Simplified: full equity exposed each trade
      eq = eq * (1 + r * 0.5); // half exposure to mimic sizing
      if (eq > peak) peak = eq;
      const dd = ((peak - eq) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
    }
    finals.push(eq);
    dds.push(maxDD);
  }
  finals.sort((a, b) => a - b);
  dds.sort((a, b) => a - b);
  const pct = (arr: number[], q: number) => arr[Math.floor(arr.length * q)];
  const profitable = finals.filter(f => f > initial).length;
  return {
    median: Number(((pct(finals, 0.5) / initial - 1) * 100).toFixed(2)),
    worst5: Number(((pct(finals, 0.05) / initial - 1) * 100).toFixed(2)),
    best5: Number(((pct(finals, 0.95) / initial - 1) * 100).toFixed(2)),
    probProfit: Number(((profitable / n) * 100).toFixed(1)),
    worstDrawdown: Number(pct(dds, 0.95).toFixed(2)),
  };
}

// ──────────────────────────────────────────
// CSV export
// ──────────────────────────────────────────
export function pfTradesToCSV(trades: PFTrade[]): string {
  const header = ['entry_date', 'exit_date', 'side', 'entry', 'exit', 'pnl_pct', 'pnl_usdt', 'label', 'reason', 'holding_hours'];
  const rows = trades.map(t => [
    t.entryDate, t.exitDate, t.side, t.entryPrice, t.exitPrice,
    t.pnlPct, t.pnlUsdt, t.signalLabel, t.exitReason, t.holdingHours,
  ].map(v => `"${String(v ?? '')}"`).join(','));
  return [header.join(','), ...rows].join('\n');
}
