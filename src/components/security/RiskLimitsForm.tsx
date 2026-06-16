import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";

export function RiskLimitsForm() {
  const [paperMode, setPaperMode] = useState(true);
  const [perTradeLoss, setPerTradeLoss] = useState(1.0);   // %
  const [dailyLoss, setDailyLoss] = useState(3.0);          // %
  const [consecLossStop, setConsecLossStop] = useState(3);
  const [maxLeverage, setMaxLeverage] = useState(5);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u?.user) return;
        const { data } = await supabase.from("trading_rules").select("*").eq("user_id", u.user.id).maybeSingle();
        if (data) {
          setPaperMode((data as any).paper_mode ?? true);
          setPerTradeLoss(Number((data as any).per_trade_loss_pct ?? 1));
          setDailyLoss(Number((data as any).daily_loss_pct ?? 3));
          setConsecLossStop(Number((data as any).consec_loss_stop ?? 3));
          setMaxLeverage(Number((data as any).max_leverage ?? 5));
        }
      } finally { setLoading(false); }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) throw new Error("로그인 필요");
      const { error } = await supabase.from("trading_rules").upsert({
        user_id: u.user.id,
        paper_mode: paperMode,
        per_trade_loss_pct: perTradeLoss,
        daily_loss_pct: dailyLoss,
        consec_loss_stop: consecLossStop,
        max_leverage: maxLeverage,
      } as any, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("리스크 한도 저장 완료");
    } catch (e: any) {
      toast.error("저장 실패: " + e.message);
    } finally { setSaving(false); }
  };

  if (loading) return <Card className="p-5"><Loader2 className="h-4 w-4 animate-spin" /></Card>;

  return (
    <Card className="p-5 space-y-5">
      <div>
        <h2 className="text-base font-bold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> 리스크 한도
        </h2>
        <p className="text-[11px] text-muted-foreground">실거래 전 반드시 Paper Mode에서 충분히 검증하세요.</p>
      </div>

      {/* Paper Mode */}
      <div className={`rounded border p-3 flex items-center justify-between ${paperMode ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
        <div className="text-sm">
          <div className="font-semibold flex items-center gap-2">
            {!paperMode && <AlertTriangle className="h-4 w-4 text-amber-300" />}
            Paper Mode {paperMode ? "(모의매매)" : "(실거래)"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {paperMode ? "주문이 거래소로 전송되지 않습니다." : "실제 자금이 사용됩니다. 검증된 전략에만 적용하세요."}
          </div>
        </div>
        <Switch checked={paperMode} onCheckedChange={(v) => {
          if (!v && !confirm("Paper Mode를 해제하고 실거래로 전환하시겠습니까? 검증된 전략만 사용하세요.")) return;
          setPaperMode(v);
        }} />
      </div>

      <Row label="1회 손실 한도 (%)" value={perTradeLoss}>
        <Input type="number" step="0.1" min={0.1} max={10} value={perTradeLoss}
          onChange={e => setPerTradeLoss(Number(e.target.value))} className="font-mono w-28" />
      </Row>
      <Row label="일일 손실 한도 (%)" value={dailyLoss}>
        <Input type="number" step="0.5" min={0.5} max={30} value={dailyLoss}
          onChange={e => setDailyLoss(Number(e.target.value))} className="font-mono w-28" />
      </Row>
      <Row label="연속 손실 시 정지" value={`${consecLossStop}회`}>
        <Input type="number" min={1} max={10} value={consecLossStop}
          onChange={e => setConsecLossStop(Number(e.target.value))} className="font-mono w-28" />
      </Row>

      <div>
        <div className="flex justify-between mb-2 text-xs">
          <span className="text-muted-foreground">최대 레버리지</span>
          <span className="font-mono font-semibold">{maxLeverage}x</span>
        </div>
        <Slider value={[maxLeverage]} min={1} max={20} step={1} onValueChange={(v) => setMaxLeverage(v[0])} />
      </div>

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
      </Button>
    </Card>
  );
}

function Row({ label, value, children }: { label: string; value: string | number; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
