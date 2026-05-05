import { useEffect, useState } from 'react';
import { Loader2, TrendingUp, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { runProfitFirstBacktest, type PFBacktestResult, type Period } from '@/utils/profitFirstBacktest';

interface Props {
  symbol: string;
  /** 표시 라벨 (스캘핑/단타/스윙 등) */
  groupLabel?: string;
}

/**
 * 시장 분석 페이지 우측에 표시하는 "이 신호대로 매매했을 때" 미니 결과 카드.
 * 같은 통합 신호 엔진을 백테스트로 6개월 돌려서 핵심 지표만 보여줌.
 */
export function SignalBacktestCard({ symbol, groupLabel }: Props) {
  const [result, setResult] = useState<PFBacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('3m');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setResult(null);

    runProfitFirstBacktest(
      {
        symbol,
        period,
        initialCash: 10000,
        trailAtrMult: 3.0,
        partialExitPct: 0.4,
        useTrendFilter: true,
        strongSize: 0.6,
        normalSize: 0.25,
      },
      () => {}
    )
      .then(r => { if (alive) setResult(r); })
      .catch(e => { if (alive) setError(e?.message ?? '실패'); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [symbol, period]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">신호대로 매매했을 때</h3>
        </div>
        <div className="flex gap-1">
          {(['1m', '3m', '6m'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-[10px] px-2 py-0.5 rounded transition ${
                period === p
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {p === '1m' ? '1개월' : p === '3m' ? '3개월' : '6개월'}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        {symbol}/USDT · 4H봉 · 통합 신호 엔진(STRONG 필터) {groupLabel ? `· ${groupLabel}` : ''}
      </p>

      {loading && (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 백테스트 실행 중...
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive">실패: {error}</div>
      )}

      {result && !loading && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="전략 수익"
              value={`${result.metrics.totalReturnPct >= 0 ? '+' : ''}${result.metrics.totalReturnPct}%`}
              cls={result.metrics.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
            <Stat
              label="Buy & Hold"
              value={`${result.metrics.buyHoldReturnPct >= 0 ? '+' : ''}${result.metrics.buyHoldReturnPct}%`}
              cls={result.metrics.buyHoldReturnPct >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}
            />
            <Stat
              label="승률"
              value={`${result.metrics.winRatePct}%`}
              cls={result.metrics.winRatePct >= 50 ? 'text-emerald-400' : 'text-amber-400'}
            />
            <Stat
              label="Profit Factor"
              value={result.metrics.profitFactor.toFixed(2)}
              cls={result.metrics.profitFactor >= 1.3 ? 'text-emerald-400' : result.metrics.profitFactor >= 1 ? 'text-amber-400' : 'text-red-400'}
            />
            <Stat label="총 거래" value={String(result.metrics.totalTrades)} />
            <Stat
              label="MDD"
              value={`${result.metrics.maxDrawdownPct}%`}
              cls="text-red-400"
            />
          </div>

          <Link
            to={`/backtest?symbol=${symbol}`}
            className="flex items-center justify-center gap-1 text-[11px] text-primary hover:underline pt-1"
          >
            상세 백테스트 보기 <ExternalLink className="h-3 w-3" />
          </Link>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, cls = 'text-foreground' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-lg bg-background border border-border px-2.5 py-1.5">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className={`text-sm font-mono font-bold ${cls}`}>{value}</div>
    </div>
  );
}
