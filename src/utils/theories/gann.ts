import type { Candle } from '../indicators';
import { findSwingPoints, calcATR } from '../indicators';
import type { TheorySignal } from './types';

/**
 * Gann Theory — 45도 갠앵글 + 갠 스퀘어 지지/저항
 * 단순화: 최근 주요 스윙 저점/고점에서 시간-가격 1:1 라인을 ATR 단위로 투영.
 */
export function analyzeGann(candles: Candle[], price: number): TheorySignal {
  const neutral: TheorySignal = {
    signal: 'WATCH', confidence: 30,
    reason: '갠 앵글 판단 불가', entry: price, sl: price, tp: price,
  };
  if (candles.length < 30) return neutral;

  const swings = findSwingPoints(candles, 0.02);
  if (swings.length < 2) return neutral;

  const atr = calcATR(candles, 14);
  const atrVal = atr[atr.length - 1];
  if (!isFinite(atrVal) || atrVal <= 0) return neutral;

  // Pick most recent major swing low and high
  const lows = swings.filter(s => s.type === 'low').slice(-2);
  const highs = swings.filter(s => s.type === 'high').slice(-2);
  const lastLow = lows[lows.length - 1];
  const lastHigh = highs[highs.length - 1];
  if (!lastLow || !lastHigh) return neutral;

  const lastIdx = candles.length - 1;
  const isUp = lastLow.index > lastHigh.index; // recent low after high → bottoming/up
  // 1x1 angle: price changes by 1 ATR per candle
  const baseIdx = isUp ? lastLow.index : lastHigh.index;
  const basePrice = isUp ? lastLow.price : lastHigh.price;
  const elapsed = lastIdx - baseIdx;
  const angle1x1 = isUp ? basePrice + atrVal * elapsed : basePrice - atrVal * elapsed;
  const angle1x2 = isUp ? basePrice + atrVal * elapsed * 0.5 : basePrice - atrVal * elapsed * 0.5;
  const angle2x1 = isUp ? basePrice + atrVal * elapsed * 2 : basePrice - atrVal * elapsed * 2;

  // Gann square levels at 25/50/75/100% of recent range
  const range = Math.abs(lastHigh.price - lastLow.price);
  const sq25 = lastLow.price + range * 0.25;
  const sq50 = lastLow.price + range * 0.50;
  const sq75 = lastLow.price + range * 0.75;

  // Distance to 1x1 line (relative)
  const dist1x1 = (price - angle1x1) / atrVal;

  // Strong above 1x1 going up → bullish
  if (isUp && price > angle1x1 && price < angle2x1 && dist1x1 > 0.2 && dist1x1 < 3) {
    return {
      signal: 'LONG', confidence: 65,
      reason: `갠 1x1 앵글 위 상승 진행 (${(dist1x1).toFixed(1)} ATR)`,
      entry: price,
      sl: Math.max(angle1x2, lastLow.price * 0.995),
      tp: angle2x1,
    };
  }
  // Below 1x1 going down → bearish
  if (!isUp && price < angle1x1 && price > angle2x1 && Math.abs(dist1x1) > 0.2 && Math.abs(dist1x1) < 3) {
    return {
      signal: 'SHORT', confidence: 65,
      reason: `갠 1x1 앵글 아래 하락 진행 (${Math.abs(dist1x1).toFixed(1)} ATR)`,
      entry: price,
      sl: Math.min(angle1x2, lastHigh.price * 1.005),
      tp: angle2x1,
    };
  }

  // Bounce from gann square 50% (strongest)
  const distToSq50 = Math.abs(price - sq50) / price;
  if (distToSq50 < 0.005) {
    if (isUp) {
      return {
        signal: 'LONG', confidence: 60,
        reason: '갠 스퀘어 50% 지지 반등',
        entry: price, sl: sq25, tp: lastHigh.price,
      };
    }
    return {
      signal: 'SHORT', confidence: 60,
      reason: '갠 스퀘어 50% 저항',
      entry: price, sl: sq75, tp: lastLow.price,
    };
  }

  return {
    ...neutral, confidence: 40,
    reason: `갠 1x1 앵글까지 ${dist1x1.toFixed(1)} ATR — 명확한 신호 없음`,
  };
}
