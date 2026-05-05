import type { Candle } from '../indicators';
import type { TheorySignal } from './types';

/**
 * 프랙탈 (Bill Williams Fractal) — 5봉 패턴 기반 단기 반전점 감지
 * - Up Fractal: 가운데 봉의 high가 좌우 2개 봉보다 모두 높음 (저항)
 * - Down Fractal: 가운데 봉의 low가 좌우 2개 봉보다 모두 낮음 (지지)
 * 최근 프랙탈 위치 + 현재가 위치로 LONG/SHORT/관망 판단
 */
export function analyzeFractal(candles: Candle[], price: number): TheorySignal {
  const neutral: TheorySignal = {
    signal: 'WATCH', confidence: 30,
    reason: '프랙탈 패턴 미감지', entry: price, sl: price, tp: price,
  };
  if (candles.length < 20) return neutral;

  const recent = candles.slice(-50);
  const ups: { idx: number; price: number }[] = [];
  const downs: { idx: number; price: number }[] = [];

  for (let i = 2; i < recent.length - 2; i++) {
    const c = recent[i];
    if (c.high > recent[i-1].high && c.high > recent[i-2].high &&
        c.high > recent[i+1].high && c.high > recent[i+2].high) {
      ups.push({ idx: i, price: c.high });
    }
    if (c.low < recent[i-1].low && c.low < recent[i-2].low &&
        c.low < recent[i+1].low && c.low < recent[i+2].low) {
      downs.push({ idx: i, price: c.low });
    }
  }

  if (ups.length === 0 && downs.length === 0) return neutral;

  const atr = recent.reduce((s, c) => s + (c.high - c.low), 0) / recent.length;
  const lastUp = ups[ups.length - 1];
  const lastDown = downs[downs.length - 1];

  // 트렌드: 최근 up 프랙탈들이 상승하는지
  const upTrend = ups.length >= 2 && ups[ups.length - 1].price > ups[ups.length - 2].price;
  const downTrend = downs.length >= 2 && downs[downs.length - 1].price < downs[downs.length - 2].price;

  // 최근 down 프랙탈 돌파 = 매수 (Williams 룰)
  if (lastDown && price > lastDown.price && upTrend) {
    return {
      signal: 'LONG', confidence: 70,
      reason: '상승 프랙탈 형성 + 직전 저점 위 — 매수 타이밍',
      entry: price, sl: lastDown.price - atr * 0.3, tp: price + atr * 2.5,
    };
  }
  if (lastUp && price < lastUp.price && downTrend) {
    return {
      signal: 'SHORT', confidence: 70,
      reason: '하락 프랙탈 형성 + 직전 고점 아래 — 숏 타이밍',
      entry: price, sl: lastUp.price + atr * 0.3, tp: price - atr * 2.5,
    };
  }

  // 단순 근접
  if (lastDown && Math.abs(price - lastDown.price) / price < 0.005) {
    return {
      signal: 'LONG', confidence: 55,
      reason: '프랙탈 지지선 근접 — 반등 기대',
      entry: price, sl: lastDown.price - atr * 0.5, tp: price + atr * 1.8,
    };
  }
  if (lastUp && Math.abs(price - lastUp.price) / price < 0.005) {
    return {
      signal: 'SHORT', confidence: 55,
      reason: '프랙탈 저항선 근접 — 반락 기대',
      entry: price, sl: lastUp.price + atr * 0.5, tp: price - atr * 1.8,
    };
  }

  return neutral;
}
