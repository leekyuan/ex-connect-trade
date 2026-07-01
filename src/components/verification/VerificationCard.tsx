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
    } catch (e: any) {
      setErr(e?.message ?? "검증 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { run(); /* eslint-disable-next-line */ }, [symbol]);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{symbol} · 전략 검증</h2>
          <p className="text-[11px] text-muted-foreground">1년 H1 · 수수료 0.04% · 슬리피지 0.05% 반영</p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && metrics && (
            allPass
              ? <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">검증 통과 · 실거래 가능</Badge>
              : <Badge className="bg-amber-500/15 text-amber-200 border border-amber-500/40">실거래 비추천 · 모의검증 필요</Badge>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
            <Stat label="Trades" value={metrics.trades.toString()} />
            <Stat label="Profit Factor" value={metrics.pf.toFixed(2)} />
            <Stat label="Win Rate" value={`${(metrics.winRate * 100).toFixed(1)}%`} />
            <Stat label="Avg R" value={metrics.avgR.toFixed(2)} />
            <Stat label="Max DD (R)" value={metrics.maxDD_R.toFixed(1)} />
            <Stat label="TP1 Hit" value={`${(metrics.tp1HitRate * 100).toFixed(1)}%`} />
            <Stat label="Long PF" value={metrics.longPF.toFixed(2)} />
            <Stat label="Short PF" value={metrics.shortPF.toFixed(2)} />
            <Stat label="OOS PF" value={metrics.oosPF.toFixed(2)} />
            <Stat label="Rolling30 PF" value={metrics.rolling30PF.toFixed(2)} />
            <Stat label="Top1~3 제거 PF" value={metrics.topRemovedPF.toFixed(2)} />
            <Stat label="수수료/슬리피지" value="반영" />
          </div>

          <div className="border-t border-border/50 pt-3">
            <div className="text-[11px] text-muted-foreground mb-2">실거래 권장 기준 (모두 통과해야 함)</div>
            <ul className="space-y-1 text-xs">
              {checks.map((c) => (
                <li key={c.key} className="flex items-center justify-between font-mono">
                  <span className="flex items-center gap-2">
                    {c.pass
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                    <span className={c.pass ? "" : "text-muted-foreground"}>{c.label}</span>
                  </span>
                  <span className={`tabular-nums ${c.pass ? "text-emerald-300" : "text-red-300"}`}>
                    {typeof c.actual === "number" ? c.actual.toFixed(c.actual < 5 ? 2 : 0) : c.actual}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {!allPass && (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-200/90">
              일부 기준 미달 — 본 전략은 <strong>실거래 비추천</strong>입니다.
              Paper Mode에서 추가 검증 후 사용하세요. 수익을 보장하지 않습니다.
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/50 bg-background/30 p-2">
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="tabular-nums font-semibold text-sm">{value}</div>
    </div>
  );
}
