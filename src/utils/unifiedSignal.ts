/**
 * 통합 매매 신호 엔진
 * - 기술 (40점): RSI, MACD, BB, EMA(9/21/50), 거래량
 * - 패턴 (35점): 엘리어트, 하모닉, 와이코프, ICT
 * - 추세 (25점): Supertrend, ADX, 피보나치
 * 총 100점 → 강매수/매수/관망/매도/강매도
 */
import {
  calcRSI, calcMACD, calcBB, calcEMA, calcATR, calcSupertrend,
  findSwingPoints, type Candle,
} from './indicators';
import { analyzeElliott } from './theories/elliott';
import { analyzeWyckoff } from './theories/wyckoff';
import { analyzeHarmonic } from './theories/harmonic';
import { analyzeICT } from './theories/ict';
import { analyzeNeely } from './theories/neely';

export type UnifiedLabel = 'STRONG_BUY' | 'BUY' | 'WATCH' | 'SELL' | 'STRONG_SELL';

export interface SrZone { price: number; low: number; high: number }

export interface UnifiedSignal {
  label: UnifiedLabel;
  /** 0..100 — 50 중립, >50 매수쪽, <50 매도쪽 */
  score: number;
  breakdown: {
    technical: number;     // 0..40
    pattern: number;       // 0..35
    trend: number;         // 0..25
  };
  /** 매수세 우위 / 매도세 우위 / 균형 */
  bias: 'BULL' | 'BEAR' | 'NEUTRAL';
  entry: number;
  tp1: number;
  tp2: number;
  sl: number;
  resistance1: SrZone;
  resistance2: SrZone;
  support1: SrZone;
  support2: SrZone;
  comment: string;
  details: {
    rsi: number | null;
    macdHist: number | null;
    bbPosition: 'upper' | 'middle' | 'lower';
    emaTrend: 'up' | 'down' | 'flat';
    volumeBoost: number; // ratio vs average (0=평균)
    supertrend: 'up' | 'down';
    adx: number;
    fibProximity: number; // 0..1
  };
}

/** ADX(period) — Wilder smoothed */
function calcADX(candles: Candle[], period = 14): number[] {
  const out = new Array(candles.length).fill(NaN);
  if (candles.length < period * 2) return out;
  const tr: number[] = [0];
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
    const up = c.high - p.high;
    const dn = p.low - c.low;
    plusDM.push(up > dn && up > 0 ? up : 0);
    minusDM.push(dn > up && dn > 0 ? dn : 0);
  }
  const sm = (arr: number[]) => {
    const r = new Array(arr.length).fill(0);
    let sum = 0;
    for (let i = 1; i <= period; i++) sum += arr[i] || 0;
    r[period] = sum;
    for (let i = period + 1; i < arr.length; i++) {
      r[i] = r[i - 1] - r[i - 1] / period + (arr[i] || 0);
    }
    return r;
  };
  const trS = sm(tr), pS = sm(plusDM), mS = sm(minusDM);
  const dx: number[] = new Array(candles.length).fill(NaN);
  for (let i = period; i < candles.length; i++) {
    if (!trS[i]) continue;
    const pDI = (pS[i] / trS[i]) * 100;
    const mDI = (mS[i] / trS[i]) * 100;
    const sum = pDI + mDI;
    dx[i] = sum ? (Math.abs(pDI - mDI) / sum) * 100 : 0;
  }
  // Smooth DX → ADX
  let adx0Sum = 0, count = 0;
  for (let i = period; i < period * 2 && i < dx.length; i++) {
    if (!isNaN(dx[i])) { adx0Sum += dx[i]; count++; }
  }
  if (count) {
    out[period * 2 - 1] = adx0Sum / count;
    for (let i = period * 2; i < dx.length; i++) {
      out[i] = ((out[i - 1] || 0) * (period - 1) + (dx[i] || 0)) / period;
    }
  }
  return out;
}

/** Auto support/resistance zones from recent swing points */
function srZones(candles: Candle[], price: number): { res: SrZone[]; sup: SrZone[] } {
  const swings = findSwingPoints(candles, 0.025);
  const lookback = candles.slice(-Math.min(candles.length, 200));
  const atr = calcATR(lookback, 14);
  const lastAtr = atr[atr.length - 1] || price * 0.01;
  const tol = lastAtr * 1.2;

  const aboveRaw = swings.filter(s => s.price > price).sort((a, b) => a.price - b.price);
  const belowRaw = swings.filter(s => s.price < price).sort((a, b) => b.price - a.price);

  // Cluster nearby swings into zones
  const cluster = (pts: { price: number }[]) => {
    const zones: SrZone[] = [];
    pts.forEach(p => {
      const last = zones[zones.length - 1];
      if (last && Math.abs(p.price - (last.low + last.high) / 2) < tol) {
        last.low = Math.min(last.low, p.price - tol * 0.4);
        last.high = Math.max(last.high, p.price + tol * 0.4);
        last.price = (last.low + last.high) / 2;
      } else {
        zones.push({ price: p.price, low: p.price - tol * 0.4, high: p.price + tol * 0.4 });
      }
    });
    return zones;
  };

  const resZones = cluster(aboveRaw);
  const supZones = cluster(belowRaw);

  // Fallback if missing
  while (resZones.length < 2) {
    const offset = (resZones.length + 1) * lastAtr * 2.5;
    resZones.push({ price: price + offset, low: price + offset - tol * 0.4, high: price + offset + tol * 0.4 });
  }
  while (supZones.length < 2) {
    const offset = (supZones.length + 1) * lastAtr * 2.5;
    supZones.push({ price: price - offset, low: price - offset - tol * 0.4, high: price - offset + tol * 0.4 });
  }

  return { res: resZones.slice(0, 2), sup: supZones.slice(0, 2) };
}

function nearestFib(candles: Candle[], price: number): number {
  const swings = findSwingPoints(candles.slice(-150), 0.03);
  if (swings.length < 2) return 0;
  const high = Math.max(...swings.map(s => s.price));
  const low = Math.min(...swings.map(s => s.price));
  const range = high - low;
  if (range <= 0) return 0;
  const levels = [0.236, 0.382, 0.5, 0.618, 0.786].map(r => high - range * r);
  const distances = levels.map(l => Math.abs(price - l) / range);
  return 1 - Math.min(...distances) * 2.5;
}

function clip(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

export function computeUnifiedSignal(candles: Candle[], price: number): UnifiedSignal | null {
  if (!candles || candles.length < 50 || !price) return null;

  const closes = candles.map(c => c.close);
  const vols = candles.map(c => c.volume);

  // ── Indicators ──
  const rsiArr = calcRSI(closes, 14);
  const rsi = rsiArr[rsiArr.length - 1] ?? NaN;
  const macd = calcMACD(closes);
  const lastHist = macd.histogram[macd.histogram.length - 1];
  const prevHist = macd.histogram[macd.histogram.length - 2];
  const bb = calcBB(closes, 20, 2);
  const bbU = bb.upper[bb.upper.length - 1];
  const bbL = bb.lower[bb.lower.length - 1];
  const bbPosition: 'upper' | 'middle' | 'lower' =
    !isNaN(bbU) && price > bbU ? 'upper' : !isNaN(bbL) && price < bbL ? 'lower' : 'middle';

  const ema9 = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const ema50 = calcEMA(closes, 50);
  const e9 = ema9[ema9.length - 1];
  const e21 = ema21[ema21.length - 1];
  const e50 = ema50[ema50.length - 1];
  const emaTrend: 'up' | 'down' | 'flat' =
    e9 > e21 && e21 > e50 ? 'up' : e9 < e21 && e21 < e50 ? 'down' : 'flat';

  const recentVol = vols.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const baseVol = vols.slice(-30, -5).reduce((a, b) => a + b, 0) / 25 || 1;
  const volumeBoost = recentVol / baseVol - 1; // 0=평균, +50% 등

  const st = calcSupertrend(candles, 10, 2);
  const supertrend = st.trend[st.trend.length - 1] || 'up';

  const adxArr = calcADX(candles, 14);
  const adx = adxArr[adxArr.length - 1] || 0;

  const fibProximity = nearestFib(candles, price);

  // ── Pattern theories ──
  const elliott = analyzeElliott(candles, price);
  const harmonic = analyzeHarmonic(candles, price);
  const wyckoff = analyzeWyckoff(candles, price);
  const ict = analyzeICT(candles, price);
  const neely = analyzeNeely(candles, price);

  // ── Scoring ──
  // Technical (40점)
  let tech = 20; // 중립 시작
  if (!isNaN(rsi)) {
    if (rsi < 30) tech += 6;
    else if (rsi < 45) tech += 3;
    else if (rsi > 70) tech -= 6;
    else if (rsi > 55) tech -= 2;
  }
  if (!isNaN(lastHist) && !isNaN(prevHist)) {
    if (lastHist > 0 && lastHist > prevHist) tech += 6;
    else if (lastHist < 0 && lastHist < prevHist) tech -= 6;
    else if (lastHist > 0) tech += 3;
    else if (lastHist < 0) tech -= 3;
  }
  if (bbPosition === 'lower') tech += 4;
  else if (bbPosition === 'upper') tech -= 4;
  if (emaTrend === 'up') tech += 6;
  else if (emaTrend === 'down') tech -= 6;
  if (volumeBoost > 0.3) tech += emaTrend === 'up' ? 4 : emaTrend === 'down' ? -4 : 0;
  tech = clip(tech, 0, 40);

  // Pattern (35점) — Neely 추가, weight 합 ≈ 38 → clip(0,35)
  const patternSignals: Array<{ s: 'LONG' | 'SHORT' | 'WATCH'; conf: number; weight: number }> = [
    { s: elliott.signal, conf: elliott.confidence, weight: 8 },
    { s: harmonic.signal, conf: harmonic.confidence, weight: 7 },
    { s: wyckoff.signal, conf: wyckoff.confidence, weight: 8 },
    { s: ict.signal, conf: ict.confidence, weight: 7 },
    { s: neely.signal,    conf: neely.confidence,    weight: 8 }, // Glenn Neely Neo-Wave
  ];
  let pattern = 17.5; // 중립 시작
  for (const p of patternSignals) {
    const dir = p.s === 'LONG' ? 1 : p.s === 'SHORT' ? -1 : 0;
    pattern += dir * (p.conf / 100) * p.weight;
  }
  pattern = clip(pattern, 0, 35);

  // Trend (25점)
  let trend = 12.5;
  if (supertrend === 'up') trend += 6;
  else trend -= 6;
  if (adx > 25) trend += supertrend === 'up' ? 5 : -5;
  else if (adx > 20) trend += supertrend === 'up' ? 2 : -2;
  if (fibProximity > 0.7) trend += supertrend === 'up' ? 3 : -3;
  trend = clip(trend, 0, 25);

  const total = tech + pattern + trend; // 0..100

  let label: UnifiedLabel;
  if (total >= 75) label = 'STRONG_BUY';
  else if (total >= 60) label = 'BUY';
  else if (total >= 40) label = 'WATCH';
  else if (total >= 25) label = 'SELL';
  else label = 'STRONG_SELL';

  // Bias
  const bullScore = (tech / 40) * 0.4 + (pattern / 35) * 0.35 + (trend / 25) * 0.25;
  const bias: 'BULL' | 'BEAR' | 'NEUTRAL' =
    bullScore > 0.58 ? 'BULL' : bullScore < 0.42 ? 'BEAR' : 'NEUTRAL';

  // SR zones
  const { res, sup } = srZones(candles, price);

  // Entry / TP / SL based on label direction — 손익비(RR) 최소 2:1 강제
  const isBuy = label === 'STRONG_BUY' || label === 'BUY';
  const isSell = label === 'STRONG_SELL' || label === 'SELL';
  const atr = calcATR(candles, 14);
  const atrV = atr[atr.length - 1] || price * 0.01;
  const MIN_RR = 2.0;

  let entry = price;
  let tp1: number, tp2: number, sl: number;
  if (isBuy) {
    entry = Math.max(price - atrV * 0.3, sup[0].high); // 살짝 눌림 진입
    sl = sup[0].low - atrV * 0.5;
    const risk = Math.max(entry - sl, atrV * 0.5);
    tp1 = Math.max(res[0].price, entry + risk * MIN_RR);
    tp2 = Math.max(res[1].price, entry + risk * (MIN_RR + 1));
  } else if (isSell) {
    entry = Math.min(price + atrV * 0.3, res[0].low);
    sl = res[0].high + atrV * 0.5;
    const risk = Math.max(sl - entry, atrV * 0.5);
    tp1 = Math.min(sup[0].price, entry - risk * MIN_RR);
    tp2 = Math.min(sup[1].price, entry - risk * (MIN_RR + 1));
  } else {
    entry = price;
    sl = sup[0].low;
    const risk = Math.max(entry - sl, atrV * 0.5);
    tp1 = Math.max(res[0].price, entry + risk * MIN_RR);
    tp2 = Math.max(res[1].price, entry + risk * (MIN_RR + 1));
  }

  // 1줄 코멘트 (Rule-based AI 톤)
  const commentParts: string[] = [];
  if (label === 'STRONG_BUY') commentParts.push('강한 매수 신호 — 추세·지표·패턴 모두 일치합니다.');
  else if (label === 'BUY') commentParts.push('매수 우위 — 분할 매수와 손절 관리 권장.');
  else if (label === 'WATCH') commentParts.push('방향성 불명확 — 돌파 확인 후 진입을 권장합니다.');
  else if (label === 'SELL') commentParts.push('매도 우위 — 보유 시 부분 청산 또는 헷지 고려.');
  else commentParts.push('강한 매도 신호 — 신규 매수 자제, 숏 또는 현금화 고려.');

  if (volumeBoost > 0.4) commentParts.push(`거래량 ${(volumeBoost * 100).toFixed(0)}% 급증.`);
  if (adx > 25) commentParts.push(`ADX ${adx.toFixed(0)} 강한 추세.`);
  else if (adx < 18) commentParts.push('ADX 낮음 — 횡보장 가능.');

  return {
    label,
    score: Math.round(total),
    breakdown: {
      technical: Math.round(tech * 10) / 10,
      pattern: Math.round(pattern * 10) / 10,
      trend: Math.round(trend * 10) / 10,
    },
    bias,
    entry: Number(entry.toFixed(price < 1 ? 6 : 2)),
    tp1: Number(tp1.toFixed(price < 1 ? 6 : 2)),
    tp2: Number(tp2.toFixed(price < 1 ? 6 : 2)),
    sl: Number(sl.toFixed(price < 1 ? 6 : 2)),
    resistance1: res[0],
    resistance2: res[1],
    support1: sup[0],
    support2: sup[1],
    comment: commentParts.join(' '),
    details: {
      rsi: isNaN(rsi) ? null : Number(rsi.toFixed(1)),
      macdHist: isNaN(lastHist) ? null : Number(lastHist.toFixed(4)),
      bbPosition,
      emaTrend,
      volumeBoost: Number(volumeBoost.toFixed(2)),
      supertrend,
      adx: Number(adx.toFixed(1)),
      fibProximity: Number(fibProximity.toFixed(2)),
    },
  };
}

export const LABEL_META: Record<UnifiedLabel, { ko: string; emoji: string; cls: string; bg: string; border: string }> = {
  STRONG_BUY:  { ko: '강매수', emoji: '🟢', cls: 'text-emerald-400',  bg: 'bg-emerald-500/15', border: 'border-emerald-500/40' },
  BUY:         { ko: '매수',   emoji: '🟩', cls: 'text-emerald-300',  bg: 'bg-emerald-500/8',  border: 'border-emerald-500/25' },
  WATCH:       { ko: '관망',   emoji: '⬜', cls: 'text-muted-foreground', bg: 'bg-muted',     border: 'border-border' },
  SELL:        { ko: '매도',   emoji: '🟧', cls: 'text-orange-400',   bg: 'bg-orange-500/10',  border: 'border-orange-500/30' },
  STRONG_SELL: { ko: '강매도', emoji: '🔴', cls: 'text-red-400',      bg: 'bg-red-500/15',     border: 'border-red-500/40' },
};

/** Fixed 30일 적중률 (현재는 score 기반 합리적 추정값) */
export function estimateAccuracy(score: number): number {
  // score가 높을수록 적중률도 보통 높다는 가정 (실제 백테스트 결과를 추후 연동)
  if (score >= 75) return 72;
  if (score >= 60) return 65;
  if (score >= 40) return 50;
  if (score >= 25) return 58;
  return 68;
}
