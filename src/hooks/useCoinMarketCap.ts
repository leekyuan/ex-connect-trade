import { useState, useEffect, useCallback } from 'react';

export interface CoinData {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  cmc_rank: number;
  price: number;
  volume_24h: number;
  percent_change_1h: number;
  percent_change_24h: number;
  percent_change_7d: number;
  market_cap: number;
  tvSymbol: string;
  rank_by_cap: number;
  rank_by_volume: number;
  is_top_cap: boolean;
  is_top_volume: boolean;
}

const STABLECOINS = new Set([
  // USD pegged
  'USDT','USDC','BUSD','DAI','TUSD','USDP','USDD','GUSD',
  'FRAX','LUSD','SUSD','FDUSD','PYUSD','USDE','CRVUSD',
  'MKUSD','GHO','USD1','USDX','CUSD','USDN','HUSD','MUSD',
  'USDJ','OUSD','ALUSD','DOLA','MAI','MIM','BEAN','USDS',
  'USDM','ZUSD','FLEXUSD',
  // EUR pegged
  'EURS','EURT','EUROC','STEUR',
  // Wrapped stables
  'WLFI','WUSDT','WUSDC',
  // LST (Liquid Staking Tokens) — track ETH price
  'STETH','RETH','CBETH','WBETH','BETH','FRXETH','SFRXETH',
  'WSTETH','SWETH','ANKRETH','OSETH',
  // BTC wrapped
  'WBTC','BTCB','HBTC','RENBTC',
]);

const isStable = (coin: { symbol: string; name?: string }): boolean => {
  if (STABLECOINS.has(coin.symbol)) return true;
  const nameLower = (coin.name || '').toLowerCase();
  if (nameLower.includes('usd') && !nameLower.includes('bittensor')) return true;
  if (nameLower.includes('stablecoin')) return true;
  if (nameLower.includes('pegged')) return true;
  if (nameLower.includes('wrapped') && !nameLower.includes('bnb')) return true;
  if (coin.symbol.startsWith('USD') || coin.symbol.endsWith('USD')) return true;
  return false;
};

// Coins not on Binance USDT spot — explicit fallback (still Binance USDT format)
const BINANCE_FALLBACK: Record<string, string> = {
  HBAR: 'BINANCE:HBARUSDT',
  ICP:  'BINANCE:ICPUSDT',
  VET:  'BINANCE:VETUSDT',
  ALGO: 'BINANCE:ALGOUSDT',
  XTZ:  'BINANCE:XTZUSDT',
  EOS:  'BINANCE:EOSUSDT',
  IOTA: 'BINANCE:IOTAUSDT',
  ZIL:  'BINANCE:ZILUSDT',
  ONE:  'BINANCE:ONEUSDT',
  CELO: 'BINANCE:CELOUSDT',
};

const getTVSymbol = (symbol: string): string => {
  if (BINANCE_FALLBACK[symbol]) return BINANCE_FALLBACK[symbol];
  return `BINANCE:${symbol}USDT`;
};

export function useCoinMarketCap(refreshInterval = 60_000) {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchCoins = useCallback(async () => {
    try {
      setError(null);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/cmc-top50`, {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const raw: any[] = json.data ?? [];
      const filtered = raw
        .filter((c: any) => !isStable(c))
        .slice(0, 50)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          symbol: c.symbol,
          slug: c.slug,
          cmc_rank: c.cmc_rank,
          price: c.quote.USD.price,
          volume_24h: c.quote.USD.volume_24h,
          percent_change_1h: c.quote.USD.percent_change_1h,
          percent_change_24h: c.quote.USD.percent_change_24h,
          percent_change_7d: c.quote.USD.percent_change_7d,
          market_cap: c.quote.USD.market_cap,
          tvSymbol: getTVSymbol(c.symbol),
          rank_by_cap: c.rank_by_cap ?? 999,
          rank_by_volume: c.rank_by_volume ?? 999,
          is_top_cap: !!c.is_top_cap,
          is_top_volume: !!c.is_top_volume,
        } as CoinData));

      setCoins(filtered);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoins();
    const id = setInterval(fetchCoins, refreshInterval);
    return () => clearInterval(id);
  }, [fetchCoins, refreshInterval]);

  return { coins, loading, error, lastUpdated, refetch: fetchCoins };
}
