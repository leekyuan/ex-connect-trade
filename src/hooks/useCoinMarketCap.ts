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

/**
 * 사양: USDT, USDC, BUSD, DAI, TUSD, FDUSD, USDP, USDD, GUSD, PYUSD,
 *       FRAX, LUSD, USDE, CRVUSD, SUSD, USDJ, CUSD, AUSD, USDS, USDX (정확 20종)
 * + Wrapped/LST 파생토큰(ETH/BTC 가격을 그대로 따라가는 것들)도 분석 무의미하므로 별도 제외
 */
const STABLECOINS_20 = new Set([
  'USDT','USDC','BUSD','DAI','TUSD','FDUSD','USDP','USDD','GUSD','PYUSD',
  'FRAX','LUSD','USDE','CRVUSD','SUSD','USDJ','CUSD','AUSD','USDS','USDX',
]);
const WRAPPED_DERIVATIVES = new Set([
  'STETH','WSTETH','RETH','CBETH','WBETH','BETH','FRXETH','SFRXETH','SWETH','ANKRETH','OSETH','WEETH','EZETH',
  'WBTC','BTCB','HBTC','RENBTC','TBTC',
  'WETH','WBNB',
]);

const isStable = (coin: { symbol: string; name?: string }): boolean => {
  const sym = (coin.symbol || '').toUpperCase();
  return STABLECOINS_20.has(sym) || WRAPPED_DERIVATIVES.has(sym);
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
