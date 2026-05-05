import { useEffect, useState } from 'react';

export interface FundingRow {
  symbol: string;        // BTCUSDT
  fundingRate: number;   // 0.0001 = 0.01%
  nextFundingTime: number;
}

let cache: Record<string, FundingRow> = {};
let cacheAt = 0;
const TTL = 60_000;

async function refresh() {
  const r = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex');
  if (!r.ok) throw new Error('funding http ' + r.status);
  const arr = await r.json();
  const next: Record<string, FundingRow> = {};
  for (const it of arr) {
    if (!String(it.symbol).endsWith('USDT')) continue;
    next[it.symbol] = {
      symbol: it.symbol,
      fundingRate: parseFloat(it.lastFundingRate),
      nextFundingTime: Number(it.nextFundingTime),
    };
  }
  cache = next;
  cacheAt = Date.now();
}

let inflight: Promise<void> | null = null;
function ensure() {
  const now = Date.now();
  if (now - cacheAt < TTL) return Promise.resolve();
  if (inflight) return inflight;
  inflight = refresh().finally(() => { inflight = null; });
  return inflight;
}

export function useBinanceFunding(refreshMs = 60_000) {
  const [data, setData] = useState<Record<string, FundingRow>>(cache);
  useEffect(() => {
    let alive = true;
    const tick = () => ensure().then(() => alive && setData({ ...cache })).catch(() => {});
    tick();
    const id = setInterval(tick, refreshMs);
    return () => { alive = false; clearInterval(id); };
  }, [refreshMs]);
  return data;
}
