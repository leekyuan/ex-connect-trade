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
import { calcEMA, calcATR, calcRSI, type Candle } from './indicators';

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
  p25: number;
  p75: number;
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

export interface MonthlyReturn {
  year: number;
  month: number; // 1-12
  returnPct: number;
}

export interface PFBacktestResult {
  trades: PFTrade[];
  metrics: PFMetrics;
  equityCurve: { date: string; equity: number; bh: number; drawdownPct: number }[];
  startPrice: number;
  endPrice: number;
  walkForward: WalkForwardSlice[];
  monteCarlo: MonteCarloResult;
  monthlyReturns: MonthlyReturn[];
  candles: Candle[];
}

const PERIOD_DAYS: Record<Period, number> = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 };
const FEE = 0.0004;
const SLIP = 0.0005;
const INTERVAL = '4h'; // 4H봉 — 노이즈 감소, 추세 추종 강화
const COOLDOWN_BARS = 6;
const MIN_SCORE_BUY = 75;
const MIN_SCORE_SELL = 25;
// v4 — RSI 밴드: 롱 40~70, 숏 30~60
const RSI_LONG_MIN = 40;
const RSI_LONG_MAX = 70;
const RSI_SHORT_MIN = 30;
const RSI_SHORT_MAX = 60;
const VOL_FILTER_MULT = 0.7;
const MAX_EXPANSION_ATR = 2.5;
// v4 — 변동성 레짐 필터: ATR(14) ≥ ATR50평균 × 1.0 (횡보장 차단)
const ATR_REGIME_MULT = 1.0;
// v4 — SL/TP/Trail
const SL_ATR_MULT = 1.5;
const TP_ATR_MULT = 3.0;            // RR 1:2 확보
const TRAIL_ACTIVATE_ATR = 2.0;     // +ATR×2 수익시 트레일 발동
// v4 — Kelly 사이징
const KELLY_CAP = 0.10;             // 최대 자본의 10%
const KELLY_MIN = 0.02;             // 최소 2%
const LOSS_STREAK_REDUCE_AT = 3;    // 연속 3패 시 사이즈 50% 축소

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
  const vols = candles.map(c => c.volume);
  const ema200 = calcEMA(closes, 200);
  const ema20 = calcEMA(closes, 20);
  const atr = calcATR(candles, 14);
  const rsi = calcRSI(closes, 14);
  const volSma = calcEMA(vols, 20);
  // v4 — ATR 평균(50봉)으로 변동성 레짐 측정
  const atrSma = calcEMA(atr, 50);

  onProgress('통합 신호 시뮬레이션 중...');
  const result = simulate(candles, ema200, ema20, atr, atrSma, rsi, volSma, config, startIdx, candles.length);

  onProgress('워크포워드 분석...');
  const userBars = candles.length - startIdx;
  const split = startIdx + Math.floor(userBars * 0.7);
  const isResult = simulate(candles, ema200, ema20, atr, atrSma, rsi, volSma, config, startIdx, split);
  const oosResult = simulate(candles, ema200, ema20, atr, atrSma, rsi, volSma, config, split, candles.length);
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

  onProgress('몬테카를로 시뮬레이션...');
  const monteCarlo = runMonteCarlo(result.trades, config.initialCash, 1000);

  const monthlyReturns = computeMonthlyReturns(result.equityCurve);

  return { ...result, walkForward, monteCarlo, monthlyReturns, candles };
}

// ──────────────────────────────────────────
// Single-pass simulation over [from, to)
// ──────────────────────────────────────────
function simulate(
  candles: Candle[],
  ema200: number[],
  ema20: number[],
  atr: number[],
  atrSma: number[],
  rsi: number[],
  volSma: number[],
  config: PFBacktestConfig,
  from: number,
  to: number
): Omit<PFBacktestResult, 'walkForward' | 'monteCarlo' | 'monthlyReturns' | 'candles'> {
  const trades: PFTrade[] = [];
  let cash = config.initialCash;
  let position: OpenPos | null = null;
  let lastExitIdx = -999;
  let lossStreak = 0;
  const equityCurve: { date: string; equity: number; bh: number; drawdownPct: number }[] = [];
  let runningPeak = config.initialCash;

  const startIdx = Math.max(from, 200);
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
      // 트레일링: 진입 후 +ATR×TRAIL_ACTIVATE_ATR 도달했을 때만 발동
      const profitDist = position.side === 'LONG'
        ? cur.high - position.entry
        : position.entry - cur.low;
      const trailActive = profitDist >= a * TRAIL_ACTIVATE_ATR;
      if (trailActive) {
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
        const pnlPct = Number((pct * 100 - 0.18).toFixed(3));
        trades.push({
          entryDate: position.entryDate,
          exitDate: new Date(next.time).toISOString(),
          side: position.side,
          entryPrice: position.entry,
          exitPrice: exit,
          pnlPct,
          pnlUsdt: Number(pnl.toFixed(2)),
          signalLabel: position.label,
          exitReason: reason,
          holdingHours: Math.round((next.time - position.entryTime) / 3_600_000),
        });
        if (pnlPct <= 0) lossStreak++; else lossStreak = 0;
        position = null;
        lastExitIdx = i;
      }
    }

    // ── New entry ──
    if (!position) {
      if (i - lastExitIdx < COOLDOWN_BARS) continue;

      const goesLong  = sig.label === 'STRONG_BUY'  || (sig.label === 'BUY'  && sig.score >= MIN_SCORE_BUY);
      const goesShort = sig.label === 'STRONG_SELL' || (sig.label === 'SELL' && sig.score <= MIN_SCORE_SELL);
      if (!goesLong && !goesShort) continue;

      // EMA200 추세 필터 + slope
      const e200 = ema200[i];
      const e200Prev = ema200[i - 10];
      if (config.useTrendFilter && isFinite(e200) && isFinite(e200Prev)) {
        const slopeUp = e200 > e200Prev;
        if (goesLong && (cur.close < e200 || !slopeUp)) continue;
        if (goesShort && (cur.close > e200 || slopeUp)) continue;
      }

      // v4 — RSI 밴드 필터: 롱 40~70, 숏 30~60
      const r = rsi[i];
      if (isFinite(r)) {
        if (goesLong && (r < RSI_LONG_MIN || r > RSI_LONG_MAX)) continue;
        if (goesShort && (r < RSI_SHORT_MIN || r > RSI_SHORT_MAX)) continue;
      }

      // v4 — ATR 변동성 레짐 필터 (횡보장 차단)
      const aSma = atrSma[i];
      if (isFinite(aSma) && aSma > 0 && a < aSma * ATR_REGIME_MULT) continue;

      // 거래량 빈약 차단
      const vs = volSma[i];
      if (isFinite(vs) && vs > 0 && cur.volume < vs * VOL_FILTER_MULT) continue;

      // FOMO (EMA20 거리 차단)
      const e20 = ema20[i];
      if (isFinite(e20) && a > 0) {
        const dist = Math.abs(cur.close - e20) / a;
        if (dist > MAX_EXPANSION_ATR) continue;
      }

      // 신호 2봉 지속
      const prevSig = computeUnifiedSignal(candles.slice(0, i), candles[i - 1].close);
      if (prevSig) {
        if (goesLong && !(prevSig.label === 'BUY' || prevSig.label === 'STRONG_BUY')) continue;
        if (goesShort && !(prevSig.label === 'SELL' || prevSig.label === 'STRONG_SELL')) continue;
      }

      const side: 'LONG' | 'SHORT' = goesLong ? 'LONG' : 'SHORT';

      // v4 — SL = ATR×1.5, TP = ATR×3.0
      const rawEntry = next.open;
      const entry = side === 'LONG' ? rawEntry * (1 + SLIP) : rawEntry * (1 - SLIP);
      const slDist = a * SL_ATR_MULT;
      const tpDist = a * TP_ATR_MULT;
      const sl = side === 'LONG' ? entry - slDist : entry + slDist;
      const tp1 = side === 'LONG' ? entry + tpDist : entry - tpDist;

      // v4 — Kelly 사이징 (롤링 통계 기반, 10% 상한)
      const kellyPct = computeKellyPct(trades);
      let sizingPct = Math.min(KELLY_CAP, Math.max(KELLY_MIN, kellyPct));
      // 강신호 보너스 (Kelly 위에 +30%, 단 상한 유지)
      if (sig.label === 'STRONG_BUY' || sig.label === 'STRONG_SELL') {
        sizingPct = Math.min(KELLY_CAP, sizingPct * 1.3);
      }
      // 연속 3패 이상이면 사이즈 50% 축소
      if (lossStreak >= LOSS_STREAK_REDUCE_AT) sizingPct *= 0.5;

      const size = cash * sizingPct;
      if (size < 10) continue;

      position = {
        side,
        entry,
        initialSize: size,
        remainingSize: size,
        trailAnchor: next.open,
        sl,
        tp1,
        tp1Hit: false,
        entryDate: new Date(next.time).toISOString(),
        entryTime: next.time,
        label: sig.label,
      };
    }

    // Equity snapshot (일봉)
    if (i % 6 === 0 || i === endIdx - 1) {
      let mark = cash;
      if (position) {
        const dir = position.side === 'LONG' ? 1 : -1;
        mark = cash + position.remainingSize * ((cur.close - position.entry) / position.entry) * dir;
      }
      if (mark > runningPeak) runningPeak = mark;
      const dd = ((runningPeak - mark) / runningPeak) * 100;
      const bh = config.initialCash * (cur.close / startPrice);
      equityCurve.push({
        date: new Date(cur.time).toISOString().slice(0, 10),
        equity: Number(mark.toFixed(2)),
        bh: Number(bh.toFixed(2)),
        drawdownPct: Number(dd.toFixed(2)),
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
