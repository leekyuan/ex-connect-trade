import { useEffect, useState, useCallback } from 'react';

export interface TopCoin {
  id: string;
  symbol: string;          // BTC
  name: string;            // Bitcoin
  image: string;
  price: number;
  change24h: number;
  marketCap: number;
  tvSymbol: string;        // BINANCE:BTCUSDT
}

const STABLE = new Set(['USDT','USDC','BUSD','DAI','TUSD','FDUSD','USDE','PYUSD','USDP','USDD','GUSD','FRAX','LUSD']);
const WRAPPED_LST = new Set(['STETH','WSTETH','WBETH','RETH','CBETH','WBTC','BTCB','HBTC','RENBTC','SFRXETH','FRXETH']);

export function useTopMarketCoins(limit = 3, refreshMs = 60_000) {
  const [coins, setCoins] = useState<TopCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCoins = useCallback(async () => {
    try {
      setError(null);
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      const filtered: TopCoin[] = (raw as any[])
        .filter(c => {
          const sym = String(c.symbol).toUpperCase();
          if (STABLE.has(sym)) return false;
          if (WRAPPED_LST.has(sym)) return false;
          return true;
        })
        .slice(0, limit)
        .map(c => ({
          id: c.id,
          symbol: String(c.symbol).toUpperCase(),
          name: c.name,
          image: c.image,
          price: c.current_price,
          change24h: c.price_change_percentage_24h ?? 0,
          marketCap: c.market_cap,
          tvSymbol: `BINANCE:${String(c.symbol).toUpperCase()}USDT`,
        }));
      setCoins(filtered);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchCoins();
    const id = setInterval(fetchCoins, refreshMs);
    return () => clearInterval(id);
  }, [fetchCoins, refreshMs]);

  return { coins, loading, error, refetch: fetchCoins };
}
