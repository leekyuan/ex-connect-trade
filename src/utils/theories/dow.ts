import type { Candle } from '../indicators';
import { findSwingPoints } from '../indicators';
import type { TheorySignal } from './types';

/**
 * Dow Theory — 고점/저점 구조로 추세 확인
 */
export function analyzeDow(candles: Candle[], price: number): TheorySignal {
  const neutral: TheorySignal = { signal: 'WATCH', confidence: 30, reason: '추세 구조 불명확', entry: price, sl: price, tp: price };
  if (candles.length < 20) return neutral;

  const swings = findSwingPoints(candles, 0.015);
  if (swings.length < 4) return neutral;

  const highs = swings.filter(s => s.type === 'high').slice(-3);
  const lows = swings.filter(s => s.type === 'low').slice(-3);
  const atr = candles.slice(-14).reduce((s, c) => s + (c.high - c.low), 0) / 14;

  // Volume confirmation
  const recentVol = candles.slice(-10).reduce((s, c) => s + c.volume, 0) / 10;
  const olderVol = candles.slice(-30, -10).reduce((s, c) => s + c.volume, 0) / Math.min(20, candles.slice(-30, -10).length || 1);
  const volConfirm = recentVol > olderVol * 0.8;

  if (highs.length >= 2 && lows.length >= 2) {
    const hh = highs[highs.length - 1].price > highs[highs.length - 2].price; // Higher High
    const hl = lows[lows.length - 1].price > lows[lows.length - 2].price;     // Higher Low

    const lh = highs[highs.length - 1].price < highs[highs.length - 2].price; // Lower High
    const ll = lows[lows.length - 1].price < lows[lows.length - 2].price;     // Lower Low

    if (hh && hl) {
      return {
        signal: 'LONG',
        confidence: volConfirm ? 72 : 55,
        reason: `다우이론 상승 추세 — 고점 상승 + 저점 상승${volConfirm ? ' + 거래량 확인' : ''}`,
        entry: price,
        sl: lows[lows.length - 1].price * 0.998,
        tp: price + (highs[highs.length - 1].price - lows[lows.length - 1].price),
      };
    }

    if (lh && ll) {
      return {
        signal: 'SHORT',
        confidence: volConfirm ? 72 : 55,
        reason: `다우이론 하락 추세 — 고점 하락 + 저점 하락${volConfirm ? ' + 거래량 확인' : ''}`,
        entry: price,
        sl: highs[highs.length - 1].price * 1.002,
        tp: price - (highs[highs.length - 1].price - lows[lows.length - 1].price),
      };
    }

    // Trend weakening
    if (hh && !hl) {
      return { signal: 'WATCH', confidence: 45, reason: '고점 상승이나 저점 유지 — 상승 추세 약화 경고', entry: price, sl: price, tp: price };
    }
    if (lh && !ll) {
      return { signal: 'WATCH', confidence: 45, reason: '고점 하락이나 저점 유지 — 하락 추세 약화 경고', entry: price, sl: price, tp: price };
    }
  }

  return neutral;
}
