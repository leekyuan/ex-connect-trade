import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useTradingRules } from "@/hooks/useTradingRules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const CATEGORIES = [
  { value: "entry", label: "진입" },
  { value: "exit", label: "청산" },
  { value: "risk", label: "리스크" },
  { value: "psychology", label: "심리" },
  { value: "general", label: "일반" },
];

const PRESETS = [
  { text: "한 거래의 손실은 자본금의 2%를 넘지 않는다", category: "risk" },
  { text: "감정적으로 진입하지 않는다 (FOMO 금지)", category: "psychology" },
  { text: "추세와 반대 방향 매매는 하지 않는다", category: "entry" },
  { text: "손절선은 진입 전에 반드시 설정한다", category: "risk" },
  { text: "익절은 분할로 한다 (TP1 50%, TP2 50%)", category: "exit" },
  { text: "연속 3회 손절 시 그날은 거래 중단", category: "psychology" },
];

export default function RulesPage() {
  const { rules, loading, add, toggle, remove } = useTradingRules();
  const [text, setText] = useState("");
  const [cat, setCat] = useState("general");

  const submit = async () => {
    if (!text.trim()) return;
    await add(text.trim(), cat);
    setText("");
  };

  const grouped = CATEGORIES.map(c => ({
    ...c,
    items: rules.filter(r => r.category === c.value),
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" />매매 원칙</h1>
          <p className="text-sm text-muted-foreground">나만의 트레이딩 룰을 작성하고 거래마다 점검하세요</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold">새 원칙 추가</h3>
          <div className="flex gap-2">
            <Input value={text} onChange={e => setText(e.target.value)} placeholder="예: 손실은 자본금의 2%를 넘지 않는다" onKeyDown={e => e.key === "Enter" && submit()} />
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={submit}><Plus className="h-4 w-4" /></Button>
          </div>
          {rules.length === 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">추천 원칙 (클릭해서 추가):</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p, i) => (
                  <button key={i} onClick={() => add(p.text, p.category)} className="text-xs px-2 py-1 rounded bg-muted hover:bg-accent border border-border">
                    + {p.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        ) : (
          grouped.map(g => g.items.length > 0 && (
            <div key={g.value} className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold">{g.label}</h3>
                <Badge variant="outline" className="text-[10px]">{g.items.length}</Badge>
              </div>
              <div className="divide-y divide-border">
                {g.items.map(r => (
                  <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                    <Switch checked={r.is_active} onCheckedChange={(v) => toggle(r.id, v)} />
                    <span className={`flex-1 text-sm ${r.is_active ? "" : "text-muted-foreground line-through"}`}>{r.rule_text}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(r.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}