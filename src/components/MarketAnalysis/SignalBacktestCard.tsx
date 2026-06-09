import { useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp, ExternalLink, ShieldCheck, ShieldAlert, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { runProfitFirstBacktest, type PFBacktestResult, type Period } from '@/utils/profitFirstBacktest';

interface Props {
  symbol: string;
  /** 표시 라벨 (스캘핑/단타/스윙 등) */
  groupLabel?: string;
}

const MIN_TRADES_FOR_TRUST = 30;
const MIN_PF_TRUST = 1.2;
const MIN_RECENT_PF_TRUST = 1.1;

/**
 * "신호대로 매매했을 때" 미니 결과 카드.
 * - 거래 수 < 30이면 "샘플 부족" 상태로 강조 표시
 * - 검증 통과 / 검증 부족 배지
 * - 수수료/슬리피지 반영 여부 명시 (펀딩비는 현물 시뮬이라 미반영)
 * - 최근 30거래 PF, OOS PF 등 신뢰도 보조 지표 노출
 */
export function SignalBacktestCard({ symbol, groupLabel }: Props) {
  const [result, setResult] = useState<PFBacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('6m');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setResult(null);

    runProfitFirstBacktest(
      {
        symbol, period,
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

  // 보조 지표 계산
  const derived = useMemo(() => {
    if (!result) return null;
    const trades = result.trades;
    const recent = trades.slice(-30);
    const pfOf = (arr: typeof trades) => {
      const w = arr.filter(t => t.pnlPct > 0).reduce((s, t) => s + t.pnlPct, 0);
      const l = arr.filter(t => t.pnlPct < 0).reduce((s, t) => s + Math.abs(t.pnlPct), 0);
      return l > 0 ? +(w / l).toFixed(2) : (w > 0 ? 999 : 0);
    };
    const recentPF = recent.length > 0 ? pfOf(recent) : 0;
    // avg R proxy: per-trade pnl% normalized by avg risk (= avgLossPct as proxy)
    const avgLoss = Math.abs(result.metrics.avgLossPct) || 1;
    const avgR = trades.length > 0
      ? +(trades.reduce((s, t) => s + t.pnlPct / avgLoss, 0) / trades.length).toFixed(2)
      : 0;
    const oos = result.walkForward.find(w => w.label.includes('Out-of-Sample'));
    return { recentPF, avgR, oosTrades: oos?.trades ?? 0, oosReturn: oos?.totalReturnPct ?? 0 };
  }, [result]);

  const totalTrades = result?.metrics.totalTrades ?? 0;
  const insufficient = !!result && totalTrades < MIN_TRADES_FOR_TRUST;
  const verified =
    !!result && totalTrades >= MIN_TRADES_FOR_TRUST &&
    result.metrics.profitFactor >= MIN_PF_TRUST &&
    (derived?.recentPF ?? 0) >= MIN_RECENT_PF_TRUST;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
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
                period === p ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {p === '1m' ? '1개월' : p === '3m' ? '3개월' : '6개월'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[10px] text-muted-foreground">
          {symbol}/USDT · 4H봉 · 통합 신호 엔진(STRONG 필터) {groupLabel ? `· ${groupLabel}` : ''}
        </p>
        {result && (
          verified ? (
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 inline-flex items-center gap-1 font-bold">
              <ShieldCheck className="h-3 w-3" /> 검증 통과
            </span>
          ) : insufficient ? (
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/40 inline-flex items-center gap-1 font-bold">
              <ShieldAlert className="h-3 w-3" /> 샘플 부족
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border inline-flex items-center gap-1 font-bold">
              <ShieldAlert className="h-3 w-3" /> 검증 부족
            </span>
          )
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 백테스트 실행 중...
        </div>
      )}

      {error && (
        <div className="text-xs text-muted-foreground">
          백테스트 결과를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.
        </div>
      )}

      {result && !loading && (
        <>
          {insufficient && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                총 거래 수가 {totalTrades}회로 부족하여 통계 신뢰도가 낮습니다.
                최소 {MIN_TRADES_FOR_TRUST}회 이상 거래가 누적되어야 신뢰 가능한 성과로 표시됩니다.
              </span>
            </div>
          )}

          <div className={`grid grid-cols-2 gap-2 ${insufficient ? 'opacity-70' : ''}`}>
            <Stat label="총 거래 수" value={String(totalTrades)} />
            <Stat
              label="승률"
              value={`${result.metrics.winRatePct}%`}
              cls={!insufficient && result.metrics.winRatePct >= 50 ? 'text-emerald-400' : 'text-foreground'}
            />
            <Stat
              label="Profit Factor"
              value={result.metrics.profitFactor.toFixed(2)}
              cls={!insufficient && result.metrics.profitFactor >= 1.3 ? 'text-emerald-400'
                : !insufficient && result.metrics.profitFactor >= 1 ? 'text-amber-400'
                : 'text-foreground'}
            />
            <Stat label="Avg R" value={`${derived && derived.avgR >= 0 ? '+' : ''}${derived?.avgR ?? 0}R`} />
            <Stat
              label="Max Drawdown"
              value={`${result.metrics.maxDrawdownPct}%`}
              cls="text-red-400"
            />
            <Stat
              label="최근 30거래 PF"
              value={derived?.recentPF ? derived.recentPF.toFixed(2) : '-'}
              cls={!insufficient && (derived?.recentPF ?? 0) >= 1.1 ? 'text-emerald-400' : 'text-foreground'}
            />
            <Stat label="OOS 거래" value={String(derived?.oosTrades ?? 0)} />
            <Stat
              label="OOS 수익률"
              value={`${(derived?.oosReturn ?? 0) >= 0 ? '+' : ''}${(derived?.oosReturn ?? 0).toFixed(1)}%`}
              cls={(derived?.oosReturn ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge text="수수료 반영" ok />
            <Badge text="슬리피지 반영" ok />
            <Badge text="펀딩비 반영" ok={false} note="현물 시뮬" />
            <Badge text={`데이터: ${period === '1m' ? '1개월' : period === '3m' ? '3개월' : '6개월'}`} ok />
          </div>

          <Link
            to={`/backtest?symbol=${symbol}`}
            className="flex items-center justify-center gap-1 text-[11px] text-primary hover:underline pt-1"
          >
            상세 백테스트 · Equity/Drawdown/거래 로그 보기 <ExternalLink className="h-3 w-3" />
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

function Badge({ text, ok, note }: { text: string; ok: boolean; note?: string }) {
  return (
    <span
      title={note}
      className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${
        ok
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          : 'bg-muted text-muted-foreground border-border'
      }`}
    >
      {ok ? '✓' : '○'} {text}{note && !ok ? ` (${note})` : ''}
    </span>
  );
}
