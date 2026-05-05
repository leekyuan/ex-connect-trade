import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, Eye, EyeOff, AlertTriangle, Plug, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { loadCreds, saveCreds, clearCreds, getFuturesBalance } from "@/utils/exchangeApi";

export function BinanceApiSettings() {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const c = loadCreds();
    if (c) { setApiKey(c.apiKey); setApiSecret(c.apiSecret); }
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) return toast.error("API Key와 Secret 모두 필수입니다");
    setSaving(true);
    saveCreds({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() });
    setSaving(false);
    toast.success("Binance API가 저장되었습니다 (이 브라우저에만 저장)");
  };

  const handleTest = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) return toast.error("API Key를 먼저 입력해주세요");
    setTesting(true);
    try {
      const b = await getFuturesBalance({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() });
      toast.success(`연결 성공 — USDT 잔고: $${b}`);
    } catch (e: any) {
      toast.error(`연결 실패: ${e.message ?? e}`);
    } finally { setTesting(false); }
  };

  const handleClear = () => {
    clearCreds(); setApiKey(""); setApiSecret("");
    toast.info("API 키 삭제됨");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" /> Binance Futures API
        </CardTitle>
        <CardDescription>
          실거래 매매용 API 키. 이 브라우저의 localStorage에만 저장되며, 외부 서버로 전송되지 않습니다.
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

        <div className="space-y-1.5">
          <Label htmlFor="bn-key">API Key</Label>
          <Input id="bn-key" type="password" placeholder="Binance API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bn-secret">Secret Key</Label>
          <div className="flex gap-2">
            <Input id="bn-secret" type={showSecret ? "text" : "password"} placeholder="Secret Key" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} />
            <Button variant="outline" size="icon" onClick={() => setShowSecret((s) => !s)}>
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing} className="flex-1">
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            연결 테스트 (잔고 조회)
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            저장
          </Button>
          <Button variant="ghost" onClick={handleClear} title="API 키 삭제">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
