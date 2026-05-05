import { useMemo } from 'react';
import type { TradingMode } from './useMarketAnalysis';
import type { Candle } from '@/utils/indicators';
import type { TheorySignal } from '@/utils/theories/types';
import { calcRSI, calcMACD, calcBB, calcSupertrend } from '@/utils/indicators';
import { analyzeElliott } from '@/utils/theories/elliott';
import { analyzeWyckoff } from '@/utils/theories/wyckoff';
import { analyzeFibonacci } from '@/utils/theories/fibonacci';
import { analyzeDow } from '@/utils/theories/dow';
import { analyzeGann } from '@/utils/theories/gann';
import { analyzeICT } from '@/utils/theories/ict';
import { analyzeFundamental, type FundamentalData } from '@/utils/theories/fundamental';
import { THEORY_KEYS, type TheoryKey, type TheoryWeights, getStoredWeights } from './useTheoryWeights';

export interface TheoryAnalysis {
  key: TheoryKey;
  name: string;
  signal: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
  /** -100 (strong SHORT) … +100 (strong LONG) */
  score: number;
  description: string;
  details: string[];
  entry?: number;
  sl?: number;
  tp?: number;
}

export interface IntegratedSignal {
  signal: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
  /** weighted -100 … +100 */
  score: number;
  /** how many theories confirmed (signal === final dir AND confidence ≥ 50) */
  confirmCount: number;
  contributingTheories: string[];
  entry: number | null;
  sl: number | null;
  tp1: number | null;
  tp2: number | null;
  riskReward: number;
}

export interface AdvancedAnalysisResult {
  theories: TheoryAnalysis[];
  consensus: 'LONG' | 'SHORT' | 'NEUTRAL';
  consensusScore: number;
  integrated: IntegratedSignal;
  indicators: {
    rsi: number | null;
    macdSignal: 'bullish' | 'bearish' | 'neutral';
    bbPosition: 'upper' | 'middle' | 'lower';
    supertrend: 'up' | 'down';
  };
}

const NAME: Record<TheoryKey, string> = {
  elliott: '엘리어트 파동',
  dow: '다우 이론',
  wyckoff: '와이코프',
  gann: '갠 이론',
  fibonacci: '피보나치',
  ict: 'ICT (스마트머니)',
  fundamental: '기본적 분석',
};

function mapTheory(key: TheoryKey, result: TheorySignal): TheoryAnalysis {
  const sig = result.signal === 'WATCH' ? 'NEUTRAL' : result.signal;
  // score: signed by direction, magnitude by confidence (0-100)
  const score = sig === 'LONG' ? result.confidence : sig === 'SHORT' ? -result.confidence : 0;
  return {
    key,
    name: NAME[key],
    signal: sig,
    confidence: result.confidence,
    score,
    description: result.reason,
    details: [result.reason],
    entry: result.entry,
    sl: result.sl,
    tp: result.tp,
  };
}

function emptyIntegrated(price: number | null): IntegratedSignal {
  return {
    signal: 'NEUTRAL', confidence: 0, score: 0, confirmCount: 0,
    contributingTheories: [],
    entry: price, sl: null, tp1: null, tp2: null, riskReward: 0,
  };
}

function analyzeWithCandles(
  candles: Candle[],
  price: number,
  weights: TheoryWeights,
  fundamental: FundamentalData | null,
  priceChange24h: number,
  minConfirm: number,
): AdvancedAnalysisResult {
  const closes = candles.map(c => c.close);

  const rsiArr = calcRSI(closes, 14);
  const rsi = rsiArr[rsiArr.length - 1];
  const macd = calcMACD(closes);
  const lastMACD = macd.histogram[macd.histogram.length - 1];
  const prevMACD = macd.histogram[macd.histogram.length - 2];
  const macdSignal: 'bullish' | 'bearish' | 'neutral' =
    !isNaN(lastMACD) && !isNaN(prevMACD)
      ? (lastMACD > 0 && lastMACD > prevMACD ? 'bullish' :
         lastMACD < 0 && lastMACD < prevMACD ? 'bearish' : 'neutral')
      : 'neutral';

  const bb = calcBB(closes);
  const lastBBU = bb.upper[bb.upper.length - 1];
  const lastBBL = bb.lower[bb.lower.length - 1];
  const bbPosition: 'upper' | 'middle' | 'lower' =
    !isNaN(lastBBU) ? (price > lastBBU ? 'upper' : price < lastBBL ? 'lower' : 'middle') : 'middle';

  const st = calcSupertrend(candles);
  const supertrend = st.trend[st.trend.length - 1] || 'up';

  const theories: TheoryAnalysis[] = [
    mapTheory('elliott', analyzeElliott(candles, price)),
    mapTheory('dow', analyzeDow(candles, price)),
    mapTheory('wyckoff', analyzeWyckoff(candles, price)),
    mapTheory('gann', analyzeGann(candles, price)),
    mapTheory('fibonacci', analyzeFibonacci(candles, price)),
    mapTheory('ict', analyzeICT(candles, price)),
    mapTheory('fundamental', analyzeFundamental(fundamental, price, priceChange24h)),
  ];

  // Append shared indicator context (skip for fundamental since it's price-independent)
  theories.forEach(t => {
    if (t.key === 'fundamental') return;
    if (!isNaN(rsi)) t.details.push(`RSI(14): ${rsi.toFixed(1)}`);
    if (macdSignal !== 'neutral') t.details.push(`MACD: ${macdSignal === 'bullish' ? '상승' : '하락'} 시그널`);
    t.details.push(`Supertrend: ${supertrend === 'up' ? '상승' : '하락'}`);
    t.details.push(`BB 위치: ${bbPosition === 'upper' ? '상단밴드' : bbPosition === 'lower' ? '하단밴드' : '중간'}`);
  });

  // ── Weighted integrated score ──
  let weightedScore = 0;
  let totalWeight = 0;
  for (const t of theories) {
    const w = weights[t.key] ?? 1;
    if (w <= 0) continue;
    weightedScore += t.score * w;
    totalWeight += w;
  }
  const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

  // Direction
  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (finalScore >= 25) direction = 'LONG';
  else if (finalScore <= -25) direction = 'SHORT';

  // Confirmations: theories aligned with direction with conf ≥ 50 AND weight > 0
  const confirming = theories.filter(t =>
    direction !== 'NEUTRAL' &&
    t.signal === direction &&
    t.confidence >= 50 &&
    (weights[t.key] ?? 0) > 0
  );

  // Apply min confirmation rule
  const finalDirection: 'LONG' | 'SHORT' | 'NEUTRAL' =
    direction !== 'NEUTRAL' && confirming.length >= minConfirm ? direction : 'NEUTRAL';

  // Aggregate Entry/SL/TP from confirming theories with usable values
  let entry: number | null = price;
  let sl: number | null = null;
  let tp1: number | null = null;
  let tp2: number | null = null;
  let riskReward = 0;

  if (finalDirection !== 'NEUTRAL') {
    const usable = confirming.filter(t =>
      t.entry && t.sl && t.tp &&
      isFinite(t.entry) && isFinite(t.sl!) && isFinite(t.tp!) &&
      ((finalDirection === 'LONG' && t.sl! < t.entry! && t.tp! > t.entry!) ||
       (finalDirection === 'SHORT' && t.sl! > t.entry! && t.tp! < t.entry!))
    );

    if (usable.length > 0) {
      const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      sl = avg(usable.map(t => t.sl!));
      const tpAvg = avg(usable.map(t => t.tp!));
      const risk = Math.abs(price - sl);
      if (risk > 0) {
        // TP1 = average TP, TP2 = 2x risk from entry in trade direction
        tp1 = tpAvg;
        tp2 = finalDirection === 'LONG' ? price + risk * 2.5 : price - risk * 2.5;
        riskReward = Math.abs(tp1 - price) / risk;
      }
    }
  }

  const integrated: IntegratedSignal = {
    signal: finalDirection,
    confidence: Math.round(Math.min(100, Math.abs(finalScore))),
    score: Math.round(finalScore),
    confirmCount: confirming.length,
    contributingTheories: confirming.map(t => t.name),
    entry,
    sl,
    tp1,
    tp2,
    riskReward: Number(riskReward.toFixed(2)),
  };

  // Legacy consensus fields (kept for backward compat)
  return {
    theories,
    consensus: integrated.signal,
    consensusScore: integrated.confidence,
    integrated,
    indicators: { rsi: isNaN(rsi) ? null : rsi, macdSignal, bbPosition, supertrend },
  };
}

function analyzeFallback(price: number | null): AdvancedAnalysisResult {
  return {
    theories: [],
    consensus: 'NEUTRAL',
    consensusScore: 0,
    integrated: emptyIntegrated(price),
    indicators: { rsi: null, macdSignal: 'neutral', bbPosition: 'middle', supertrend: 'up' },
  };
}

export interface UseAdvancedOptions {
  weights?: TheoryWeights;
  fundamental?: FundamentalData | null;
  priceChange24h?: number;
  minConfirm?: number;
}

export function useAdvancedAnalysis(
  candles: Candle[] | null,
  price: number | null,
  _mode: TradingMode,
  opts: UseAdvancedOptions = {}
): AdvancedAnalysisResult | null {
  const { fundamental = null, priceChange24h = 0, minConfirm = 2 } = opts;
  // weights are read fresh from localStorage if not passed (keeps memo stable)
  const weightsKey = JSON.stringify(opts.weights ?? null);
  return useMemo(() => {
    if (!candles || candles.length < 20 || !price) return analyzeFallback(price);
    const w = opts.weights ?? getStoredWeights();
    return analyzeWithCandles(candles, price, w, fundamental, priceChange24h, minConfirm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, price, _mode, weightsKey, fundamental, priceChange24h, minConfirm]);
}

export { THEORY_KEYS };
export type { TheoryKey, TheoryWeights };
