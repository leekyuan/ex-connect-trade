import { useEffect, useState } from 'react';

/**
 * Binance USDT 현물 심볼 캐시.
 * exchangeInfo 한 번 받아서 모듈 레벨에 캐시.
 * CMC Top30에 있어도 Binance에 없는 코인(예: OPG, 일부 신규)은 제외하기 위함.
 */
let CACHE: Set<string> | null = null;
let INFLIGHT: Promise<Set<string>> | null = null;

async function loadSymbols(): Promise<Set<string>> {
  if (CACHE) return CACHE;
  if (INFLIGHT) return INFLIGHT;
  INFLIGHT = (async () => {
    try {
      const res = await fetch('https://api.binance.com/api/v3/exchangeInfo');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const set = new Set<string>();
      for (const s of json.symbols ?? []) {
        if (s.status === 'TRADING' && s.quoteAsset === 'USDT' && s.isSpotTradingAllowed) {
          set.add(String(s.baseAsset).toUpperCase());
        }
      }
      CACHE = set;
      return set;
    } catch {
      // Fallback: empty set means "don't filter" downstream
      CACHE = new Set();
      return CACHE;
    } finally {
      INFLIGHT = null;
    }
  })();
  return INFLIGHT;
}

export function useBinanceSymbols() {
  const [symbols, setSymbols] = useState<Set<string>>(CACHE ?? new Set());
  const [ready, setReady] = useState<boolean>(!!CACHE);
  useEffect(() => {
    let alive = true;
    loadSymbols().then(s => {
      if (!alive) return;
      setSymbols(s);
      setReady(true);
    });
    return () => { alive = false; };
  }, []);
  return { symbols, ready };
}

export async function isBinanceUsdt(symbol: string): Promise<boolean> {
  const s = await loadSymbols();
  if (s.size === 0) return true; // fallback: don't block
  return s.has(symbol.toUpperCase());
}
