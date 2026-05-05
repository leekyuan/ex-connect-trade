import { useMemo } from 'react';
import { useCoinMarketCap } from '@/hooks/useCoinMarketCap';
import { useBinanceTicker } from '@/hooks/useBinanceTicker';
import { useBinanceSymbols } from '@/hooks/useBinanceSymbols';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { Flame } from 'lucide-react';

function tileColor(ch: number): string {
  if (ch > 5) return 'bg-emerald-700/80 hover:bg-emerald-600 border-emerald-500/40';
  if (ch > 1) return 'bg-emerald-900/60 hover:bg-emerald-800/80 border-emerald-700/40';
  if (ch >= -1) return 'bg-muted hover:bg-muted/70 border-border';
  if (ch >= -5) return 'bg-red-900/60 hover:bg-red-800/80 border-red-700/40';
  return 'bg-red-700/80 hover:bg-red-600 border-red-500/40';
}

export function Top30Heatmap() {
  const { coins, loading } = useCoinMarketCap(60_000);
  const tickers = useBinanceTicker(15_000);
  const { symbols: binanceSymbols, ready: binanceReady } = useBinanceSymbols();
  const navigate = useNavigate();

  const top30 = useMemo(() => {
    // Binance USDT 현물에 있는 것만
    const filtered = binanceReady && binanceSymbols.size > 0
      ? coins.filter(c => binanceSymbols.has(c.symbol))
      : coins;
    return filtered.slice(0, 30);
  }, [coins, binanceSymbols, binanceReady]);

  if (loading && top30.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {Array.from({ length: 30 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  // 시총 범위 정규화 (타일 크기 가중치)
  const maxCap = Math.max(...top30.map(c => c.market_cap));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
      {top30.map(c => {
        const t = tickers[`${c.symbol}USDT`];
        const change = t?.priceChangePercent ?? c.percent_change_24h;
        const price = t?.lastPrice ?? c.price;
        const sizeRatio = c.market_cap / maxCap;
        const big = sizeRatio > 0.4;
        return (
          <button
            key={c.id}
            onClick={() => navigate(`/market-analysis?symbol=${c.symbol}`)}
            className={`group rounded-lg border ${tileColor(change)} text-left p-3 transition-all duration-200`}
          >
            <div className="flex items-center justify-between">
              <span className={`font-bold text-foreground ${big ? 'text-base' : 'text-sm'}`}>{c.symbol}</span>
              {Math.abs(change) > 8 && <Flame className="h-3 w-3 text-amber-300" />}
            </div>
            <div className={`font-mono text-foreground/90 ${big ? 'text-sm mt-1' : 'text-xs'}`}>
              ${price >= 1 ? price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : price.toFixed(4)}
            </div>
            <div className={`font-mono font-semibold ${change >= 0 ? 'text-emerald-200' : 'text-red-200'} text-xs`}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </div>
          </button>
        );
      })}
    </div>
  );
}
