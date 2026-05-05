import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Exchange } from "@/types/trading";
import { Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ApiKeyFormProps {
  exchange: Exchange;
}

export function ApiKeyForm({ exchange }: ApiKeyFormProps) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!apiKey || !apiSecret) {
      toast.error("API Key와 Secret을 모두 입력해주세요.");
      return;
    }
    if (exchange === "okx" && !passphrase) {
      toast.error("OKX는 Passphrase가 필요합니다.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("exchange_api_keys").upsert(
        {
          exchange,
          api_key: apiKey,
          api_secret: apiSecret,
          passphrase: exchange === "okx" ? passphrase : null,
        },
        { onConflict: "exchange" }
      );

      if (error) throw error;

      setSaved(true);
      toast.success(`${exchange.toUpperCase()} API 키가 저장되었습니다.`);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      toast.error("API 키 저장에 실패했습니다: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-muted-foreground">API 설정</label>
      <div className="space-y-2">
        <Input
          type="text"
          placeholder="API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="bg-input border-border font-mono text-sm"
        />
        <div className="relative">
          <Input
            type={showSecret ? "text" : "password"}
            placeholder="API Secret"
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
        {exchange === "okx" && (
          <Input
            type="password"
            placeholder="Passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="bg-input border-border font-mono text-sm"
          />
        )}
      </div>
      <Button
        onClick={handleSave}
        disabled={saving}
        variant="secondary"
        size="sm"
        className="w-full"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <>
            <Check className="h-4 w-4" /> 저장됨
          </>
        ) : (
          "API 키 저장"
        )}
      </Button>
    </div>
  );
}
