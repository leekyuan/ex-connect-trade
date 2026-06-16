import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { ShieldCheck, AlertTriangle } from "lucide-react";

const STORAGE_KEY = "cryptoedge-risk-limits";

interface Limits {
  paperMode: boolean;
  perTradeLoss: number;
  dailyLoss: number;
  consecLossStop: number;
  maxLeverage: number;
}

const DEFAULTS: Limits = {
  paperMode: true,
  perTradeLoss: 1.0,
  dailyLoss: 3.0,
  consecLossStop: 3,
  maxLeverage: 5,
};

function load(): Limits {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { return DEFAULTS; }
}

export function RiskLimitsForm() {
  const [v, setV] = useState<Limits>(DEFAULTS);
  useEffect(() => { setV(load()); }, []);

  const update = <K extends keyof Limits>(k: K, val: Limits[K]) => setV(prev => ({ ...prev, [k]: val }));

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
      toast.success("리스크 한도 저장 완료");
    } catch { toast.error("저장 실패"); }
  };

  return (
    <Card className="p-5 space-y-5">
      <div>
        <h2 className="text-base font-bold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> 리스크 한도
        </h2>
        <p className="text-[11px] text-muted-foreground">실거래 전 반드시 Paper Mode에서 충분히 검증하세요.</p>
      </div>

      <div className={`rounded border p-3 flex items-center justify-between ${v.paperMode ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
        <div className="text-sm">
          <div className="font-semibold flex items-center gap-2">
            {!v.paperMode && <AlertTriangle className="h-4 w-4 text-amber-300" />}
            Paper Mode {v.paperMode ? "(모의매매)" : "(실거래)"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {v.paperMode ? "주문이 거래소로 전송되지 않습니다." : "실제 자금이 사용됩니다. 검증된 전략에만 적용하세요."}
          </div>
        </div>
        <Switch checked={v.paperMode} onCheckedChange={(val) => {
          if (!val && !confirm("Paper Mode를 해제하고 실거래로 전환하시겠습니까? 검증된 전략만 사용하세요.")) return;
          update("paperMode", val);
        }} />
      </div>

      <Row label="1회 손실 한도 (%)">
        <Input type="number" step="0.1" min={0.1} max={10} value={v.perTradeLoss}
          onChange={e => update("perTradeLoss", Number(e.target.value))} className="font-mono w-28" />
      </Row>
      <Row label="일일 손실 한도 (%)">
        <Input type="number" step="0.5" min={0.5} max={30} value={v.dailyLoss}
          onChange={e => update("dailyLoss", Number(e.target.value))} className="font-mono w-28" />
      </Row>
      <Row label="연속 손실 정지 (회)">
        <Input type="number" min={1} max={10} value={v.consecLossStop}
          onChange={e => update("consecLossStop", Number(e.target.value))} className="font-mono w-28" />
      </Row>

      <div>
        <div className="flex justify-between mb-2 text-xs">
          <span className="text-muted-foreground">최대 레버리지</span>
          <span className="font-mono font-semibold">{v.maxLeverage}x</span>
        </div>
        <Slider value={[v.maxLeverage]} min={1} max={20} step={1} onValueChange={(val) => update("maxLeverage", val[0])} />
      </div>

      <Button onClick={save} className="w-full">저장</Button>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
