import { useEffect, useState } from 'react';

export interface FearGreedData {
  value: number;
  classification: string;
  ts: number;
}

let cache: FearGreedData | null = null;
let cacheAt = 0;
const TTL = 5 * 60 * 1000;

export function useFearGreed() {
  const [data, setData] = useState<FearGreedData | null>(cache);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const now = Date.now();
    if (cache && now - cacheAt < TTL) {
      setData(cache);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch('https://api.alternative.me/fng/?limit=1')
      .then(r => r.json())
      .then(j => {
        if (!alive) return;
        const item = j?.data?.[0];
        if (!item) throw new Error('no data');
        const next: FearGreedData = {
          value: Number(item.value),
          classification: String(item.value_classification),
          ts: Number(item.timestamp) * 1000,
        };
        cache = next;
        cacheAt = Date.now();
        setData(next);
      })
      .catch(e => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  return { data, loading, error };
}

export function classifyColor(v: number): { label: string; cls: string } {
  if (v >= 75) return { label: '극단적 탐욕', cls: 'text-emerald-400' };
  if (v >= 55) return { label: '탐욕', cls: 'text-emerald-300' };
  if (v >= 45) return { label: '중립', cls: 'text-amber-400' };
  if (v >= 25) return { label: '공포', cls: 'text-orange-400' };
  return { label: '극단적 공포', cls: 'text-red-400' };
}
