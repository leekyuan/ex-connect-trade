import { useMemo } from 'react';
import { useBinanceFunding } from '@/hooks/useBinanceFunding';
import { useCoinMarketCap } from '@/hooks/useCoinMarketCap';
import { Skeleton } from '@/components/ui/skeleton';
import { Percent } from 'lucide-react';

export function FundingRateWidget() {
  const funding = useBinanceFunding(60_000);
  const { coins } = useCoinMarketCap(60_000);

  const top30 = useMemo(() => coins.slice(0, 30).map(c => c.symbol), [coins]);

  const list = useMemo(() => {
    return top30
      .map(sym => ({ sym, fr: funding[`${sym}USDT`]?.fundingRate }))
      .filter(x => x.fr != null)
      .sort((a, b) => Math.abs(b.fr!) - Math.abs(a.fr!))
      .slice(0, 12);
  }, [top30, funding]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Percent className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">펀딩비 현황 (Binance Futures)</h3>
      </div>
      {list.length === 0 ? (
        <div className="space-y-1">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {list.map(({ sym, fr }) => {
            const pct = (fr! * 100);
            const cls = pct > 0.05 ? 'text-red-400' : pct < -0.05 ? 'text-emerald-400' : 'text-muted-foreground';
            return (
              <div key={sym} className="flex items-center justify-between border-b border-border/40 py-1">
                <span className="font-mono text-foreground">{sym}</span>
                <span className={`font-mono font-semibold ${cls}`}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(4)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        🔴 +0.05% 초과 = 롱 과열 · 🟢 -0.05% 미만 = 숏 과열 → 평균회귀 스캘프 기회
      </p>
    </div>
  );
}
