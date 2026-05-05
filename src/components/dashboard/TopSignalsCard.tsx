import { useMemo } from 'react';
import { useCoinMarketCap } from '@/hooks/useCoinMarketCap';
import { useScreenerScores } from '@/hooks/useScreenerScores';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Flame, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function TopSignalsCard() {
  const { coins } = useCoinMarketCap(60_000);
  const symbols = useMemo(() => coins.slice(0, 30).map(c => c.symbol), [coins]);
  const { scores } = useScreenerScores(symbols, 60_000);
  const navigate = useNavigate();

  const top5 = useMemo(() => {
    return Object.entries(scores)
      .filter(([, s]) => s != null)
      .map(([sym, s]) => ({ sym, ...s! }))
      .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
      .slice(0, 5);
  }, [scores]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-bold">오늘의 TOP 신호</h3>
        <span className="text-[10px] text-muted-foreground">60s 자동 갱신</span>
      </div>
      {top5.length === 0 ? (
        <div className="space-y-1.5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
      ) : (
        <div className="space-y-1.5">
          {top5.map(s => {
            const long = s.direction === 'LONG';
            const wait = s.direction === 'NEUTRAL';
            return (
              <button
                key={s.sym}
                onClick={() => navigate(`/market-analysis?symbol=${s.sym}`)}
                className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded-md bg-muted hover:bg-muted/70 transition"
              >
                <span className="font-bold text-foreground w-12 text-left">{s.sym}</span>
                <span className="text-muted-foreground w-12">
                  {s.strategy === 'SCALP' ? '스캘핑' : s.strategy === 'DAY' ? '단타' : '스윙'}
                </span>
                <Badge variant="outline" className={
                  long ? 'border-emerald-500/40 text-emerald-400' :
                  wait ? 'border-border text-muted-foreground' :
                  'border-red-500/40 text-red-400'
                }>
                  {long ? <TrendingUp className="h-3 w-3 mr-0.5" /> : !wait && <TrendingDown className="h-3 w-3 mr-0.5" />}
                  {long ? 'LONG' : wait ? 'WAIT' : 'SHORT'}
                </Badge>
                <span className="font-mono w-10 text-right">{s.score}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
