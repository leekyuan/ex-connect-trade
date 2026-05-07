import { useEffect, useMemo, useState } from 'react';
import { useCoinMarketCap } from '@/hooks/useCoinMarketCap';
import { useBinanceTicker } from '@/hooks/useBinanceTicker';
import { useBinanceSymbols } from '@/hooks/useBinanceSymbols';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { Flame, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

const REFRESH_MS = 60_000;

function tileColor(ch: number): string {
  if (ch > 3) return 'bg-emerald-700/80 hover:bg-emerald-600 border-emerald-500/40';
  if (ch > 1) return 'bg-emerald-900/60 hover:bg-emerald-800/80 border-emerald-700/40';
  if (ch >= -1) return 'bg-muted hover:bg-muted/70 border-border';
  if (ch >= -3) return 'bg-red-900/60 hover:bg-red-800/80 border-red-700/40';
  return 'bg-red-700/80 hover:bg-red-600 border-red-500/40';
}

export function Top30Heatmap() {
  const { coins, loading, lastUpdated, error } = useCoinMarketCap(REFRESH_MS);
  const tickers = useBinanceTicker(15_000);
  const { symbols: binanceSymbols } = useBinanceSymbols();
  const navigate = useNavigate();

  const top30 = useMemo(() => coins.slice(0, 30), [coins]);

  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  useEffect(() => {
    const id = setInterval(() => setCountdown(c => (c <= 1 ? REFRESH_MS / 1000 : c - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { setCountdown(REFRESH_MS / 1000); }, [lastUpdated]);

  const lastErrRef = useState<string | null>(null);
  useEffect(() => {
    if (error && error !== lastErrRef[0]) {
      toast.error('데이터 갱신 실패', { description: error });
      lastErrRef[1](error);
    }
  }, [error]);

  if (loading && top30.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {Array.from({ length: 30 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  const maxCap = Math.max(...top30.map(c => c.market_cap));
  const updatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '—';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="text-[11px] text-muted-foreground">
          마지막 갱신: <span className="font-mono text-foreground">{updatedStr}</span>
          <span className="ml-2 opacity-70">다음 갱신 {countdown}s</span>
        </div>
        <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${countdown > REFRESH_MS / 1000 - 2 ? 'animate-spin' : ''}`} />
      </div>
      <Progress value={((REFRESH_MS / 1000 - countdown) / (REFRESH_MS / 1000)) * 100} className="h-1" />
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {top30.map(c => {
          const t = tickers[`${c.symbol}USDT`];
          const change = t?.priceChangePercent ?? c.percent_change_24h;
          const price = t?.lastPrice ?? c.price;
          const sizeRatio = c.market_cap / maxCap;
          const big = sizeRatio > 0.4;
          const onBinance = binanceSymbols.has(c.symbol);
          return (
            <button
              key={c.id}
              onClick={() => navigate(`/market-analysis?symbol=${c.symbol}`)}
              className={`group rounded-lg border ${tileColor(change)} text-left p-3 transition-all duration-200 relative`}
            >
              {!onBinance && (
                <span className="absolute top-1 right-1 text-[8px] px-1 py-0.5 rounded bg-background/60 text-muted-foreground">
                  폴백
                </span>
              )}
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
    </div>
  );
}
