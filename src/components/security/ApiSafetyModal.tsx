import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, ShieldAlert, ArrowRight, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import type { Exchange } from "@/types/trading";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiSafetyModal({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<"safety" | "input">("safety");
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [c3, setC3] = useState(false);

  const [exchange, setExchange] = useState<Exchange>("binance");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep("safety"); setC1(false); setC2(false); setC3(false);
    setApiKey(""); setApiSecret(""); setPassphrase(""); setShowSecret(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleSave = async () => {
    if (!apiKey || !apiSecret) { toast.error("API Key와 Secret을 입력해주세요."); return; }
    if (exchange === "okx" && !passphrase) { toast.error("OKX는 Passphrase가 필요합니다."); return; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) throw new Error("로그인이 필요합니다.");
      const { error } = await supabase.from("exchange_api_keys").upsert({
        user_id: u.user.id,
        exchange,
        api_key: apiKey,
        api_secret: apiSecret,
        passphrase: exchange === "okx" ? passphrase : null,
      }, { onConflict: "user_id,exchange" });
      if (error) throw error;
      toast.success(`${exchange.toUpperCase()} API 연결 완료 · Secret은 다시 표시되지 않습니다.`);
      handleClose(false);
    } catch (e: any) {
      toast.error("저장 실패: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const safetyDone = c1 && c2 && c3;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {step === "safety" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-warning" />
                API 키 보안 안내
              </DialogTitle>
              <DialogDescription>
                실거래 전 아래 항목을 거래소에서 직접 확인하세요. 모두 체크해야 다음 단계로 이동합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm">
              <SafetyItem checked={c1} onChange={setC1}
                title="출금 권한 비활성화"
                desc="API 키에 출금(Withdraw) 권한이 절대 없어야 합니다. 거래소에서 출금 권한이 꺼져 있는지 다시 확인하세요." />
              <SafetyItem checked={c2} onChange={setC2}
                title="거래 권한만 허용"
                desc="현물·선물 거래(Read + Trade)만 허용하세요. 그 외 권한은 비활성화 권장." />
              <SafetyItem checked={c3} onChange={setC3}
                title="IP Whitelist 설정 권장"
                desc="가능하면 IP 화이트리스트를 설정하세요. 키 탈취 시 피해를 차단합니다." />
              <div className="rounded border border-warning/30 bg-warning/5 p-2 text-[11px] text-muted-foreground">
                저장된 Secret은 화면에 다시 표시되지 않으며, 손실 발생 시 본 서비스는 책임지지 않습니다.
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => handleClose(false)}>취소</Button>
              <Button disabled={!safetyDone} onClick={() => setStep("input")}>
                다음 <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> API 키 입력
              </DialogTitle>
              <DialogDescription>키는 서버 측에서만 사용되며 저장 후 Secret은 다시 표시되지 않습니다.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">거래소</label>
                <Select value={exchange} onValueChange={(v) => setExchange(v as Exchange)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="binance">Binance</SelectItem>
                    <SelectItem value="bybit">Bybit</SelectItem>
                    <SelectItem value="okx">OKX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">API Key</label>
                <Input value={apiKey} onChange={e => setApiKey(e.target.value)} className="font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">API Secret</label>
                <div className="relative">
                  <Input type={showSecret ? "text" : "password"} value={apiSecret} onChange={e => setApiSecret(e.target.value)} className="font-mono text-sm pr-10" />
                  <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {exchange === "okx" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Passphrase</label>
                  <Input type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} className="font-mono text-sm" />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("safety")}>이전</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장 (Paper Mode 유지)"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SafetyItem({ checked, onChange, title, desc }: { checked: boolean; onChange: (v: boolean) => void; title: string; desc: string }) {
  return (
    <label className="flex gap-3 items-start cursor-pointer rounded border border-border/50 bg-background/30 p-2.5 hover:bg-background/50">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5" />
      <div className="text-xs">
        <div className="font-semibold">{title}</div>
        <div className="text-muted-foreground">{desc}</div>
      </div>
    </label>
  );
}
