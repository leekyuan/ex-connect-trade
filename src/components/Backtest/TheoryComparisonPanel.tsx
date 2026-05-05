import { useState } from 'react';
import { Loader2, Layers, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { runTheoryComparison, type TheoryBacktestResult } from '@/utils/backtestTheory';
import type { Candle } from '@/utils/indicators';
import { THEORY_LABELS, getStoredWeights } from '@/hooks/useTheoryWeights';

interface Props {
  candles: Candle[] | null;
  feePct: number;
  slippagePct: number;
}

export function TheoryComparisonPanel({ candles, feePct, slippagePct }: Props) {
  const [result, setResult] = useState<TheoryBacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [minConf, setMinConf] = useState(60);
  const [rr, setRr] = useState(2);

  const run = () => {
    if (!candles || candles.length < 30) return;
    setLoading(true);
    // Defer heavy work so the spinner shows
    setTimeout(() => {
      const r = runTheoryComparison(candles, {
        feePctPerSide: feePct,
        slippagePctPerSide: slippagePct,
        minConfidence: minConf,
        rrMultiple: rr,
        weights: getStoredWeights(),
        minConfirmIntegrated: 2,
      });
      setResult(r);
      setLoading(false);
    }, 50);
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold">이론별 성과 비교</h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <label className="text-muted-foreground">최소 신뢰도</label>
            <input
              type="range" min={50} max={90} step={5}
              value={minConf}
              onChange={e => setMinConf(Number(e.target.value))}
              className="w-24 accent-primary"
            />
            <span className="font-mono text-primary">{minConf}%</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-muted-foreground">R:R</label>
            <select
              value={rr}
              onChange={e => setRr(Number(e.target.value))}
              className="rounded border border-border bg-card px-2 py-1 text-xs"
            >
              {[1.5, 2, 2.5, 3].map(v => <option key={v} value={v}>1 : {v}</option>)}
            </select>
          </div>
          <Button size="sm" onClick={run} disabled={loading || !candles || candles.length < 30}>
            {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
            비교 실행
          </Button>
        </div>
      </div>

      {!result && !loading && (
        <p className="text-xs text-muted-foreground">
          위 백테스트와 동일한 캔들 데이터에서 각 이론별·통합 신호의 성과를 비교합니다.
          (수수료 {feePct}% · 슬리피지 {slippagePct}% · 룩어헤드 차단)
        </p>
      )}

      {result && (
        <>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-2 py-2 text-left font-medium">이론</th>
                  <th className="px-2 py-2 text-right font-medium">신호 수</th>
                  <th className="px-2 py-2 text-right font-medium">거래</th>
                  <th className="px-2 py-2 text-right font-medium">승률</th>
                  <th className="px-2 py-2 text-right font-medium">PF</th>
                  <th className="px-2 py-2 text-right font-medium">평균 R</th>
                  <th className="px-2 py-2 text-right font-medium">MDD</th>
                  <th className="px-2 py-2 text-right font-medium">누적 수익</th>
                </tr>
              </thead>
              <tbody>
                {result.perTheory.map(s => (
                  <tr key={s.theory} className="border-b border-border/50">
                    <td className="px-2 py-1.5 font-medium">{THEORY_LABELS[s.theory as keyof typeof THEORY_LABELS] ?? s.theory}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{s.signals}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{s.trades}</td>
                    <td className={`px-2 py-1.5 text-right font-mono ${s.winRatePct >= 50 ? 'text-success' : 'text-destructive'}`}>{s.winRatePct}%</td>
                    <td className={`px-2 py-1.5 text-right font-mono ${s.profitFactor >= 1.3 ? 'text-success' : s.profitFactor >= 1 ? 'text-warning' : 'text-destructive'}`}>{s.profitFactor}</td>
                    <td className={`px-2 py-1.5 text-right font-mono ${s.avgR >= 0 ? 'text-success' : 'text-destructive'}`}>{s.avgR}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-warning">{s.maxDrawdownPct}%</td>
                    <td className={`px-2 py-1.5 text-right font-mono font-semibold ${s.totalReturnPct >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {s.totalReturnPct >= 0 ? '+' : ''}{s.totalReturnPct}%
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-primary/40 bg-primary/5 font-semibold">
                  <td className="px-2 py-2">통합 신호 (가중치)</td>
                  <td className="px-2 py-2 text-right font-mono">{result.integrated.signals}</td>
                  <td className="px-2 py-2 text-right font-mono">{result.integrated.trades}</td>
                  <td className={`px-2 py-2 text-right font-mono ${result.integrated.winRatePct >= 50 ? 'text-success' : 'text-destructive'}`}>{result.integrated.winRatePct}%</td>
                  <td className="px-2 py-2 text-right font-mono">{result.integrated.profitFactor}</td>
                  <td className="px-2 py-2 text-right font-mono">{result.integrated.avgR}</td>
                  <td className="px-2 py-2 text-right font-mono text-warning">{result.integrated.maxDrawdownPct}%</td>
                  <td className={`px-2 py-2 text-right font-mono ${result.integrated.totalReturnPct >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {result.integrated.totalReturnPct >= 0 ? '+' : ''}{result.integrated.totalReturnPct}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Confidence buckets */}
          <div>
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">신뢰도 구간별 승률</h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {result.confidenceBuckets.map(b => (
                <div key={b.label} className="rounded border border-border bg-card p-2.5">
                  <div className="text-[10px] text-muted-foreground">{b.label}</div>
                  <div className={`text-lg font-bold ${b.winRatePct >= 50 ? 'text-success' : 'text-destructive'}`}>{b.winRatePct}%</div>
                  <div className="text-[10px] text-muted-foreground">{b.trades}건 · 평균 {b.avgPnlPct >= 0 ? '+' : ''}{b.avgPnlPct}%</div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            * 캔들 1개당 최대 1개 거래 · ATR×1.5 SL · TP = SL 거리×R · 룩어헤드 차단 (다음 캔들 open 진입)
          </p>
        </>
      )}
    </div>
  );
}
