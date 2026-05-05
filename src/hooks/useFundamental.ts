import { useEffect, useState } from 'react';
import { fetchFundamental, type FundamentalData } from '@/utils/theories/fundamental';

/**
 * Fetches funding/OI/LS/F&G for a single symbol with 5-min cache.
 * Returns null while loading.
 */
export function useFundamental(symbol: string | null | undefined): FundamentalData | null {
  const [data, setData] = useState<FundamentalData | null>(null);

  useEffect(() => {
    if (!symbol) { setData(null); return; }
    let cancelled = false;
    setData(null);
    fetchFundamental(symbol)
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [symbol]);

  return data;
}
