/**
 * Clear trading signal — never returns ambiguous "MAYBE" results.
 * Inputs are normalised z-scores plus optional context.
 */
export interface ClearSignal {
  verdict: 'LONG' | 'SHORT' | 'WATCH';
  strength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE';
  confidence: number;
  reasons: string[];
  invalidate: string;
  entryZone: [number, number];
  sl: number;
  tp1: number;
  tp2: number;
  rr: number;
}

interface Input {
  price: number;
  z: number;          // composite z-score (negative → oversold/bullish)
  volZ: number;       // volume z-score
  rsi?: number;
  trendAlign?: boolean; // higher-tf trend agrees with verdict
  atrPct?: number;    // ATR / price (e.g. 0.012 for 1.2%)
}

export function buildClearSignal({ price, z, volZ, rsi, trendAlign, atrPct }: Input): ClearSignal {
  const atr = (atrPct ?? 0.015) * price;
  const reasons: string[] = [];
  let verdict: ClearSignal['verdict'] = 'WATCH';
  let strength: ClearSignal['strength'] = 'NONE';
  let confidence = 0;

  // ── LONG branches ────────────────────────────────────────
  if (z < -1.2 && volZ > 0.5) {
    verdict = 'LONG'; strength = 'STRONG';
    reasons.push(`강한 과매도 (z=${z.toFixed(2)})`, `거래량 급증 (volZ=${volZ.toFixed(2)})`);
  } else if (z < -0.8 && (volZ > 0 || (rsi != null && rsi > 35 && rsi < 50))) {
    verdict = 'LONG'; strength = 'MODERATE';
    reasons.push(`과매도 (z=${z.toFixed(2)})`, volZ > 0 ? '거래량 양호' : 'RSI 회복 중');
  } else if (z < -0.5) {
    verdict = 'LONG'; strength = 'WEAK';
    reasons.push(`약한 과매도 (z=${z.toFixed(2)})`);
  }
  // ── SHORT branches ───────────────────────────────────────
  else if (z > 1.2 && volZ > 0.5) {
    verdict = 'SHORT'; strength = 'STRONG';
    reasons.push(`강한 과매수 (z=${z.toFixed(2)})`, `거래량 급증 (volZ=${volZ.toFixed(2)})`);
  } else if (z > 0.8) {
    verdict = 'SHORT'; strength = 'MODERATE';
    reasons.push(`과매수 (z=${z.toFixed(2)})`);
  } else if (z > 0.5) {
    verdict = 'SHORT'; strength = 'WEAK';
    reasons.push(`약한 과매수 (z=${z.toFixed(2)})`);
  }

  // Confidence ranges
  if (strength === 'STRONG')   confidence = 75 + Math.min(18, Math.round(Math.abs(z) * 5));
  else if (strength === 'MODERATE') confidence = 55 + Math.min(19, Math.round(Math.abs(z) * 8));
  else if (strength === 'WEAK')     confidence = 35 + Math.min(19, Math.round(Math.abs(z) * 10));
  else confidence = 0;

  if (trendAlign && verdict !== 'WATCH') {
    confidence = Math.min(93, confidence + 5);
    reasons.push('상위 TF 추세 일치');
  }

  reasons.splice(3); // cap to 3

  // Entry / SL / TP
  const dir = verdict === 'LONG' ? 1 : verdict === 'SHORT' ? -1 : 0;
  const entryZone: [number, number] = dir
    ? [price - 0.2 * atr, price + 0.2 * atr]
    : [price, price];
  const sl  = dir ? price - dir * 1.5 * atr : price;
  const tp1 = dir ? price + dir * 2.0 * atr : price;
  const tp2 = dir ? price + dir * 3.5 * atr : price;
  const rr  = dir ? Math.abs(tp1 - price) / Math.max(0.0001, Math.abs(price - sl)) : 0;

  const invalidate = verdict === 'LONG'
    ? `종가가 ${sl.toFixed(2)} 아래로 종료되면 무효`
    : verdict === 'SHORT'
      ? `종가가 ${sl.toFixed(2)} 위로 종료되면 무효`
      : '신호 없음';

  return {
    verdict, strength, confidence,
    reasons: reasons.length ? reasons : ['뚜렷한 우위 없음'],
    invalidate, entryZone, sl, tp1, tp2, rr,
  };
}
