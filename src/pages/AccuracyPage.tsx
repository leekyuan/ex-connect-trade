import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useSignalHistory, calcAccuracy, resolvePendingSignals } from "@/hooks/useSignalAccuracy";
import { useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBinanceTicker } from "@/hooks/useBinanceTicker";
import { Target, TrendingUp, TrendingDown, Clock, RefreshCw } from "lucide-react";

export default function AccuracyPage() {
  const { rows, loading, refresh } = useSignalHistory(500);
  const stats = useMemo(() => calcAccuracy(rows), [rows]);
  const tickers = useBinanceTicker();

  useEffect(() => {
    const priceMap: Record<string, number> = {};
    Object.entries(tickers).forEach(([s, t]: any) => { if (t?.lastPrice) priceMap[s] = Number(t.lastPrice); });
    if (Object.keys(priceMap).length) {
      resolvePendingSignals(priceMap).then(refresh);
    }
  }, [tickers]);

  const cards = [
    { label: "전체 신호", value: stats.total, icon: Target, color: "text-primary" },
    { label: "적중률", value: `${stats.winRate.toFixed(1)}%`, icon: TrendingUp, color: stats.winRate >= 50 ? "text-success" : "text-destructive" },
    { label: "평균 PnL", value: `${stats.avgPnl >= 0 ? "+" : ""}${stats.avgPnl.toFixed(2)}%`, icon: stats.avgPnl >= 0 ? TrendingUp : TrendingDown, color: stats.avgPnl >= 0 ? "text-success" : "text-destructive" },
    { label: "대기 중", value: stats.pending, icon: Clock, color: "text-warning" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">신호 적중률</h1>
            <p className="text-sm text-muted-foreground">발생한 모든 AI 신호의 결과를 추적합니다</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="h-4 w-4 mr-2" />새로고침</Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <p className={`text-2xl font-bold font-mono mt-2 ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <BreakdownCard title="방향별" data={[
            { label: "LONG", win: stats.bySide.LONG.win, total: stats.bySide.LONG.total },
            { label: "SHORT", win: stats.bySide.SHORT.win, total: stats.bySide.SHORT.total },
          ]} />
          <BreakdownCard title="강도별" data={Object.entries(stats.byStrength).map(([k, v]) => ({ label: k, win: v.win, total: v.total }))} />
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold">최근 신호 내역</h3>
            <span className="text-xs text-muted-foreground">{rows.length}개</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">로딩 중...</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">아직 기록된 신호가 없습니다. 마켓 스크리너에서 신호를 저장해보세요.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">시각</th>
                    <th className="text-left px-3 py-2">심볼</th>
                    <th className="text-left px-3 py-2">TF</th>
                    <th className="text-left px-3 py-2">방향</th>
                    <th className="text-right px-3 py-2">진입</th>
                    <th className="text-right px-3 py-2">SL/TP</th>
                    <th className="text-right px-3 py-2">신뢰도</th>
                    <th className="text-center px-3 py-2">결과</th>
                    <th className="text-right px-3 py-2">PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.slice(0, 100).map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-3 py-2 font-mono">{r.symbol}</td>
                      <td className="px-3 py-2 text-xs">{r.timeframe}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={r.side === "LONG" ? "border-success/40 text-success" : r.side === "SHORT" ? "border-destructive/40 text-destructive" : ""}>
                          {r.side}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">${r.entry_price.toFixed(4)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        <span className="text-destructive">{r.sl_price?.toFixed(2)}</span> / <span className="text-success">{r.tp1_price?.toFixed(2)}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{r.confidence}%</td>
                      <td className="px-3 py-2 text-center">
                        <ResultBadge status={r.status} />
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${(r.pnl_pct ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
                        {r.pnl_pct != null ? `${r.pnl_pct >= 0 ? "+" : ""}${Number(r.pnl_pct).toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function ResultBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    win: { label: "WIN", cls: "bg-success/15 text-success border-success/30" },
    loss: { label: "LOSS", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    pending: { label: "대기", cls: "bg-warning/15 text-warning border-warning/30" },
    expired: { label: "만료", cls: "bg-muted text-muted-foreground border-border" },
  };
  const v = map[status] ?? map.pending;
  return <Badge variant="outline" className={`text-[10px] ${v.cls}`}>{v.label}</Badge>;
}

function BreakdownCard({ title, data }: { title: string; data: { label: string; win: number; total: number }[] }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="space-y-2">
        {data.length === 0 && <p className="text-xs text-muted-foreground">데이터 없음</p>}
        {data.map((d) => {
          const wr = d.total ? (d.win / d.total) * 100 : 0;
          return (
            <div key={d.label} className="flex items-center justify-between text-sm">
              <span className="font-medium">{d.label}</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${wr}%` }} />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-24 text-right">{d.win}/{d.total} ({wr.toFixed(0)}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}