import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, Eye, EyeOff, AlertTriangle, Plug, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { loadCreds, saveCreds, clearCreds, syncCredsFlag, getFuturesBalance } from "@/utils/exchangeApi";

export function BinanceApiSettings() {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState<boolean>(!!loadCreds());

  useEffect(() => {
    syncCredsFlag().then(setConfigured).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) return toast.error("API Key와 Secret 모두 필수입니다");
    setSaving(true);
    try {
      await saveCreds({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() });
      setConfigured(true);
      setApiKey(""); setApiSecret("");
      toast.success("Binance API가 안전하게 저장되었습니다 (서버측 암호 저장소)");
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.message ?? e}`);
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const b = await getFuturesBalance();
      toast.success(`연결 성공 — USDT 잔고: $${b}`);
    } catch (e: any) {
      toast.error(`연결 실패: ${e.message ?? e}`);
    } finally { setTesting(false); }
  };

  const handleClear = async () => {
    try {
      await clearCreds();
      setConfigured(false); setApiKey(""); setApiSecret("");
      toast.info("API 키 삭제됨");
    } catch (e: any) {
      toast.error(`삭제 실패: ${e?.message ?? e}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" /> Binance Futures API
        </CardTitle>
        <CardDescription>
          API 키는 서버측 암호 저장소(RLS 보호)에만 저장되며, 브라우저나 localStorage에는 저장되지 않습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="flex items-start gap-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b>출금 권한은 절대 부여하지 마세요.</b> Futures 거래 권한만 활성화하고,
              IP 화이트리스트 사용을 권장합니다.
            </span>
          </p>
        </div>

        {configured && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
            <p className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>현재 Binance API가 연결되어 있습니다. 새 키로 교체하려면 아래에 입력 후 저장하세요.</span>
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="bn-key">API Key</Label>
          <Input id="bn-key" type="password" placeholder="Binance API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bn-secret">Secret Key</Label>
          <div className="flex gap-2">
            <Input id="bn-secret" type={showSecret ? "text" : "password"} placeholder="Secret Key" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} autoComplete="off" />
            <Button variant="outline" size="icon" onClick={() => setShowSecret((s) => !s)}>
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing || !configured} className="flex-1">
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            연결 테스트 (잔고 조회)
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            저장
          </Button>
          <Button variant="ghost" onClick={handleClear} title="API 키 삭제" disabled={!configured}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
