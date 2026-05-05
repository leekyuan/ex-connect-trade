import type { Candle } from '../indicators';
import type { TheorySignal } from './types';

/**
 * ICT — Order Block, Fair Value Gap, Liquidity Sweep
 */
export function analyzeICT(candles: Candle[], price: number): TheorySignal {
  const neutral: TheorySignal = { signal: 'WATCH', confidence: 30, reason: 'ICT 패턴 미감지', entry: price, sl: price, tp: price };
  if (candles.length < 20) return neutral;

  const recent = candles.slice(-30);
  const last = recent[recent.length - 1];
  const avgVol = recent.reduce((s, c) => s + c.volume, 0) / recent.length;
  const atr = recent.reduce((s, c) => s + (c.high - c.low), 0) / recent.length;

  // Detect FVG (Fair Value Gap): gap between candle[i-2].low and candle[i].high (bullish) or vice versa
  let bullishFVG = false, bearishFVG = false;
  let fvgPrice = 0;
  for (let i = recent.length - 1; i >= 2; i--) {
    // Bullish FVG: candle[i].low > candle[i-2].high (gap up)
    if (recent[i].low > recent[i - 2].high) {
      bullishFVG = true;
      fvgPrice = (recent[i].low + recent[i - 2].high) / 2;
      break;
    }
    // Bearish FVG: candle[i].high < candle[i-2].low (gap down)
    if (recent[i].high < recent[i - 2].low) {
      bearishFVG = true;
      fvgPrice = (recent[i].high + recent[i - 2].low) / 2;
      break;
    }
    if (i < recent.length - 10) break; // Only check last 10 candles
  }

  // Detect Order Block: last bearish candle before a strong bullish move (or vice versa)
  let bullishOB = 0, bearishOB = 0;
  for (let i = recent.length - 2; i >= 1; i--) {
    const curr = recent[i], next = recent[i + 1];
    // Bullish OB: bearish candle followed by strong bullish
    if (curr.close < curr.open && next.close > next.open && (next.close - next.open) > atr * 1.5) {
      bullishOB = curr.open; // OB zone is the bearish candle's body
      break;
    }
    // Bearish OB: bullish candle followed by strong bearish
    if (curr.close > curr.open && next.close < next.open && (next.open - next.close) > atr * 1.5) {
      bearishOB = curr.open;
      break;
    }
    if (i < recent.length - 10) break;
  }

  // Liquidity sweep: price dipped below recent low then recovered
  const recentLows = recent.slice(-10).map(c => c.low);
  const minLow = Math.min(...recentLows.slice(0, -2));
  const swept = last.low < minLow && last.close > minLow;

  if (swept && last.volume > avgVol * 1.3) {
    return {
      signal: 'LONG', confidence: 72,
      reason: '하방 유동성 스윕 후 강한 반등 — 매수 기회',
      entry: price, sl: last.low * 0.998, tp: price + atr * 2.5,
    };
  }

  const recentHighs = recent.slice(-10).map(c => c.high);
  const maxHigh = Math.max(...recentHighs.slice(0, -2));
  const sweptHigh = last.high > maxHigh && last.close < maxHigh;
  if (sweptHigh && last.volume > avgVol * 1.3) {
    return {
      signal: 'SHORT', confidence: 72,
      reason: '상방 유동성 스윕 후 반전 — 숏 기회',
      entry: price, sl: last.high * 1.002, tp: price - atr * 2.5,
    };
  }

  if (bullishOB > 0 && price <= bullishOB * 1.005 && price >= bullishOB * 0.995) {
    return {
      signal: 'LONG', confidence: 65,
      reason: '불리시 오더블록(OB) 근처 — 매수 반응 기대',
      entry: price, sl: bullishOB * 0.99, tp: price + atr * 2,
    };
  }
  if (bearishOB > 0 && price >= bearishOB * 0.995 && price <= bearishOB * 1.005) {
    return {
      signal: 'SHORT', confidence: 65,
      reason: '베어리시 오더블록(OB) 근처 — 매도 반응 기대',
      entry: price, sl: bearishOB * 1.01, tp: price - atr * 2,
    };
  }

  if (bullishFVG && price < fvgPrice * 1.003) {
    return { signal: 'LONG', confidence: 58, reason: '불리시 FVG 영역 — 갭 채움 기대', entry: price, sl: fvgPrice * 0.99, tp: price + atr * 1.8 };
  }
  if (bearishFVG && price > fvgPrice * 0.997) {
    return { signal: 'SHORT', confidence: 58, reason: '베어리시 FVG 영역 — 갭 채움 기대', entry: price, sl: fvgPrice * 1.01, tp: price - atr * 1.8 };
  }

  return neutral;
}
