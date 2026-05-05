import type { TheorySignal } from './types';

/**
 * Fundamental Analysis — Funding Rate, OI, Long/Short ratio, Fear & Greed.
 * Cached per symbol for 5 min to limit API calls.
 *
 * All endpoints are PUBLIC (no API key needed):
 *  - https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT
 *  - https://fapi.binance.com/futures/data/openInterestHist
 *  - https://fapi.binance.com/futures/data/globalLongShortAccountRatio
 *  - https://api.alternative.me/fng/
 */

export interface FundamentalData {
  fundingRate: number | null;          // e.g. 0.0001 = 0.01%
  openInterestChange24h: number | null; // %
  longShortRatio: number | null;        // > 1 = more longs
  fearGreed: number | null;             // 0-100
  fearGreedLabel: string | null;
}

const cache = new Map<string, { ts: number; data: FundamentalData }>();
const TTL = 5 * 60 * 1000;

let fngCache: { ts: number; value: number; label: string } | null = null;

async function getFearGreed(): Promise<{ value: number; label: string } | null> {
  if (fngCache && Date.now() - fngCache.ts < TTL) {
    return { value: fngCache.value, label: fngCache.label };
  }
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!res.ok) return null;
    const j = await res.json();
    const item = j?.data?.[0];
    if (!item) return null;
    const value = parseInt(item.value, 10);
    const label = String(item.value_classification ?? '');
    fngCache = { ts: Date.now(), value, label };
    return { value, label };
  } catch {
    return null;
  }
}

export async function fetchFundamental(symbol: string): Promise<FundamentalData> {
  const sym = `${symbol.toUpperCase()}USDT`;
  const c = cache.get(sym);
  if (c && Date.now() - c.ts < TTL) return c.data;

  const out: FundamentalData = {
    fundingRate: null,
    openInterestChange24h: null,
    longShortRatio: null,
    fearGreed: null,
    fearGreedLabel: null,
  };

  try {
    const [premium, oi, ls, fng] = await Promise.allSettled([
      fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`).then(r => r.ok ? r.json() : null),
      fetch(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${sym}&period=1h&limit=24`).then(r => r.ok ? r.json() : null),
      fetch(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=1h&limit=1`).then(r => r.ok ? r.json() : null),
      getFearGreed(),
    ]);

    if (premium.status === 'fulfilled' && premium.value) {
      const fr = parseFloat(premium.value.lastFundingRate);
      if (isFinite(fr)) out.fundingRate = fr;
    }
    if (oi.status === 'fulfilled' && Array.isArray(oi.value) && oi.value.length >= 2) {
      const arr = oi.value;
      const first = parseFloat(arr[0].sumOpenInterest);
      const last = parseFloat(arr[arr.length - 1].sumOpenInterest);
      if (isFinite(first) && isFinite(last) && first > 0) {
        out.openInterestChange24h = ((last - first) / first) * 100;
      }
    }
    if (ls.status === 'fulfilled' && Array.isArray(ls.value) && ls.value[0]) {
      const r = parseFloat(ls.value[0].longShortRatio);
      if (isFinite(r)) out.longShortRatio = r;
    }
    if (fng.status === 'fulfilled' && fng.value) {
      out.fearGreed = fng.value.value;
      out.fearGreedLabel = fng.value.label;
    }
  } catch {
    /* keep nulls */
  }

  cache.set(sym, { ts: Date.now(), data: out });
  return out;
}

/**
 * Synchronous analyzer — uses provided FundamentalData (already fetched).
 * Score components, each contributing roughly equally:
 *   - Funding rate extremes are CONTRARIAN
 *   - OI rising + price up = trend confirmed
 *   - L/S ratio extremes contrarian
 *   - Fear < 30 = LONG bias, Greed > 70 = SHORT bias
 */
export function analyzeFundamental(
  data: FundamentalData | null,
  price: number,
  priceChange24h: number,
): TheorySignal {
  const neutral: TheorySignal = {
    signal: 'WATCH', confidence: 35,
    reason: '펀더멘털 데이터 수집 중', entry: price, sl: price, tp: price,
  };
  if (!data) return neutral;

  let score = 0;       // -100 ~ +100, + = bullish
  let count = 0;
  const reasons: string[] = [];

  // 1) Funding rate (contrarian on extremes)
  if (data.fundingRate !== null) {
    count++;
    const frPct = data.fundingRate * 100;
    if (frPct > 0.05) {
      score -= 30;
      reasons.push(`펀딩 ${frPct.toFixed(3)}% 과열(롱)→역방향`);
    } else if (frPct < -0.05) {
      score += 30;
      reasons.push(`펀딩 ${frPct.toFixed(3)}% 과열(숏)→역방향`);
    } else {
      reasons.push(`펀딩 ${frPct.toFixed(3)}% 중립`);
    }
  }

  // 2) Open Interest (trend-following)
  if (data.openInterestChange24h !== null) {
    count++;
    const oiC = data.openInterestChange24h;
    if (oiC > 5 && priceChange24h > 0) {
      score += 25;
      reasons.push(`OI +${oiC.toFixed(1)}% 동반상승`);
    } else if (oiC > 5 && priceChange24h < 0) {
      score -= 20;
      reasons.push(`OI +${oiC.toFixed(1)}% + 가격 하락 = 숏 진입증가`);
    } else if (oiC < -5) {
      reasons.push(`OI ${oiC.toFixed(1)}% 청산`);
    }
  }

  // 3) Long/Short ratio (contrarian)
  if (data.longShortRatio !== null) {
    count++;
    const lsr = data.longShortRatio;
    if (lsr > 2.5) {
      score -= 20;
      reasons.push(`L/S ${lsr.toFixed(2)} 롱 과밀→역행`);
    } else if (lsr < 0.7) {
      score += 20;
      reasons.push(`L/S ${lsr.toFixed(2)} 숏 과밀→역행`);
    } else {
      reasons.push(`L/S ${lsr.toFixed(2)} 균형`);
    }
  }

  // 4) Fear & Greed
  if (data.fearGreed !== null) {
    count++;
    const fg = data.fearGreed;
    if (fg <= 25) {
      score += 25;
      reasons.push(`F&G ${fg}(공포)→매수기회`);
    } else if (fg >= 75) {
      score -= 25;
      reasons.push(`F&G ${fg}(탐욕)→경계`);
    } else {
      reasons.push(`F&G ${fg}(${data.fearGreedLabel})`);
    }
  }

  if (count === 0) return neutral;

  const absScore = Math.min(100, Math.abs(score));
  const confidence = Math.round(35 + absScore * 0.5); // 35-85
  const signal: TheorySignal['signal'] =
    score >= 25 ? 'LONG' : score <= -25 ? 'SHORT' : 'WATCH';

  // Simple SL/TP based on price (no ATR available here)
  const slPct = 0.02, tpPct = 0.04;
  const sl = signal === 'LONG' ? price * (1 - slPct) : signal === 'SHORT' ? price * (1 + slPct) : price;
  const tp = signal === 'LONG' ? price * (1 + tpPct) : signal === 'SHORT' ? price * (1 - tpPct) : price;

  return {
    signal,
    confidence,
    reason: reasons.join(' · '),
    entry: price,
    sl,
    tp,
  };
}
