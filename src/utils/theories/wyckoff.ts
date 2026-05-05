import type { Candle } from '../indicators';
import type { TheorySignal } from './types';

/**
 * Wyckoff — 거래량 + 가격 구조로 축적/분배/마크업/마크다운 판단
 */
export function analyzeWyckoff(candles: Candle[], price: number): TheorySignal {
  const neutral: TheorySignal = { signal: 'WATCH', confidence: 30, reason: '와이코프 단계 불명확', entry: price, sl: price, tp: price };
  if (candles.length < 30) return neutral;

  const recent = candles.slice(-30);
  const first = candles.slice(-60, -30);
  const atr = recent.reduce((s, c) => s + (c.high - c.low), 0) / recent.length;

  // Volume analysis
  const recentAvgVol = recent.reduce((s, c) => s + c.volume, 0) / recent.length;
  const firstAvgVol = first.length > 0 ? first.reduce((s, c) => s + c.volume, 0) / first.length : recentAvgVol;
  const volDecline = recentAvgVol < firstAvgVol * 0.8;
  const volSpike = recentAvgVol > firstAvgVol * 1.3;

  // Price range (consolidation detection)
  const recentHigh = Math.max(...recent.map(c => c.high));
  const recentLow = Math.min(...recent.map(c => c.low));
  const range = (recentHigh - recentLow) / recentLow;
  const isConsolidation = range < 0.08; // <8% range = consolidation

  // Trend of first half
  const firstClose = first.length > 0 ? first[first.length - 1].close : candles[0].close;
  const firstOpen = first.length > 0 ? first[0].open : candles[0].open;
  const priorTrend = firstClose > firstOpen ? 'up' : 'down';

  // Spring detection: price breaks below range low then recovers
  const last5 = recent.slice(-5);
  const rangeBaseLow = Math.min(...recent.slice(0, -5).map(c => c.low));
  const spring = last5.some(c => c.low < rangeBaseLow) && price > rangeBaseLow;

  // UTAD: price breaks above range high then reverses
  const rangeBaseHigh = Math.max(...recent.slice(0, -5).map(c => c.high));
  const utad = last5.some(c => c.high > rangeBaseHigh) && price < rangeBaseHigh;

  // Accumulation: prior downtrend + consolidation + volume decline + spring
  if (priorTrend === 'down' && isConsolidation && volDecline && spring) {
    return {
      signal: 'LONG', confidence: 75,
      reason: '와이코프 축적(Accumulation) — 스프링 감지',
      entry: price, sl: recentLow * 0.995, tp: price + atr * 3,
    };
  }

  if (priorTrend === 'down' && isConsolidation && volDecline) {
    return {
      signal: 'LONG', confidence: 60,
      reason: '와이코프 축적 초기 — 거래량 감소 횡보',
      entry: price, sl: recentLow * 0.995, tp: recentHigh * 1.01,
    };
  }

  // Distribution: prior uptrend + consolidation + volume decline + UTAD
  if (priorTrend === 'up' && isConsolidation && volDecline && utad) {
    return {
      signal: 'SHORT', confidence: 75,
      reason: '와이코프 분배(Distribution) — UTAD 감지',
      entry: price, sl: recentHigh * 1.005, tp: price - atr * 3,
    };
  }

  if (priorTrend === 'up' && isConsolidation && volDecline) {
    return {
      signal: 'SHORT', confidence: 58,
      reason: '와이코프 분배 초기 — 거래량 감소 횡보',
      entry: price, sl: recentHigh * 1.005, tp: recentLow * 0.99,
    };
  }

  // Markup: breaking out of accumulation with volume
  if (priorTrend === 'down' && price > recentHigh * 0.99 && volSpike) {
    return {
      signal: 'LONG', confidence: 68,
      reason: '와이코프 마크업(Markup) — 축적 후 돌파',
      entry: price, sl: recentLow * 0.995, tp: price + atr * 3,
    };
  }

  // Markdown
  if (priorTrend === 'up' && price < recentLow * 1.01 && volSpike) {
    return {
      signal: 'SHORT', confidence: 68,
      reason: '와이코프 마크다운(Markdown) — 분배 후 하락',
      entry: price, sl: recentHigh * 1.005, tp: price - atr * 3,
    };
  }

  return neutral;
}
