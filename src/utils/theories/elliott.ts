import type { Candle } from '../indicators';
import { findSwingPoints } from '../indicators';
import type { TheorySignal } from './types';

/**
 * Elliott Wave — ZigZag로 스윙 포인트 추출 후 5파 구조 감지
 */
export function analyzeElliott(candles: Candle[], price: number): TheorySignal {
  const neutral: TheorySignal = { signal: 'WATCH', confidence: 30, reason: '파동 구조 불명확 — 관망', entry: price, sl: price, tp: price };
  if (candles.length < 20) return neutral;

  const threshold = candles.length > 50 ? 0.02 : 0.015;
  const swings = findSwingPoints(candles, threshold);
  if (swings.length < 5) return { ...neutral, reason: '스윙 포인트 부족 — 파동 카운팅 불가' };

  const last5 = swings.slice(-5);
  const atr = (candles[candles.length - 1].high - candles[candles.length - 1].low);

  // Check for bullish impulse: L-H-L-H-L pattern (Wave 1-2-3-4-5 lows/highs)
  const isUpImpulse =
    last5[0].type === 'low' && last5[1].type === 'high' && last5[2].type === 'low' &&
    last5[3].type === 'high' && last5[4].type === 'low' &&
    last5[2].price > last5[0].price && // Wave 2 above Wave 0 (higher low)
    last5[3].price > last5[1].price && // Wave 3 high > Wave 1 high
    last5[4].price > last5[2].price;   // Wave 4 low > Wave 2 low

  // Check for bearish impulse: H-L-H-L-H
  const isDownImpulse =
    last5[0].type === 'high' && last5[1].type === 'low' && last5[2].type === 'high' &&
    last5[3].type === 'low' && last5[4].type === 'high' &&
    last5[2].price < last5[0].price &&
    last5[3].price < last5[1].price &&
    last5[4].price < last5[2].price;

  // Current position relative to last swing
  const lastSwing = swings[swings.length - 1];
  const prevSwing = swings[swings.length - 2];

  if (isUpImpulse) {
    // After 5-wave up impulse, expect ABC correction (SHORT)
    if (price < lastSwing.price && lastSwing.type === 'high') {
      return {
        signal: 'SHORT',
        confidence: 65,
        reason: '상승 5파 완성 후 ABC 조정 진행 — 숏 기회',
        entry: price,
        sl: lastSwing.price * 1.005,
        tp: price - (lastSwing.price - price) * 1.5,
      };
    }
    // In middle of impulse (wave 2/4 correction) — LONG
    return {
      signal: 'LONG',
      confidence: 70,
      reason: '상승 임펄스 진행 중 — 눌림목 매수 기회',
      entry: price,
      sl: last5[last5.length - 1].price * 0.995,
      tp: last5[3].price * 1.01,
    };
  }

  if (isDownImpulse) {
    if (price > lastSwing.price && lastSwing.type === 'low') {
      return {
        signal: 'LONG',
        confidence: 65,
        reason: '하락 5파 완성 후 ABC 반등 — 롱 기회',
        entry: price,
        sl: lastSwing.price * 0.995,
        tp: price + (price - lastSwing.price) * 1.5,
      };
    }
    return {
      signal: 'SHORT',
      confidence: 70,
      reason: '하락 임펄스 진행 중 — 반등 시 숏',
      entry: price,
      sl: last5[last5.length - 1].price * 1.005,
      tp: last5[3].price * 0.99,
    };
  }

  // Partial wave detection: higher highs & higher lows
  const last3 = swings.slice(-3);
  if (last3.length >= 3) {
    if (last3[0].type === 'low' && last3[2].type === 'low' && last3[2].price > last3[0].price) {
      return { signal: 'LONG', confidence: 55, reason: '저점 상승 — 임펄스 초기 추정', entry: price, sl: last3[2].price * 0.99, tp: last3[1].price * 1.01 };
    }
    if (last3[0].type === 'high' && last3[2].type === 'high' && last3[2].price < last3[0].price) {
      return { signal: 'SHORT', confidence: 55, reason: '고점 하락 — 하방 임펄스 추정', entry: price, sl: last3[2].price * 1.01, tp: last3[1].price * 0.99 };
    }
  }

  return neutral;
}
