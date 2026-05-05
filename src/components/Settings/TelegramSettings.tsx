import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { sendTelegram } from "@/lib/telegram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Send, Save, Info } from "lucide-react";
import { toast } from "sonner";

export function TelegramSettings() {
  const { user } = useAuth();
  const [chatId, setChatId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [notifyScalping, setNotifyScalping] = useState(true);
  const [notifyDay, setNotifyDay] = useState(true);
  const [notifySwing, setNotifySwing] = useState(true);
  const [notifyPriceAlerts, setNotifyPriceAlerts] = useState(true);
  const [minConf, setMinConf] = useState(65);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("telegram_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setChatId(data.chat_id ?? "");
        setEnabled(data.enabled);
        setNotifyScalping(data.notify_scalping);
        setNotifyDay(data.notify_daytrading);
        setNotifySwing(data.notify_swing);
        setNotifyPriceAlerts(data.notify_price_alerts);
        setMinConf(data.min_confidence);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleTest = async () => {
    if (!chatId.trim()) {
      toast.error("Chat ID를 먼저 입력해주세요");
      return;
    }
    setTesting(true);
    const res = await sendTelegram({
      chat_id: chatId.trim(),
      message: "✅ <b>CryptoEdge AI</b> 연결 성공!\n\n신호 알림이 정상 발송됩니다.",
    });
    setTesting(false);
    if (res.ok) toast.success("테스트 메시지를 발송했어요");
    else toast.error(`발송 실패: ${res.error ?? "알 수 없는 오류"}`);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!chatId.trim()) {
      toast.error("Chat ID는 필수입니다");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("telegram_settings")
      .upsert(
        {
          user_id: user.id,
          chat_id: chatId.trim(),
          enabled,
          notify_scalping: notifyScalping,
          notify_daytrading: notifyDay,
          notify_swing: notifySwing,
          notify_price_alerts: notifyPriceAlerts,
          min_confidence: minConf,
        },
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("저장되었습니다");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" /> 텔레그램 알림 설정
        </CardTitle>
        <CardDescription>
          신호 발생 시 텔레그램으로 실시간 알림을 받습니다. 봇은 시스템에서 제공되며, Chat ID만 등록하면 됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              1) 텔레그램에서 <b>@CryptoEdgeAI_bot</b>(또는 연결된 봇)에게 <code>/start</code> 메시지 전송
              <br />
              2) <b>@userinfobot</b>에서 본인의 Chat ID 확인 후 아래에 입력
              <br />
              3) "연결 테스트" 버튼으로 정상 작동 확인
            </span>
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="chat-id">Chat ID</Label>
          <div className="flex gap-2">
            <Input
              id="chat-id"
              placeholder="예: 123456789"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
            />
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "연결 테스트"}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">전체 알림</p>
            <p className="text-xs text-muted-foreground">끄면 모든 알림이 중단됩니다</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-3">
          <Label>알림 받을 모드</Label>
          {[
            { label: "스캘핑 신호", value: notifyScalping, set: setNotifyScalping },
            { label: "단타 신호", value: notifyDay, set: setNotifyDay },
            { label: "스윙 신호", value: notifySwing, set: setNotifySwing },
            { label: "가격 알림", value: notifyPriceAlerts, set: setNotifyPriceAlerts },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2"
            >
              <span className="text-sm">{row.label}</span>
              <Switch checked={row.value} onCheckedChange={row.set} />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>최소 신뢰도</Label>
            <span className="text-sm font-bold text-primary">{minConf}%</span>
          </div>
          <Slider
            min={50}
            max={90}
            step={1}
            value={[minConf]}
            onValueChange={(v) => setMinConf(v[0])}
          />
          <p className="text-xs text-muted-foreground">
            이 신뢰도 이상의 신호만 알림을 보냅니다
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          저장
        </Button>
      </CardContent>
    </Card>
  );
}
