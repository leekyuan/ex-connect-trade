import { useEffect, useState } from 'react';

export interface TickerRow {
  symbol: string;       // BTCUSDT
  lastPrice: number;
  priceChangePercent: number;   // 24h
  volume: number;
  quoteVolume: number;
}

let cache: Record<string, TickerRow> = {};
let cacheAt = 0;
const TTL = 8_000;
const subs = new Set<() => void>();

async function refresh() {
  const r = await fetch('https://api.binance.com/api/v3/ticker/24hr');
  if (!r.ok) throw new Error('binance ticker http ' + r.status);
  const arr = await r.json();
  const next: Record<string, TickerRow> = {};
  for (const it of arr) {
    if (!String(it.symbol).endsWith('USDT')) continue;
    next[it.symbol] = {
      symbol: it.symbol,
      lastPrice: parseFloat(it.lastPrice),
      priceChangePercent: parseFloat(it.priceChangePercent),
      volume: parseFloat(it.volume),
      quoteVolume: parseFloat(it.quoteVolume),
    };
  }
  cache = next;
  cacheAt = Date.now();
  subs.forEach(fn => fn());
}

let inflight: Promise<void> | null = null;
function ensure() {
  const now = Date.now();
  if (now - cacheAt < TTL) return Promise.resolve();
  if (inflight) return inflight;
  inflight = refresh().finally(() => { inflight = null; });
  return inflight;
}

export function useBinanceTicker(refreshMs = 15_000) {
  const [tickers, setTickers] = useState<Record<string, TickerRow>>(cache);

  useEffect(() => {
    let alive = true;
    const update = () => alive && setTickers({ ...cache });
    subs.add(update);
    ensure().then(update).catch(() => {});
    const id = setInterval(() => ensure().then(update).catch(() => {}), refreshMs);
    return () => { alive = false; subs.delete(update); clearInterval(id); };
  }, [refreshMs]);

  return tickers;
}

export function getTicker(symbol: string): TickerRow | undefined {
  return cache[symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : symbol.toUpperCase() + 'USDT'];
}
