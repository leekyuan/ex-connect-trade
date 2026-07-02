import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { runUnifiedBacktest, type UnifiedBacktestResult } from "@/utils/unifiedBacktest";
import { computeGateMetrics, evaluateGates, type GateMetrics, type GateCheck } from "@/utils/verificationGates";
import { computeEligibility, type EligibilityResult } from "@/utils/tradeEligibility";
import { EligibilityBadge } from "@/components/common/EligibilityBadge";
import { BlockedReasonPanel } from "@/components/common/BlockedReasonPanel";

interface Props {
  symbol: string; // e.g. BTCUSDT
}

export function VerificationCard({ symbol }: Props) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState("준비 중...");
  const [result, setResult] = useState<UnifiedBacktestResult | null>(null);
  const [metrics, setMetrics] = useState<GateMetrics | null>(null);
  const [checks, setChecks] = useState<GateCheck[]>([]);
  const [allPass, setAllPass] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setErr(null);
    try {
      const sym = symbol.replace("USDT", "");
      const r = await runUnifiedBacktest({ symbol: sym, period: "1y", initialCash: 10000 }, setProgress);
      const m = computeGateMetrics(r);
      const ev = evaluateGates(m);
      setResult(r); setMetrics(m); setChecks(ev.checks); setAllPass(ev.allPass);
      setEligibility(computeEligibility(m, true));
    } catch (e: any) {
      setErr(e?.message ?? "검증 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { run(); /* eslint-disable-next-line */ }, [symbol]);

  // 실패 사유 한 줄 요약
  const failSummary = (() => {
    if (!metrics) return "";
    const parts: string[] = [];
    if (metrics.pf < 1.30) parts.push(`PF ${metrics.pf.toFixed(2)}`);
    if (metrics.avgR < 0.07) parts.push(`AvgR ${metrics.avgR.toFixed(2)}`);
    if (metrics.oosPF < 1.20) parts.push(`OOS PF ${metrics.oosPF.toFixed(2)}`);
    if (metrics.rolling30PF < 1.10) parts.push(`Rolling30 PF ${metrics.rolling30PF.toFixed(2)}`);
    if (metrics.tp1HitRate < 0.50) parts.push(`TP1 ${(metrics.tp1HitRate * 100).toFixed(0)}%`);
    if (parts.length === 0) return "";
    return `${parts.join(", ")}로 최소 기준 미달`;
  })();

  // 실패 항목 우선 정렬
  const sortedChecks = [...checks].sort((a, b) => Number(a.pass) - Number(b.pass));
  const finalVerdict: "PASSED" | "BLOCKED" = allPass ? "PASSED" : "BLOCKED";

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{symbol} · 전략 검증</h2>
          <p className="text-[11px] text-muted-foreground">1년 H1 · 수수료 0.04% · 슬리피지 0.05% 반영</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {eligibility && <EligibilityBadge state={eligibility.state} />}
          {!loading && metrics && (
            <Badge className={
              finalVerdict === "PASSED"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-bold tracking-wider"
                : "bg-red-500/15 text-red-300 border border-red-500/40 font-bold tracking-wider"
            }>
              최종: {finalVerdict}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={run} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> {progress}
        </div>
      )}

      {err && !loading && (
        <div className="text-sm text-destructive py-4">검증 실패: {err}</div>
      )}

      {metrics && !loading && (
        <>
          {/* 실패 사유 한 줄 요약 (상단) */}
          {finalVerdict === "BLOCKED" && failSummary && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-200 font-mono">
              <span className="font-bold">실패 사유 요약:</span> {failSummary}
            </div>
          )}

          {eligibility && <BlockedReasonPanel result={eligibility} />}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
            <Stat label="Trades" value={metrics.trades.toString()} />
            <Stat label="Profit Factor" value={metrics.pf.toFixed(2)} highlight={metrics.pf < 1.30 ? 'bad' : 'good'} />
            <Stat label="Win Rate" value={`${(metrics.winRate * 100).toFixed(1)}%`} />
            <Stat label="Avg R" value={metrics.avgR.toFixed(2)} highlight={metrics.avgR < 0.07 ? 'bad' : 'good'} />
            <Stat label="Max DD (R)" value={metrics.maxDD_R.toFixed(1)} highlight={metrics.maxDD_R > 10 ? 'bad' : 'good'} />
            <Stat label="TP1 Hit" value={`${(metrics.tp1HitRate * 100).toFixed(1)}%`} highlight={metrics.tp1HitRate < 0.5 ? 'bad' : 'good'} />
            <Stat label="Long PF" value={metrics.longPF.toFixed(2)} />
            <Stat label="Short PF" value={metrics.shortPF.toFixed(2)} />
            <Stat label="OOS PF" value={metrics.oosPF.toFixed(2)} highlight={metrics.oosPF < 1.20 ? 'bad' : 'good'} />
            <Stat label="Rolling30 PF" value={metrics.rolling30PF.toFixed(2)} highlight={metrics.rolling30PF < 1.10 ? 'bad' : 'good'} />
            <Stat label="Top1~3 제거 PF" value={metrics.topRemovedPF.toFixed(2)} />
            <Stat label="수수료/슬리피지" value="반영" />
          </div>

          <div className="border-t border-border/50 pt-3">
            <div className="text-[11px] text-muted-foreground mb-2">실거래 권장 기준 (실패 항목 우선 표시)</div>
            <ul className="space-y-1 text-xs">
              {sortedChecks.map((c) => (
                <li key={c.key} className={`flex items-center justify-between font-mono rounded px-2 py-1 ${c.pass ? '' : 'bg-red-500/5'}`}>
                  <span className="flex items-center gap-2">
                    {c.pass
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                    <span className={c.pass ? "" : "text-red-200"}>{c.label}</span>
                  </span>
                  <span className={`tabular-nums ${c.pass ? "text-emerald-300" : "text-red-300 font-bold"}`}>
                    {typeof c.actual === "number" ? c.actual.toFixed(c.actual < 5 ? 2 : 0) : c.actual}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {!allPass && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-[12px] text-red-100 leading-relaxed">
              <div className="font-bold text-red-200 mb-1">⚠ 이 전략은 실거래 불가</div>
              오늘의 신호 페이지, 차트 페이지에서도 동일하게 BLOCKED로 반영됩니다.
              Paper Mode에서 추가 검증 후 사용하세요. 수익을 보장하지 않습니다.
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: 'good' | 'bad' }) {
  const cls = highlight === 'bad'
    ? 'border-red-500/40 bg-red-500/10'
    : highlight === 'good'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : 'border-border/50 bg-background/30';
  const valCls = highlight === 'bad' ? 'text-red-300' : highlight === 'good' ? 'text-emerald-300' : '';
  return (
    <div className={`rounded border p-2 ${cls}`}>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`tabular-nums font-semibold text-sm ${valCls}`}>{value}</div>
    </div>
  );
}

