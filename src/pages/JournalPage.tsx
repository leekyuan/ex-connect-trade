import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useTradeJournal, JournalEntry } from "@/hooks/useTradeJournal";
import { useTradingRules } from "@/hooks/useTradingRules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2, BookOpen, Smile, Frown } from "lucide-react";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function JournalPage() {
  const { entries, loading, add, update, remove } = useTradeJournal();
  const { rules } = useTradingRules();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<JournalEntry>>({
    symbol: "BTCUSDT", side: "LONG", emotion_score: 5, followed_rules: true, outcome: "open",
  });

  const submit = async () => {
    await add(draft);
    setOpen(false);
    setDraft({ symbol: "BTCUSDT", side: "LONG", emotion_score: 5, followed_rules: true, outcome: "open" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary" />거래 일지</h1>
            <p className="text-sm text-muted-foreground">거래 전 계획과 거래 후 회고를 남기세요</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />새 일지</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>새 일지 작성</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="심볼 (BTCUSDT)" value={draft.symbol ?? ""} onChange={e => setDraft({ ...draft, symbol: e.target.value.toUpperCase() })} />
                  <Select value={draft.side ?? "LONG"} onValueChange={v => setDraft({ ...draft, side: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LONG">LONG</SelectItem>
                      <SelectItem value="SHORT">SHORT</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={draft.outcome ?? "open"} onValueChange={v => setDraft({ ...draft, outcome: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">진행 중</SelectItem>
                      <SelectItem value="win">수익</SelectItem>
                      <SelectItem value="loss">손실</SelectItem>
                      <SelectItem value="breakeven">본전</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea placeholder="📝 거래 전 계획 (왜 진입하는가? 진입가/손절/익절은?)" value={draft.entry_plan ?? ""} onChange={e => setDraft({ ...draft, entry_plan: e.target.value })} rows={3} />
                <Textarea placeholder="🔍 거래 후 회고 (잘한 점, 아쉬운 점)" value={draft.review ?? ""} onChange={e => setDraft({ ...draft, review: e.target.value })} rows={3} />
                <div>
                  <label className="text-xs text-muted-foreground flex items-center justify-between mb-1">
                    <span>감정 점수: {draft.emotion_score}/10</span>
                    <span className="flex gap-1"><Frown className="h-3 w-3" /> ↔ <Smile className="h-3 w-3" /></span>
                  </label>
                  <Slider min={1} max={10} step={1} value={[draft.emotion_score ?? 5]} onValueChange={([v]) => setDraft({ ...draft, emotion_score: v })} />
                </div>
                <Input type="number" step="0.01" placeholder="PnL %" value={draft.pnl_pct ?? ""} onChange={e => setDraft({ ...draft, pnl_pct: e.target.value ? Number(e.target.value) : null })} />
                {rules.filter(r => r.is_active).length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    활성 원칙 {rules.filter(r => r.is_active).length}개 적용 중 — 모두 지켰는지 체크하세요
                    <label className="flex items-center gap-2 mt-1">
                      <input type="checkbox" checked={draft.followed_rules ?? true} onChange={e => setDraft({ ...draft, followed_rules: e.target.checked })} />
                      <span>모든 원칙 준수</span>
                    </label>
                  </div>
                )}
              </div>
              <DialogFooter><Button onClick={submit}>저장</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        ) : entries.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">아직 작성된 일지가 없습니다.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {entries.map(e => (
              <div key={e.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{e.symbol}</span>
                    <Badge variant="outline" className={e.side === "LONG" ? "border-success/40 text-success" : "border-destructive/40 text-destructive"}>{e.side}</Badge>
                    <OutcomeBadge outcome={e.outcome} />
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(e.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                {e.entry_plan && <p className="text-xs"><span className="text-muted-foreground">📝 계획: </span>{e.entry_plan}</p>}
                {e.review && <p className="text-xs"><span className="text-muted-foreground">🔍 회고: </span>{e.review}</p>}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t border-border">
                  <span>감정 {e.emotion_score}/10</span>
                  <span>{e.followed_rules ? "✅ 원칙준수" : "⚠️ 원칙위반"}</span>
                  {e.pnl_pct != null && (
                    <span className={`font-mono ${e.pnl_pct >= 0 ? "text-success" : "text-destructive"}`}>
                      {e.pnl_pct >= 0 ? "+" : ""}{Number(e.pnl_pct).toFixed(2)}%
                    </span>
                  )}
                  <span className="ml-auto">{new Date(e.created_at).toLocaleDateString("ko-KR")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return null;
  const m: Record<string, { l: string; c: string }> = {
    win: { l: "수익", c: "border-success/40 text-success" },
    loss: { l: "손실", c: "border-destructive/40 text-destructive" },
    breakeven: { l: "본전", c: "border-warning/40 text-warning" },
    open: { l: "진행", c: "border-primary/40 text-primary" },
  };
  const v = m[outcome] ?? m.open;
  return <Badge variant="outline" className={`text-[10px] ${v.c}`}>{v.l}</Badge>;
}