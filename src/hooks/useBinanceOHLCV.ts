import { useState, useEffect, useRef, useCallback } from 'react';
import type { TradingMode } from './useMarketAnalysis';
import type { Candle } from '@/utils/indicators';

const INTERVAL_MAP: Record<TradingMode, string> = {
  scalping: '5m',
  daytrading: '1h',
  swing: '1d',
};

export interface OHLCVData {
  symbol: string;
  candles: Candle[];
  loading: boolean;
  error: string | null;
}

/** Fetch OHLCV for multiple symbols from Binance public API */
export function useBinanceOHLCV(symbols: string[], mode: TradingMode) {
  const [data, setData] = useState<Record<string, OHLCVData>>({});
  const abortRef = useRef<AbortController | null>(null);
  const cacheKey = useRef('');

  const fetchAll = useCallback(async () => {
    const key = `${symbols.join(',')}-${mode}`;
    if (key === cacheKey.current || symbols.length === 0) return;
    cacheKey.current = key;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const interval = INTERVAL_MAP[mode];

    // Initialize loading state
    const init: Record<string, OHLCVData> = {};
    symbols.forEach(s => {
      init[s] = { symbol: s, candles: [], loading: true, error: null };
    });
    setData(init);

    // Fetch in batches of 5 to avoid rate limits
    const batchSize = 5;
    const results: Record<string, OHLCVData> = {};

    for (let i = 0; i < symbols.length; i += batchSize) {
      if (controller.signal.aborted) return;
      const batch = symbols.slice(i, i + batchSize);

      const promises = batch.map(async (sym) => {
        const pair = `${sym}USDT`;
        try {
          const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=100`;
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) throw new Error(`${res.status}`);
          const raw = await res.json();
          const candles: Candle[] = raw.map((k: any[]) => ({
            time: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
          }));
          return { symbol: sym, candles, loading: false, error: null } as OHLCVData;
        } catch (e: any) {
          if (e.name === 'AbortError') throw e;
          return { symbol: sym, candles: [], loading: false, error: e.message } as OHLCVData;
        }
      });

      try {
        const batchResults = await Promise.all(promises);
        batchResults.forEach(r => { results[r.symbol] = r; });
        // Update state progressively
        setData(prev => ({ ...prev, ...Object.fromEntries(batchResults.map(r => [r.symbol, r])) }));
      } catch {
        // Aborted
        return;
      }

      // Small delay between batches
      if (i + batchSize < symbols.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
  }, [symbols.join(','), mode]);

  useEffect(() => {
    fetchAll();
    return () => { abortRef.current?.abort(); };
  }, [fetchAll]);

  // Refetch periodically
  useEffect(() => {
    const interval = mode === 'scalping' ? 60_000 : mode === 'daytrading' ? 120_000 : 300_000;
    const timer = setInterval(() => {
      cacheKey.current = ''; // Force refetch
      fetchAll();
    }, interval);
    return () => clearInterval(timer);
  }, [fetchAll, mode]);

  return data;
}
