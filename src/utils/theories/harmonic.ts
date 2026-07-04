import type { Candle } from '../indicators';
import { findSwingPoints, calcATR, type SwingPoint } from '../indicators';
import type { TheorySignal } from './types';

/**
 * Harmonic Patterns — XABCD 비율로 Gartley/Bat/Butterfly/Crab/Cypher/Shark/AB=CD 감지
 *
 * 출력 확장: detected — 차트/패널이 사용할 수 있는 구조 정보
 */

export interface HarmonicPoint extends SwingPoint {
  label: 'X' | 'A' | 'B' | 'C' | 'D';
}

export interface HarmonicPattern {
  name: string;            // 한국어 패턴명
  bias: 'bullish' | 'bearish';
  points: HarmonicPoint[]; // 5점 (X,A,B,C,D)
  ratios: { xab: number; abc: number; bcd: number; xad: number };
  /** PRZ (Potential Reversal Zone) 가격 범위 */
  prz: { low: number; high: number };
  /** 추천 진입/SL/TP */
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  /** 신뢰도 0-100 (비율 정확도) */
  quality: number;
  description: string;
}

export interface HarmonicTheorySignal extends TheorySignal {
  detected: HarmonicPattern | null;
}

interface PatternSpec {
  name: string;
  xab: [number, number];
  abc: [number, number];
  bcd: [number, number];
  xad: [number, number];
}

const SPECS: PatternSpec[] = [
  { name: '가틀리(Gartley)',     xab: [0.55, 0.72], abc: [0.38, 0.886], bcd: [1.13, 1.618], xad: [0.72, 0.85] },
  { name: '배트(Bat)',           xab: [0.32, 0.55], abc: [0.38, 0.886], bcd: [1.618, 2.618], xad: [0.82, 0.92] },
  { name: '버터플라이(Butterfly)', xab: [0.72, 0.85], abc: [0.38, 0.886], bcd: [1.618, 2.618], xad: [1.20, 1.41] },
  { name: '크랩(Crab)',          xab: [0.32, 0.65], abc: [0.38, 0.886], bcd: [2.24, 3.618],  xad: [1.55, 1.80] },
  { name: '딥크랩(Deep Crab)',   xab: [0.85, 0.95], abc: [0.38, 0.886], bcd: [2.0, 3.618],   xad: [1.55, 1.80] },
  { name: '사이퍼(Cypher)',      xab: [0.38, 0.618], abc: [1.13, 1.414], bcd: [1.27, 2.0],   xad: [0.72, 0.82] },
  { name: '샤크(Shark)',         xab: [0.30, 0.95], abc: [1.13, 1.618], bcd: [1.618, 2.24], xad: [0.886, 1.13] },
];

function match(spec: PatternSpec, r: { xab: number; abc: number; bcd: number; xad: number }): number {
  /** 0~1 점수: 모든 비율이 범위에 들수록 1, 벗어날수록 감점 */
  const inRange = (v: number, [lo, hi]: [number, number]) => {
    if (v >= lo && v <= hi) return 1;
    const mid = (lo + hi) / 2;
    const tol = (hi - lo) * 0.6;
    const d = Math.abs(v - mid);
    return Math.max(0, 1 - (d - (hi - lo) / 2) / tol);
  };
  const s = (
    inRange(r.xab, spec.xab) +
    inRange(r.abc, spec.abc) +
    inRange(r.bcd, spec.bcd) * 0.8 +
    inRange(r.xad, spec.xad) * 1.2
  ) / 4;
  return Math.max(0, Math.min(1, s));
}

/** 5개 스윙이 XABCD로 유효(고저 교대)인지 */
function validAlternation(pts: SwingPoint[]): boolean {
  if (pts.length !== 5) return false;
  const t = pts.map((p) => p.type);
  return (
    (t[0] === 'high' && t[1] === 'low' && t[2] === 'high' && t[3] === 'low' && t[4] === 'high') ||
    (t[0] === 'low' && t[1] === 'high' && t[2] === 'low' && t[3] === 'high' && t[4] === 'low')
  );
}

export function analyzeHarmonic(candles: Candle[], price: number): HarmonicTheorySignal {
  const neutral: HarmonicTheorySignal = {
    signal: 'WATCH', confidence: 30, reason: '하모닉 패턴 미감지',
    entry: price, sl: price, tp: price, detected: null,
  };
  if (candles.length < 30) return neutral;

  const swings = findSwingPoints(candles, candles.length > 80 ? 0.018 : 0.012);
  if (swings.length < 5) return neutral;

  const atr = calcATR(candles, 14);
  const a = atr[atr.length - 1] || price * 0.01;

  // 최근 7개 스윙 윈도우에서 5점 슬라이딩 → 가장 점수 높은 패턴 선택
  const recent = swings.slice(-Math.min(7, swings.length));
  let best: { pattern: HarmonicPattern; score: number } | null = null;

  for (let i = 0; i + 4 < recent.length; i++) {
    const window = recent.slice(i, i + 5);
    if (!validAlternation(window)) continue;
    const [X, A, B, C, D] = window.map((p) => p.price);
    const XA = Math.abs(A - X);
    if (XA === 0) continue;
    const AB = Math.abs(B - A);
    const BC = Math.abs(C - B);
    const CD = Math.abs(D - C);
    const XD = Math.abs(D - X);
    const ratios = { xab: AB / XA, abc: BC / AB, bcd: CD / BC, xad: XD / XA };

    const bias: 'bullish' | 'bearish' = window[4].type === 'low' ? 'bullish' : 'bearish';

    for (const spec of SPECS) {
      const s = match(spec, ratios);
      if (s < 0.55) continue;

      // PRZ: D 주변 ±0.6×ATR
      const przHalf = a * 0.6;
      const prz = { low: D - przHalf, high: D + przHalf };

      // Entry/SL/TP — D 반전 매매 (RR 최소 2:1 강제)
      const entry = bias === 'bullish' ? Math.max(price, D + a * 0.05) : Math.min(price, D - a * 0.05);
      const sl = bias === 'bullish' ? D - a * 1.2 : D + a * 1.2;
      const risk = Math.abs(entry - sl);
      const tp1 = bias === 'bullish'
        ? entry + Math.max(XA * 0.382, risk * 2.0)
        : entry - Math.max(XA * 0.382, risk * 2.0);
      const tp2 = bias === 'bullish'
        ? entry + Math.max(XA * 0.618, risk * 3.0)
        : entry - Math.max(XA * 0.618, risk * 3.0);

      const window5: HarmonicPoint[] = window.map((p, idx) => ({
        ...p, label: (['X', 'A', 'B', 'C', 'D'][idx] as HarmonicPoint['label']),
      }));

      const pattern: HarmonicPattern = {
        name: spec.name, bias, points: window5, ratios, prz,
        entry, sl, tp1, tp2,
        quality: Math.round(s * 100),
        description:
          `${bias === 'bullish' ? '불리시' : '베어리시'} ${spec.name} — XAB ${(ratios.xab * 100).toFixed(0)}% / ABC ${(ratios.abc * 100).toFixed(0)}% / BCD ${(ratios.bcd * 100).toFixed(0)}% / XAD ${(ratios.xad * 100).toFixed(0)}%`,
      };

      // 인접도 가중: D가 현재가에 가까울수록 +
      const proximity = 1 - Math.min(1, Math.abs(price - D) / (a * 4));
      const finalScore = s * 0.75 + proximity * 0.25;
      if (!best || finalScore > best.score) best = { pattern, score: finalScore };
    }
  }

  // AB=CD (4점) — XABCD가 안 맞을 때 fallback
  if (!best && recent.length >= 4) {
    const window = recent.slice(-4);
    const [A, B, C, D] = window.map((p) => p.price);
    const AB = Math.abs(B - A), CD = Math.abs(D - C);
    const ratio = CD / AB;
    if (ratio > 0.85 && ratio < 1.15) {
      const bias: 'bullish' | 'bearish' = window[3].type === 'low' ? 'bullish' : 'bearish';
      const entry = price;
      const sl = bias === 'bullish' ? D - a * 1.2 : D + a * 1.2;
      const risk = Math.abs(entry - sl);
      const tp1 = bias === 'bullish' ? entry + risk * 1.5 : entry - risk * 1.5;
      const tp2 = bias === 'bullish' ? entry + risk * 2.5 : entry - risk * 2.5;
      const pattern: HarmonicPattern = {
        name: 'AB=CD', bias,
        points: [
          { ...window[0], label: 'A' },
          { ...window[1], label: 'B' },
          { ...window[2], label: 'C' },
          { ...window[3], label: 'D' },
          { ...window[3], label: 'D' }, // pad
        ] as any,
        ratios: { xab: 0, abc: 0, bcd: ratio, xad: 0 },
        prz: { low: D - a * 0.6, high: D + a * 0.6 },
        entry, sl, tp1, tp2,
        quality: 60,
        description: `${bias === 'bullish' ? '불리시' : '베어리시'} AB=CD — CD/AB ${(ratio * 100).toFixed(0)}%`,
      };
      best = { pattern, score: 0.6 };
    }
  }

  if (!best) return neutral;

  const p = best.pattern;
  const D = p.points[p.points.length - 1].price;
  const distToD = Math.abs(price - D) / price;
  const inPrz = price >= p.prz.low && price <= p.prz.high;

  // 신뢰도: quality + PRZ 진입 보너스 + 인접도
  let confidence = p.quality;
  if (inPrz) confidence = Math.min(92, confidence + 12);
  else if (distToD < 0.01) confidence = Math.min(88, confidence + 6);
  else confidence = Math.max(40, confidence - 10);

  const signal: 'LONG' | 'SHORT' | 'WATCH' =
    confidence >= 60 ? (p.bias === 'bullish' ? 'LONG' : 'SHORT') : 'WATCH';

  return {
    signal,
    confidence,
    reason: `${p.description}${inPrz ? ' · PRZ 내부' : ''}`,
    entry: p.entry, sl: p.sl, tp: p.tp2,
    detected: p,
  };
}
