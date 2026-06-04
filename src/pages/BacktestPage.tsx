import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Bar, BarChart, ReferenceArea,
} from 'recharts';
import { FlaskConical, Play, TrendingUp, Loader2, Download, Sparkles, Shuffle, Target } from 'lucide-react';
import { MonthlyReturnsHeatmap } from '@/components/Backtest/MonthlyReturnsHeatmap';
import { MonteCarloBoxPlot } from '@/components/Backtest/MonteCarloBoxPlot';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { InfoTip } from '@/components/common/InfoTip';
import { useCoinMarketCap } from '@/hooks/useCoinMarketCap';
import { useBinanceSymbols } from '@/hooks/useBinanceSymbols';
import {
  runProfitFirstBacktest,
  pfTradesToCSV,
  type PFBacktestConfig,
  type PFBacktestResult,
  type Period,
} from '@/utils/profitFirstBacktest';
import { toast } from 'sonner';
import { BacktestWarnings } from '@/components/Backtest/BacktestWarnings';

const FALLBACK_COIN_LIST = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOGE', 'LINK', 'DOT', 'TRX', 'TON'];
const PERIODS: { label: string; value: Period }[] = [
  { label: '1개월', value: '1m' },
  { label: '3개월', value: '3m' },
  { label: '6개월', value: '6m' },
  { label: '1년', value: '1y' },
];

export default function BacktestPage() {
  const [params] = useSearchParams();
  const { coins: cmcCoins } = useCoinMarketCap(60_000);
  const { symbols: binanceSymbols, ready: binanceReady } = useBinanceSymbols();
  const COIN_LIST = useMemo(() => {
    const top = cmcCoins.slice(0, 30).map(c => c.symbol);
    const filtered = binanceReady && binanceSymbols.size > 0
      ? top.filter(s => binanceSymbols.has(s))
      : top;
    return filtered.length ? filtered : FALLBACK_COIN_LIST;
  }, [cmcCoins, binanceSymbols, binanceReady]);

  const [config, setConfig] = useState<PFBacktestConfig & { symbol: string; period: Period; initialCash: number }>({
    symbol: params.get('symbol') ?? 'BTC',
    period: '6m',
    initialCash: 10000,
    trailAtrMult: 3.0,
    partialExitPct: 0.4,
    useTrendFilter: true,
    strongSize: 0.6,
    normalSize: 0.25,
  });
  const [result, setResult] = useState<PFBacktestResult | null>(null);
  const [progress, setProgress] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const r = await runProfitFirstBacktest(config, setProgress);
      setResult(r);
      toast.success(`백테스트 완료 — ${r.metrics.totalReturnPct >= 0 ? '+' : ''}${r.metrics.totalReturnPct}%`);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setProgress('오류: ' + msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run if symbol came from deep link
  useEffect(() => {
    if (params.get('symbol') && !result && !loading) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadCsv = () => {
    if (!result) return;
    const csv = pfTradesToCSV(result.trades);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtest-${config.symbol}-${config.period}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const outperform = result ? result.metrics.totalReturnPct - result.metrics.buyHoldReturnPct : 0;

  return (
    <DashboardLayout>
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Settings */}
        <aside className="space-y-4 rounded-xl border border-border bg-card p-4 h-fit lg:sticky lg:top-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">수익률 우선 백테스트</h2>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">코인</label>
            <select
              value={config.symbol}
              onChange={(e) => setConfig(p => ({ ...p, symbol: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {COIN_LIST.map(s => <option key={s} value={s}>{s}/USDT</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">기간</label>
            <div className="grid grid-cols-4 gap-1">
              {PERIODS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setConfig(p => ({ ...p, period: opt.value }))}
                  className={`rounded-lg py-1.5 text-[11px] font-medium transition ${
                    config.period === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">초기 자금 (USDT)</label>
            <input
              type="number"
              value={config.initialCash}
              onChange={(e) => setConfig(p => ({ ...p, initialCash: Number(e.target.value) }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* ── Profit-First strategy controls ── */}
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <Target className="h-3.5 w-3.5" />
              수익률 극대화 옵션
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground flex items-center gap-1">
                  트레일링 ATR 배수
                  <InfoTip text="높을수록 큰 추세 끝까지 보유. 낮으면 빠른 익절." />
                </span>
                <span className="font-mono font-bold">{config.trailAtrMult.toFixed(1)}×</span>
              </div>
              <Slider
                value={[config.trailAtrMult]}
                onValueChange={([v]) => setConfig(p => ({ ...p, trailAtrMult: v }))}
                min={1} max={5} step={0.1}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground flex items-center gap-1">
                  TP1 부분익절
                  <InfoTip text="TP1 도달시 N% 청산, 나머지는 트레일." />
                </span>
                <span className="font-mono font-bold">{Math.round(config.partialExitPct * 100)}%</span>
              </div>
              <Slider
                value={[config.partialExitPct]}
                onValueChange={([v]) => setConfig(p => ({ ...p, partialExitPct: v }))}
                min={0} max={1} step={0.1}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                EMA200 추세 필터
                <InfoTip text="EMA200 위에서만 LONG, 아래에서만 SHORT." />
              </span>
              <Switch
                checked={config.useTrendFilter}
                onCheckedChange={(v) => setConfig(p => ({ ...p, useTrendFilter: v }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">강신호 사이즈</span>
                  <span className="font-mono">{Math.round(config.strongSize * 100)}%</span>
                </div>
                <Slider
                  value={[config.strongSize]}
                  onValueChange={([v]) => setConfig(p => ({ ...p, strongSize: v }))}
                  min={0.1} max={1} step={0.05}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">일반 사이즈</span>
                  <span className="font-mono">{Math.round(config.normalSize * 100)}%</span>
                </div>
                <Slider
                  value={[config.normalSize]}
                  onValueChange={([v]) => setConfig(p => ({ ...p, normalSize: v }))}
                  min={0.1} max={1} step={0.05}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 border border-border p-3 text-[11px] text-muted-foreground space-y-1">
            <div className="font-bold text-foreground">엔진 특징 (v2)</div>
            <div>· 4H봉 · 강신호(STRONG) 위주 진입</div>
            <div>· EMA200 추세 + 기울기 정렬 필터</div>
            <div>· 청산 후 3봉 쿨다운 (whipsaw 방지)</div>
            <div>· STRONG 반대신호만 OPP 청산</div>
            <div>· 수수료 0.04% · 슬리피지 0.05%</div>
          </div>

          <Button onClick={run} disabled={loading} className="w-full">
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{progress || '실행 중...'}</>
            ) : (
              <><Play className="mr-2 h-4 w-4" />백테스트 실행</>
            )}
          </Button>
        </aside>

        {/* Results */}
        <section className="rounded-xl border border-border bg-card p-4">
          {!result && !loading && (
            <div className="flex h-[60vh] flex-col items-center justify-center text-center">
              <TrendingUp className="mb-3 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">설정 후 백테스트를 실행하세요</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                수익률 우선 엔진 · 트레일링 스탑 · 워크포워드 · 몬테카를로 1000회
              </p>
            </div>
          )}

          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-lg" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
              </div>
              <Skeleton className="h-72 w-full rounded-lg" />
              <p className="text-center text-xs text-muted-foreground">{progress || '준비 중...'}</p>
            </div>
          )}

          {result && (
            <div className="space-y-5">
              <BacktestWarnings result={{
                totalTrades: result.metrics.totalTrades,
                winRate: result.metrics.winRatePct / 100,
                profitFactor: result.metrics.profitFactor,
                alpha: result.metrics.totalReturnPct - result.metrics.buyHoldReturnPct,
                inSampleReturn: result.walkForward[0]?.totalReturnPct ?? 0,
                outOfSampleReturn: result.walkForward[1]?.totalReturnPct ?? 0,
                mdd: result.metrics.maxDrawdownPct,
                sharpe: result.metrics.sharpe,
              }} />
              {/* Headline */}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-xs text-muted-foreground">전략 수익률</div>
                  <div className={`text-2xl font-bold ${result.metrics.totalReturnPct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {result.metrics.totalReturnPct >= 0 ? '+' : ''}{result.metrics.totalReturnPct}%
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">CAGR {result.metrics.cagr}%</div>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-xs text-muted-foreground">Buy &amp; Hold</div>
                  <div className={`text-2xl font-bold ${result.metrics.buyHoldReturnPct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {result.metrics.buyHoldReturnPct >= 0 ? '+' : ''}{result.metrics.buyHoldReturnPct}%
                  </div>
                </div>
                <div className={`rounded-lg border p-4 ${outperform >= 0 ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-red-500/40 bg-red-500/10'}`}>
                  <div className="text-xs text-muted-foreground">초과 수익 (α)</div>
                  <div className={`text-2xl font-bold ${outperform >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {outperform >= 0 ? '+' : ''}{outperform.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Metrics grid — color-coded */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Profit Factor" value={result.metrics.profitFactor.toFixed(2)}
                  tier={pfTier(result.metrics.profitFactor)}
                  tip="총 이익 / 총 손실. ≥1.5 우수, 1.0~1.5 보통, <1.0 손실." />
                <MetricCard label="승률" value={`${result.metrics.winRatePct}%`}
                  tier={result.metrics.winRatePct >= 55 ? 'green' : result.metrics.winRatePct >= 45 ? 'yellow' : 'red'} />
                <MetricCard label="Sharpe" value={result.metrics.sharpe.toFixed(2)}
                  tier={result.metrics.sharpe >= 1.5 ? 'green' : result.metrics.sharpe >= 1 ? 'yellow' : 'red'}
                  tip="위험조정 수익. ≥1.5 우수." />
                <MetricCard label="Sortino" value={result.metrics.sortino.toFixed(2)}
                  tier={result.metrics.sortino >= 2 ? 'green' : result.metrics.sortino >= 1 ? 'yellow' : 'red'}
                  tip="하방위험 조정 수익. ≥2 우수." />
                <MetricCard label="Calmar" value={result.metrics.calmar.toFixed(2)}
                  tier={result.metrics.calmar >= 1 ? 'green' : result.metrics.calmar >= 0.5 ? 'yellow' : 'red'}
                  tip="CAGR / MDD. ≥1 우수." />
                <MetricCard label="MDD" value={`${result.metrics.maxDrawdownPct}%`}
                  tier={result.metrics.maxDrawdownPct <= 10 ? 'green' : result.metrics.maxDrawdownPct <= 20 ? 'yellow' : 'red'}
                  tip="최대 낙폭. ≤10% 양호." />
                <MetricCard label="Expectancy" value={`${result.metrics.expectancy.toFixed(2)}%`}
                  tier={result.metrics.expectancy >= 0.5 ? 'green' : result.metrics.expectancy >= 0 ? 'yellow' : 'red'}
                  tip="거래당 평균 기대수익." />
                <MetricCard label="총 거래" value={String(result.metrics.totalTrades)}
                  tier={result.metrics.totalTrades >= 30 ? 'green' : result.metrics.totalTrades >= 10 ? 'yellow' : 'red'} />
              </div>

              {/* Equity curve with MDD shading */}
              {result.equityCurve.length > 0 && (
                <div className="rounded-lg border border-border bg-background p-4">
                  <h3 className="mb-3 text-sm font-semibold">수익 곡선 (전략 vs Buy &amp; Hold + MDD 음영)</h3>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={result.equityCurve}>
                      <defs>
                        <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis yAxisId="L" stroke="hsl(var(--muted-foreground))" fontSize={11}
                        tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                      <YAxis yAxisId="R" orientation="right" stroke="hsl(var(--destructive))" fontSize={11}
                        tickFormatter={(v) => `${v}%`} domain={[0, 'dataMax']} reversed />
                      <Tooltip
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                        formatter={(v: any, name: string) => {
                          if (name === 'drawdownPct') return [`-${v}%`, 'MDD'];
                          return [`$${Number(v).toLocaleString()}`, name === 'equity' ? '전략' : 'B&H'];
                        }}
                      />
                      <Legend formatter={(v) => v === 'equity' ? '전략' : v === 'bh' ? 'Buy & Hold' : 'Drawdown'} />
                      <Bar yAxisId="R" dataKey="drawdownPct" fill="hsl(var(--destructive))" fillOpacity={0.18} />
                      <Area yAxisId="L" type="monotone" dataKey="equity" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#eq)" />
                      <Area yAxisId="L" type="monotone" dataKey="bh" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} fillOpacity={0} strokeDasharray="4 4" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Monthly heatmap */}
              {result.monthlyReturns.length > 0 && (
                <div className="rounded-lg border border-border bg-background p-4">
                  <h3 className="mb-3 text-sm font-semibold">월별 수익률 히트맵</h3>
                  <MonthlyReturnsHeatmap data={result.monthlyReturns} />
                </div>
              )}

              {/* Walk-Forward — bar chart */}
              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-3 text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  워크포워드 분석 (In-Sample vs Out-of-Sample)
                  <InfoTip text="앞 70%로 학습한 전략이 뒤 30% 미지의 구간에서도 작동하는지 검증." />
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={result.walkForward}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any, name: string) => [`${v}%`, name === 'totalReturnPct' ? '전략' : 'B&H']}
                    />
                    <Legend formatter={(v) => v === 'totalReturnPct' ? '전략' : 'Buy & Hold'} />
                    <Bar dataKey="totalReturnPct" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="buyHoldReturnPct" fill="hsl(var(--muted-foreground))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-2 grid gap-2 md:grid-cols-2 text-[11px] text-muted-foreground">
                  {result.walkForward.map(w => (
                    <div key={w.label}>{w.label}: {w.trades}건 · 승률 {w.winRatePct}%</div>
                  ))}
                </div>
              </div>

              {/* Monte Carlo — boxplot */}
              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-3 text-sm font-semibold flex items-center gap-1.5">
                  <Shuffle className="h-4 w-4 text-primary" />
                  몬테카를로 시뮬레이션 (1000회) — 박스플롯
                  <InfoTip text="거래 순서를 무작위로 1000회 재배열한 결과 분포. 5%/25%/중간값/75%/95% 구간." />
                </h3>
                <MonteCarloBoxPlot mc={result.monteCarlo} />
                <div className="mt-3 grid gap-2 grid-cols-2 md:grid-cols-5 text-center">
                  <McMetric label="수익 확률" value={`${result.monteCarlo.probProfit}%`} color={result.monteCarlo.probProfit >= 60 ? 'text-emerald-500' : 'text-amber-500'} />
                  <McMetric label="중간값" value={`${result.monteCarlo.median}%`} />
                  <McMetric label="25%" value={`${result.monteCarlo.p25}%`} color="text-amber-500" />
                  <McMetric label="75%" value={`${result.monteCarlo.p75}%`} color="text-emerald-400" />
                  <McMetric label="최악 MDD" value={`${result.monteCarlo.worstDrawdown}%`} color="text-red-500" />
                </div>
              </div>

              {/* Trade table */}
              {result.trades.length > 0 && (
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">매매 내역 ({result.trades.length}건)</h3>
                    <Button size="sm" variant="outline" onClick={downloadCsv}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      CSV 내보내기
                    </Button>
                  </div>
                  <div className="max-h-96 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b border-border text-muted-foreground">
                          {['진입일', '청산일', '신호', '방향', '진입가', '청산가', '보유(h)', '청산사유', '수익률'].map(h => (
                            <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.trades.slice().reverse().map((t, i) => (
                          <tr key={i} className={`border-b border-border/50 ${t.pnlPct >= 0 ? 'bg-emerald-500/5' : 'bg-red-500/5'}`}>
                            <td className="px-2 py-1.5 font-mono text-[10px]">{t.entryDate.slice(5, 16).replace('T', ' ')}</td>
                            <td className="px-2 py-1.5 font-mono text-[10px]">{t.exitDate.slice(5, 16).replace('T', ' ')}</td>
                            <td className="px-2 py-1.5 text-[10px]">{t.signalLabel}</td>
                            <td className="px-2 py-1.5">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${t.side === 'LONG' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{t.side}</span>
                            </td>
                            <td className="px-2 py-1.5 font-mono">{t.entryPrice.toFixed(2)}</td>
                            <td className="px-2 py-1.5 font-mono">{t.exitPrice.toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-muted-foreground">{t.holdingHours}</td>
                            <td className="px-2 py-1.5 text-[10px] text-muted-foreground">{t.exitReason}</td>
                            <td className={`px-2 py-1.5 font-semibold ${t.pnlPct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

function Metric({ label, value, color = 'text-foreground', tip }: { label: string; value: string; color?: string; tip?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        {label}
        {tip && <InfoTip text={tip} />}
      </div>
      <div className={`text-lg font-bold ${color} mt-0.5`}>{value}</div>
    </div>
  );
}

function McMetric({ label, value, color = 'text-foreground' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-base font-bold ${color}`}>{value}</div>
    </div>
  );
}
