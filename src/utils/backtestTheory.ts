/**
 * Per-theory backtest comparison.
 * Runs each theory analyzer over historical candles and produces per-theory stats.
 * Lookahead-safe: signal at i uses candles[0..i], entry at candles[i+1].open.
 */

import { calcATR, type Candle } from './indicators';
import { analyzeElliott } from './theories/elliott';
import { analyzeDow } from './theories/dow';
import { analyzeWyckoff } from './theories/wyckoff';
import { analyzeGann } from './theories/gann';
import { analyzeFibonacci } from './theories/fibonacci';
import { analyzeICT } from './theories/ict';
import type { TheorySignal } from './theories/types';
import type { TheoryKey, TheoryWeights } from '@/hooks/useTheoryWeights';

export interface TheoryTrade {
  side: 'LONG' | 'SHORT';
  entry: number;
  exit: number;
  pnlPct: number;          // net of fees & slippage
  pnlR: number;            // multiple of risk
  exitReason: 'TP' | 'SL';
  confidence: number;
  theory: string;          // theory key or 'integrated'
}

export interface TheoryStats {
  theory: string;
  signals: number;
  trades: number;
  winRatePct: number;
  profitFactor: number;
  avgR: number;
  maxDrawdownPct: number;
  totalReturnPct: number;
}

export interface ConfidenceBucket {
  label: string;       // 50-60 / 60-70 …
  trades: number;
  winRatePct: number;
  avgPnlPct: number;
}

const ANALYZERS: Record<Exclude<TheoryKey, 'fundamental'>, (c: Candle[], p: number) => TheorySignal> = {
  elliott: analyzeElliott,
  dow: analyzeDow,
  wyckoff: analyzeWyckoff,
  gann: analyzeGann,
  fibonacci: analyzeFibonacci,
  ict: analyzeICT,
};

export const THEORY_KEYS_BT: (keyof typeof ANALYZERS)[] = ['elliott', 'dow', 'wyckoff', 'gann', 'fibonacci', 'ict'];

interface RunOpts {
  feePctPerSide: number;     // %
  slippagePctPerSide: number; // %
  minConfidence: number;
  rrMultiple: number;        // TP = N x risk
  weights?: TheoryWeights;   // for 'integrated'
  minConfirmIntegrated?: number;
}

function executeTrade(
  candles: Candle[],
  startIdx: number,
  side: 'LONG' | 'SHORT',
  signal: TheorySignal,
  opts: RunOpts,
): { trade: TheoryTrade; nextIdx: number } | null {
  const next = candles[startIdx + 1];
  if (!next) return null;

  const slip = opts.slippagePctPerSide / 100;
  const fee = opts.feePctPerSide / 100;

  // Entry: next-bar open, with slippage
  const rawEntry = next.open;
  const entry = side === 'LONG' ? rawEntry * (1 + slip) : rawEntry * (1 - slip);

  // SL/TP from signal (already lookahead-safe — signal computed on bar startIdx)
  const sl = signal.sl;
  const risk = Math.abs(entry - sl);
  if (risk <= 0) return null;
  const tp =
    side === 'LONG' ? entry + risk * opts.rrMultiple : entry - risk * opts.rrMultiple;

  for (let j = startIdx + 1; j < candles.length; j++) {
    const c = candles[j];
    let exit: number | null = null;
    let reason: 'TP' | 'SL' | null = null;
    if (side === 'LONG') {
      if (c.low <= sl) { exit = sl; reason = 'SL'; }
      else if (c.high >= tp) { exit = tp; reason = 'TP'; }
    } else {
      if (c.high >= sl) { exit = sl; reason = 'SL'; }
      else if (c.low <= tp) { exit = tp; reason = 'TP'; }
    }
    if (exit && reason) {
      const exitWithSlip = side === 'LONG' ? exit * (1 - slip) : exit * (1 + slip);
      const grossPnlPct = side === 'LONG'
        ? (exitWithSlip / entry - 1)
        : (entry / exitWithSlip - 1);
      const netPnlPct = (grossPnlPct - fee * 2) * 100; // entry+exit fees
      const pnlR = (Math.abs(exitWithSlip - entry) / risk) * (reason === 'TP' ? 1 : -1);
      return {
        trade: {
          side,
          entry,
          exit: exitWithSlip,
          pnlPct: Number(netPnlPct.toFixed(3)),
          pnlR: Number(pnlR.toFixed(2)),
          exitReason: reason,
          confidence: signal.confidence,
          theory: '',
        },
        nextIdx: j,
      };
    }
  }
  return null;
}

function statsFromTrades(theory: string, signalCount: number, trades: TheoryTrade[]): TheoryStats {
  if (trades.length === 0) {
    return {
      theory, signals: signalCount, trades: 0,
      winRatePct: 0, profitFactor: 0, avgR: 0, maxDrawdownPct: 0, totalReturnPct: 0,
    };
  }
  const wins = trades.filter(t => t.pnlPct > 0);
  const grossWin = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(trades.filter(t => t.pnlPct <= 0).reduce((s, t) => s + t.pnlPct, 0));
  const pf = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;
  // equity curve as cumulative pnl%
  let eq = 0, peak = 0, maxDD = 0;
  trades.forEach(t => {
    eq += t.pnlPct;
    if (eq > peak) peak = eq;
    const dd = peak - eq;
    if (dd > maxDD) maxDD = dd;
  });
  return {
    theory,
    signals: signalCount,
    trades: trades.length,
    winRatePct: Number(((wins.length / trades.length) * 100).toFixed(1)),
    profitFactor: Number(pf.toFixed(2)),
    avgR: Number((trades.reduce((s, t) => s + t.pnlR, 0) / trades.length).toFixed(2)),
    maxDrawdownPct: Number(maxDD.toFixed(2)),
    totalReturnPct: Number(eq.toFixed(2)),
  };
}

export interface TheoryBacktestResult {
  perTheory: TheoryStats[];
  integrated: TheoryStats;
  allTrades: TheoryTrade[];
  confidenceBuckets: ConfidenceBucket[];
}

export function runTheoryComparison(
  candles: Candle[],
  opts: RunOpts,
): TheoryBacktestResult {
  if (candles.length < 30) {
    return { perTheory: [], integrated: statsFromTrades('integrated', 0, []), allTrades: [], confidenceBuckets: [] };
  }
  const atr = calcATR(candles, 14);
  const allTrades: TheoryTrade[] = [];
  const perTheory: TheoryStats[] = [];

  for (const key of THEORY_KEYS_BT) {
    const fn = ANALYZERS[key];
    let cooldownUntil = 0;
    let signalCount = 0;
    const trades: TheoryTrade[] = [];

    for (let i = 25; i < candles.length - 1; i++) {
      if (i < cooldownUntil) continue;
      const slice = candles.slice(0, i + 1); // up to & including bar i (closed)
      const sig = fn(slice, candles[i].close);
      if (sig.signal === 'WATCH' || sig.confidence < opts.minConfidence) continue;
      // require valid SL distance
      const a = atr[i];
      if (!isFinite(a) || a <= 0) continue;
      signalCount += 1;
      // Use signal SL if valid; else fall back to ATR
      const fallback: TheorySignal = {
        ...sig,
        sl: sig.sl && isFinite(sig.sl) && sig.sl !== sig.entry
          ? sig.sl
          : (sig.signal === 'LONG' ? candles[i].close - a * 1.5 : candles[i].close + a * 1.5),
      };
      const result = executeTrade(candles, i, sig.signal, fallback, opts);
      if (result) {
        result.trade.theory = key;
        trades.push(result.trade);
        allTrades.push(result.trade);
        cooldownUntil = result.nextIdx + 1;
      }
    }
    perTheory.push(statsFromTrades(key, signalCount, trades));
  }

  // ── Integrated (weighted score >= threshold AND confirmCount >= minConfirm) ──
  const intTrades: TheoryTrade[] = [];
  let intCooldown = 0;
  let intSignals = 0;
  const w = opts.weights ?? { elliott: 1, dow: 1, wyckoff: 1, gann: 1, fibonacci: 1, ict: 1, fundamental: 1 };
  const minConfirm = opts.minConfirmIntegrated ?? 2;

  for (let i = 25; i < candles.length - 1; i++) {
    if (i < intCooldown) continue;
    const slice = candles.slice(0, i + 1);
    const price = candles[i].close;
    const sigs = THEORY_KEYS_BT.map(k => ({ key: k, sig: ANALYZERS[k](slice, price) }));
    let weighted = 0, total = 0;
    sigs.forEach(({ key, sig }) => {
      const wk = w[key] ?? 1;
      if (wk <= 0) return;
      const score = sig.signal === 'LONG' ? sig.confidence : sig.signal === 'SHORT' ? -sig.confidence : 0;
      weighted += score * wk;
      total += wk;
    });
    const finalScore = total > 0 ? weighted / total : 0;
    let dir: 'LONG' | 'SHORT' | null = null;
    if (finalScore >= 25) dir = 'LONG';
    else if (finalScore <= -25) dir = 'SHORT';
    if (!dir) continue;
    const confirms = sigs.filter(s => s.sig.signal === dir && s.sig.confidence >= 50 && (w[s.key] ?? 0) > 0);
    if (confirms.length < minConfirm) continue;
    const conf = Math.min(100, Math.abs(finalScore));
    if (conf < opts.minConfidence) continue;
    intSignals += 1;
    const a = atr[i];
    if (!isFinite(a) || a <= 0) continue;
    const sl = dir === 'LONG' ? price - a * 1.5 : price + a * 1.5;
    const synSig: TheorySignal = {
      signal: dir, confidence: conf, reason: 'integrated',
      entry: price, sl, tp: dir === 'LONG' ? price + a * 1.5 * opts.rrMultiple : price - a * 1.5 * opts.rrMultiple,
    };
    const result = executeTrade(candles, i, dir, synSig, opts);
    if (result) {
      result.trade.theory = 'integrated';
      result.trade.confidence = Math.round(conf);
      intTrades.push(result.trade);
      allTrades.push(result.trade);
      intCooldown = result.nextIdx + 1;
    }
  }
  const integrated = statsFromTrades('integrated', intSignals, intTrades);

  // Confidence buckets across ALL trades
  const buckets = [
    { lo: 50, hi: 60 }, { lo: 60, hi: 70 }, { lo: 70, hi: 80 }, { lo: 80, hi: 101 },
  ];
  const confidenceBuckets: ConfidenceBucket[] = buckets.map(b => {
    const ts = allTrades.filter(t => t.confidence >= b.lo && t.confidence < b.hi);
    const wins = ts.filter(t => t.pnlPct > 0).length;
    return {
      label: b.hi === 101 ? `${b.lo}%+` : `${b.lo}-${b.hi}%`,
      trades: ts.length,
      winRatePct: ts.length ? Number(((wins / ts.length) * 100).toFixed(1)) : 0,
      avgPnlPct: ts.length
        ? Number((ts.reduce((s, t) => s + t.pnlPct, 0) / ts.length).toFixed(2))
        : 0,
    };
  });

  return { perTheory, integrated, allTrades, confidenceBuckets };
}
