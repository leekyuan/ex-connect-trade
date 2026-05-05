import type { Candle } from '../indicators';
import { findSwingPoints } from '../indicators';
import type { TheorySignal } from './types';

/**
 * Fibonacci Retracement — 실제 스윙 고저점에서 피보나치 레벨 계산
 */
export function analyzeFibonacci(candles: Candle[], price: number): TheorySignal {
  const neutral: TheorySignal = { signal: 'WATCH', confidence: 30, reason: '피보나치 레벨 판단 불가', entry: price, sl: price, tp: price };
  if (candles.length < 20) return neutral;

  const swings = findSwingPoints(candles, 0.02);
  if (swings.length < 2) return neutral;

  // Find the most recent major swing high and swing low
  let swingHigh = -Infinity, swingLow = Infinity;
  let shIdx = -1, slIdx = -1;
  for (const s of swings) {
    if (s.type === 'high' && s.price > swingHigh) { swingHigh = s.price; shIdx = s.index; }
    if (s.type === 'low' && s.price < swingLow) { swingLow = s.price; slIdx = s.index; }
  }

  if (swingHigh === -Infinity || swingLow === Infinity || swingHigh <= swingLow) return neutral;

  const range = swingHigh - swingLow;
  const atr = candles.slice(-14).reduce((s, c) => s + (c.high - c.low), 0) / 14;

  // Determine trend direction based on which came last
  const isUptrend = slIdx < shIdx; // low before high = uptrend

  // Fib levels
  const levels = [
    { ratio: 0.236, price: isUptrend ? swingHigh - range * 0.236 : swingLow + range * 0.236 },
    { ratio: 0.382, price: isUptrend ? swingHigh - range * 0.382 : swingLow + range * 0.382 },
    { ratio: 0.500, price: isUptrend ? swingHigh - range * 0.500 : swingLow + range * 0.500 },
    { ratio: 0.618, price: isUptrend ? swingHigh - range * 0.618 : swingLow + range * 0.618 },
    { ratio: 0.786, price: isUptrend ? swingHigh - range * 0.786 : swingLow + range * 0.786 },
  ];

  // Find nearest fib level to current price
  const nearest = levels.reduce((best, lev) =>
    Math.abs(price - lev.price) < Math.abs(price - best.price) ? lev : best
  );
  const distPct = Math.abs(price - nearest.price) / price;

  // Golden zone: 0.382 - 0.618
  const inGoldenZone = nearest.ratio >= 0.382 && nearest.ratio <= 0.618;

  if (distPct < 0.005) {
    // Price is at a fib level (within 0.5%)
    if (isUptrend && inGoldenZone) {
      return {
        signal: 'LONG', confidence: 72,
        reason: `상승 추세 — ${(nearest.ratio * 100).toFixed(1)}% 피보나치 골든존 지지`,
        entry: price, sl: swingLow * 0.998, tp: swingHigh * 1.005,
      };
    }
    if (!isUptrend && inGoldenZone) {
      return {
        signal: 'SHORT', confidence: 72,
        reason: `하락 추세 — ${(nearest.ratio * 100).toFixed(1)}% 피보나치 골든존 저항`,
        entry: price, sl: swingHigh * 1.002, tp: swingLow * 0.995,
      };
    }
    return {
      signal: isUptrend ? 'LONG' : 'SHORT', confidence: 58,
      reason: `${(nearest.ratio * 100).toFixed(1)}% 피보나치 레벨 근접`,
      entry: price, sl: isUptrend ? nearest.price - atr : nearest.price + atr, tp: isUptrend ? price + atr * 2 : price - atr * 2,
    };
  }

  if (distPct < 0.015) {
    return {
      signal: 'WATCH', confidence: 45,
      reason: `${(nearest.ratio * 100).toFixed(1)}% 피보나치 레벨 접근 중 (${(distPct * 100).toFixed(1)}% 거리)`,
      entry: price, sl: price, tp: price,
    };
  }

  return neutral;
}
