import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { Exchange } from "@/types/trading";

interface ConnectApiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectApiModal({ open, onOpenChange }: ConnectApiModalProps) {
  const [exchange, setExchange] = useState<Exchange>("binance");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!apiKey || !apiSecret) {
      toast.error("API Key와 Secret을 입력해주세요.");
      return;
    }
    if (exchange === "okx" && !passphrase) {
      toast.error("OKX는 Passphrase가 필요합니다.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("trading_settings").upsert(
        {
          exchange,
          api_key_encrypted: apiKey,
          api_secret_encrypted: apiSecret,
          passphrase_encrypted: exchange === "okx" ? passphrase : null,
        },
        { onConflict: "user_id,exchange" }
      );

      if (error) throw error;

      toast.success(`${exchange.toUpperCase()} API 연결 완료!`);
      onOpenChange(false);
      setApiKey("");
      setApiSecret("");
      setPassphrase("");
    } catch (err: any) {
      toast.error("API 키 저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ShieldCheck className="h-5 w-5 text-primary" />
            API 연결
          </DialogTitle>
          <DialogDescription>
            거래소 API 키를 안전하게 저장합니다. 키는 서버 측에서만 사용됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">거래소</label>
            <Select value={exchange} onValueChange={(v) => setExchange(v as Exchange)}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="binance">Binance</SelectItem>
                <SelectItem value="bybit">Bybit</SelectItem>
                <SelectItem value="okx">OKX</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">API Key</label>
            <Input
              type="text"
              placeholder="API Key를 입력하세요"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-input border-border font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">API Secret</label>
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                placeholder="API Secret을 입력하세요"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="bg-input border-border font-mono text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {exchange === "okx" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Passphrase</label>
              <Input
                type="password"
                placeholder="OKX Passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="bg-input border-border font-mono text-sm"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4" />
                저장
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
