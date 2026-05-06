import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Waves, BarChart3 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCoinMarketCap } from '@/hooks/useCoinMarketCap';
import { useBinanceSymbols } from '@/hooks/useBinanceSymbols';
import { UnifiedSignalPanel } from '@/components/MarketAnalysis/UnifiedSignalPanel';
import SmartTradingViewChart from '@/components/chart/SmartTradingViewChart';
import { NeoWaveChart } from '@/components/MarketAnalysis/NeoWaveChart';
import { NeoWaveScenarioPanel } from '@/components/MarketAnalysis/NeoWaveScenarioPanel';
import { HarmonicPatternPanel } from '@/components/MarketAnalysis/HarmonicPatternPanel';
import { SignalBacktestCard } from '@/components/MarketAnalysis/SignalBacktestCard';
import { MasterTradePlanCard } from '@/components/MarketAnalysis/MasterTradePlanCard';
import { IctWyckoffMonitor } from '@/components/MarketAnalysis/IctWyckoffMonitor';
import { AITradingAssistant } from '@/components/dashboard/AITradingAssistant';
import { Skeleton } from '@/components/ui/skeleton';
import { LABEL_META } from '@/utils/unifiedSignal';
import { buildMasterPlan } from '@/utils/masterPlan';
import {
  computeMultiTfSignal, STYLE_GROUPS,
  type StyleGroup, type MultiTfSignal, type TfDef,
} from '@/utils/multiTfSignal';
import { useRealtimeNeoWave } from '@/hooks/useRealtimeNeoWave';
import { analyzeICT } from '@/utils/theories/ict';
import { analyzeWyckoff } from '@/utils/theories/wyckoff';
import type { NeoWaveScenario } from '@/utils/theories/neely';

const FALLBACK_COINS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOGE', 'LINK', 'DOT', 'TRX', 'TON'];
type ChartView = 'neowave' | 'tv';

export default function MarketAnalysisPage() {
  const [params, setParams] = useSearchParams();
  const initialSymbol = (params.get('symbol') || 'BTC').toUpperCase();
  const [symbol, setSymbol] = useState(initialSymbol);
  const { coins: cmcCoins } = useCoinMarketCap(60_000);
  const { symbols: binanceSymbols, ready: binanceReady } = useBinanceSymbols();
  // CMC TOP 30 전부 노출 (Binance 미상장은 회색 표시)
  const coinList = useMemo(() => {
    const top = cmcCoins.slice(0, 30).map(c => c.symbol);
    return top.length ? top : FALLBACK_COINS;
  }, [cmcCoins]);
  const isOnBinance = (s: string) =>
    !binanceReady || binanceSymbols.size === 0 || binanceSymbols.has(s);

  // sync url ↔ state
  useEffect(() => {
    const urlSym = (params.get('symbol') || '').toUpperCase();
    if (urlSym && urlSym !== symbol) setSymbol(urlSym);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  useEffect(() => {
    if (params.get('symbol') !== symbol) {
      const np = new URLSearchParams(params);
      np.set('symbol', symbol);
      setParams(np, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const [group, setGroup] = useState<StyleGroup>('daytrading');
  const [activeTf, setActiveTf] = useState<TfDef>(STYLE_GROUPS.daytrading.tfs[1]); // default 4h
  const [multi, setMulti] = useState<MultiTfSignal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartView, setChartView] = useState<ChartView>('neowave');
  const [scenarioId, setScenarioId] = useState<NeoWaveScenario['id']>('base');

  // 실시간 Neo-Wave 분석 (활성 봉 기준)
  const neo = useRealtimeNeoWave(symbol, activeTf.binance);


  // 그룹 변경 시 차트 활성 TF도 그 그룹의 중간 TF로 리셋
  useEffect(() => {
    setActiveTf(STYLE_GROUPS[group].tfs[1]);
  }, [group]);

  // 멀티-TF 신호 fetch
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setMulti(null);
    computeMultiTfSignal(symbol, group)
      .then(m => { if (alive) setMulti(m); })
      .catch((e) => alive && setError(e.message ?? '분석 실패'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [symbol, group]);

  const tvSymbol = `BINANCE:${symbol}USDT`;
  const meta = multi ? LABEL_META[multi.label] : null;

  // ── Master Trade Plan (1/2차 진입·익절·손절) ──
  const currentPrice = neo.candles[neo.candles.length - 1]?.close ?? multi?.primarySignal?.entry ?? 0;
  const masterPlan = useMemo(
    () => buildMasterPlan(multi, neo.candles, currentPrice),
    [multi, neo.candles, currentPrice],
  );

  // ── AI 코치 컨텍스트 ──
  const aiContext = useMemo(() => {
    if (!multi || !masterPlan) return undefined;
    const lines: string[] = [];
    lines.push(`코인: ${symbol}/USDT  현재가: ${currentPrice}`);
    lines.push(`타임프레임 그룹: ${STYLE_GROUPS[group].label} (주봉 ${activeTf.label})`);
    lines.push(`통합 신호: ${LABEL_META[multi.label].ko} (점수 ${multi.weightedScore}/100, ${multi.agreement}/${multi.perTf.length} TF 일치)`);
    lines.push(`최종 플랜 [${masterPlan.side}] 신뢰도 ${masterPlan.confidence}%`);
    if (masterPlan.side !== 'WAIT') {
      lines.push(`  · 1차 진입 ${masterPlan.entry1} (${masterPlan.positionPlan.entry1Pct}%) / 2차 진입 ${masterPlan.entry2} (${masterPlan.positionPlan.entry2Pct}%)`);
      lines.push(`  · 1차 익절 ${masterPlan.tp1} / 2차 익절 ${masterPlan.tp2}  (R:R ${masterPlan.rrTp1}/${masterPlan.rrTp2})`);
      lines.push(`  · 1차 손절 ${masterPlan.sl1} (절반 컷) / 2차 손절 ${masterPlan.sl2} (전량)`);
    }
    if (neo.candles.length >= 30) {
      const ict = analyzeICT(neo.candles, currentPrice);
      const wy = analyzeWyckoff(neo.candles, currentPrice);
      lines.push(`ICT: ${ict.signal} ${ict.confidence}% — ${ict.reason}`);
      lines.push(`와이코프: ${wy.signal} ${wy.confidence}% — ${wy.reason}`);
    }
    return lines.join('\n');
  }, [multi, masterPlan, symbol, currentPrice, group, activeTf, neo.candles]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* ── 1행: 코인 + 매매 스타일 그룹 ── */}
        <div className="rounded-xl border border-border bg-card p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">코인</label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-bold"
              >
                {coinList.map((c) => {
                  const ok = isOnBinance(c);
                  return (
                    <option key={c} value={c} disabled={!ok}>
                      {c}/USDT{ok ? '' : ' (Binance 미상장)'}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 매매 스타일 그룹 (스캘핑/단타/스윙) */}
            <div className="flex items-center gap-1">
              {(Object.keys(STYLE_GROUPS) as StyleGroup[]).map((g) => {
                const def = STYLE_GROUPS[g];
                return (
                  <button
                    key={g}
                    onClick={() => setGroup(g)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1 ${
                      group === g
                        ? 'bg-primary text-primary-foreground shadow'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    }`}
                    title={def.tfs.map(t => t.label).join(' / ')}
                  >
                    <span>{def.emoji}</span>
                    <span>{def.label}</span>
                  </button>
                );
              })}
            </div>

            {loading && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                <Loader2 className="h-3 w-3 animate-spin" /> 분석 중...
              </span>
            )}
          </div>

          {/* 차트용 봉 선택 (그룹 내 3개) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-muted-foreground">차트 봉</span>
            {STYLE_GROUPS[group].tfs.map((tf) => (
              <button
                key={tf.binance}
                onClick={() => setActiveTf(tf)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  activeTf.binance === tf.binance
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {tf.label}
                <span className="ml-1 text-[9px] opacity-70">×{tf.weight}</span>
              </button>
            ))}
            <span className="text-[10px] text-muted-foreground ml-2">
              ※ HTF 가중치: 높은 봉일수록 통합 점수에 더 크게 반영됩니다
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            데이터 로드 실패: {error}
          </div>
        )}

        {/* ── 멀티-TF 요약 카드 ── */}
        {multi && meta && (
          <div className={`rounded-xl border-2 ${meta.border} ${meta.bg} p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] text-muted-foreground">
                  {symbol}/USDT · {STYLE_GROUPS[multi.group].emoji} {STYLE_GROUPS[multi.group].label} · HTF 가중 통합
                </div>
                <div className={`text-2xl font-black ${meta.cls} flex items-center gap-2`}>
                  <span>{meta.emoji}</span>
                  <span>{meta.ko}</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    {multi.weightedScore}/100
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{multi.comment}</div>
              </div>

              {/* 각 TF 미니 배지 */}
              <div className="flex items-center gap-2">
                {multi.perTf.map((p) => {
                  const sigMeta = p.signal ? LABEL_META[p.signal.label] : null;
                  return (
                    <div
                      key={p.tf.binance}
                      className={`rounded-lg px-2.5 py-1.5 text-center min-w-[68px] border ${
                        sigMeta ? `${sigMeta.border} ${sigMeta.bg}` : 'border-border bg-muted'
                      }`}
                      title={p.error ?? ''}
                    >
                      <div className="text-[9px] text-muted-foreground">
                        {p.tf.label} <span className="opacity-70">×{p.tf.weight}</span>
                      </div>
                      <div className={`text-xs font-bold ${sigMeta?.cls ?? 'text-muted-foreground'}`}>
                        {sigMeta ? `${sigMeta.emoji} ${sigMeta.ko}` : '—'}
                      </div>
                      {p.signal && (
                        <div className="text-[9px] font-mono text-muted-foreground">{p.signal.score}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 차트 영역 (Neo-Wave ↔ TradingView) ── */}
        <div className="rounded-xl border border-border bg-card p-2 flex items-center gap-2">
          <button
            onClick={() => setChartView('neowave')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
              chartView === 'neowave'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            <Waves className="h-3.5 w-3.5" /> Neo-Wave 분석 차트
          </button>
          <button
            onClick={() => setChartView('tv')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
              chartView === 'tv'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" /> TradingView (지표 자유 추가)
          </button>
          {chartView === 'neowave' && neo.live && (
            <span className="ml-auto text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              실시간 분석 중 · {activeTf.label}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
          <div>
            {chartView === 'neowave' ? (
              neo.loading ? (
                <Skeleton className="h-[560px] w-full rounded-xl" />
              ) : (
                <NeoWaveChart
                  candles={neo.candles}
                  result={neo.result}
                  highlightedScenario={scenarioId}
                  height={560}
                />
              )
            ) : (
              <div className="overflow-hidden">
                <SmartTradingViewChart
                  baseSymbol={symbol}
                  interval={activeTf.tv}
                  isFutures
                  height={560}
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* 최종 매매 플랜 — 모든 뷰 공통 */}
            <MasterTradePlanCard plan={masterPlan} symbol={symbol} currentPrice={currentPrice} />

            {/* ICT/와이코프 실시간 모니터 */}
            <IctWyckoffMonitor
              candles={neo.candles}
              currentPrice={currentPrice}
              live={neo.live}
              lastUpdate={neo.lastUpdate}
            />

            {chartView === 'neowave' ? (
              <>
                <NeoWaveScenarioPanel
                  result={neo.result}
                  currentPrice={currentPrice}
                  selectedId={scenarioId}
                  onSelect={setScenarioId}
                  live={neo.live}
                  lastUpdate={neo.lastUpdate}
                />
                <HarmonicPatternPanel
                  candles={neo.candles}
                  currentPrice={currentPrice}
                />
                <SignalBacktestCard symbol={symbol} groupLabel={STYLE_GROUPS[group].label} />
              </>
            ) : (
              loading && !multi ? (
                <div className="space-y-3">
                  <Skeleton className="h-32 w-full rounded-xl" />
                  <Skeleton className="h-40 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              ) : (
                <>
                  <UnifiedSignalPanel
                    symbol={`${symbol} · ${multi?.primaryTf.label ?? ''}`}
                    signal={multi?.primarySignal ?? null}
                    loading={loading}
                  />
                  <SignalBacktestCard symbol={symbol} groupLabel={STYLE_GROUPS[group].label} />
                </>
              )
            )}
          </div>
        </div>

        {/* AI 코치 — 시장분석 컨텍스트 주입 */}
        <AITradingAssistant
          embedded
          context={aiContext}
          subtitle={`${symbol} 분석 컨텍스트 자동 주입 · Lovable AI`}
        />
      </div>
    </DashboardLayout>
  );
}
