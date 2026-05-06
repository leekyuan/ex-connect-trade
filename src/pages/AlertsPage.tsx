import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useCoinMarketCap } from "@/hooks/useCoinMarketCap";
import { useTelegramSettings } from "@/hooks/useTelegramSettings";
import { useMarketAnalysis } from "@/hooks/useMarketAnalysis";
import { supabase } from "@/integrations/supabase/client";
import { sendTelegram } from "@/lib/telegram";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Bell, Plus, Trash2, Loader2, BellRing, Send, Activity, Wallet } from "lucide-react";
import { toast } from "sonner";

interface PriceAlert {
  id: string;
  symbol: string;
  condition: "above" | "below";
  target_price: number;
  triggered: boolean;
  triggered_at: string | null;
  notify_telegram: boolean;
  created_at: string;
}

interface NotificationLog {
  id: string;
  time: string;
  channel: "browser" | "telegram";
  type: "price" | "signal" | "position";
  message: string;
}

const HISTORY_KEY = "cryptoedge-alert-history";

function loadHistory(): NotificationLog[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function pushHistory(entry: Omit<NotificationLog, "id" | "time">) {
  try {
    const list = loadHistory();
    list.unshift({ ...entry, id: crypto.randomUUID(), time: new Date().toISOString() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
    window.dispatchEvent(new Event("alert-history-updated"));
  } catch {}
}

interface SignalAlertCfg {
  id: string;
  symbol: string;
  minConfidence: number;
}

interface PositionAlertCfg {
  id: string;
  symbol: string;
  pctTarget: number; // +X% profit OR -X% loss
}

export default function AlertsPage() {
  const { user } = useAuth();
  const { coins } = useCoinMarketCap();
  const { settings: tgSettings } = useTelegramSettings();
  const analyses = useMarketAnalysis(coins, "daytrading");
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<NotificationLog[]>(loadHistory);

  // 알림 페이지 방문 시 unread 마커 갱신
  useEffect(() => {
    import('@/hooks/useUnreadAlerts').then(m => m.markAlertsRead());
  }, []);

  // signal/position alerts (local only)
  const [signalAlerts, setSignalAlerts] = useState<SignalAlertCfg[]>(() => {
    try { return JSON.parse(localStorage.getItem("cryptoedge-signal-alerts") || "[]"); } catch { return []; }
  });
  const [positionAlerts, setPositionAlerts] = useState<PositionAlertCfg[]>(() => {
    try { return JSON.parse(localStorage.getItem("cryptoedge-position-alerts") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("cryptoedge-signal-alerts", JSON.stringify(signalAlerts));
  }, [signalAlerts]);
  useEffect(() => {
    localStorage.setItem("cryptoedge-position-alerts", JSON.stringify(positionAlerts));
  }, [positionAlerts]);

  // Form state — price alert
  const [symbol, setSymbol] = useState("BTC");
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [target, setTarget] = useState("");
  const [notifyTg, setNotifyTg] = useState(true);
  const [adding, setAdding] = useState(false);

  // Signal alert form
  const [sigSymbol, setSigSymbol] = useState("BTC");
  const [sigConf, setSigConf] = useState(70);

  // Position alert form
  const [posSymbol, setPosSymbol] = useState("BTC");
  const [posPct, setPosPct] = useState("5");

  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  // Listen for history updates
  useEffect(() => {
    const onUpdate = () => setHistory(loadHistory());
    window.addEventListener("alert-history-updated", onUpdate);
    return () => window.removeEventListener("alert-history-updated", onUpdate);
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("price_alerts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (mounted) setAlerts((data as PriceAlert[]) ?? []);
      } catch (err: any) {
        console.error("[AlertsPage] price_alerts 로드 실패:", err);
        if (mounted) toast.error("알림 로드 실패: " + (err?.message || "unknown"));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    // 5초 타임아웃 — 무한 스피너 방지
    const timeout = setTimeout(() => { if (mounted) setLoading(false); }, 5000);
    load().finally(() => clearTimeout(timeout));
    const channel = supabase
      .channel(`price-alerts-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "price_alerts", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Trigger price alerts
  useEffect(() => {
    if (!coins || coins.length === 0 || alerts.length === 0) return;
    alerts.filter(a => !a.triggered).forEach(async (alert) => {
      const coin = coins.find((c) => c.symbol === alert.symbol);
      if (!coin) return;
      const triggered =
        (alert.condition === "above" && coin.price >= alert.target_price) ||
        (alert.condition === "below" && coin.price <= alert.target_price);
      if (!triggered) return;
      const condText = alert.condition === "above" ? "상향 돌파" : "하향 이탈";
      const msg = `${alert.symbol} → $${alert.target_price.toLocaleString()} ${condText}`;
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(`🔔 ${alert.symbol} 가격 알림`, { body: msg });
        pushHistory({ channel: "browser", type: "price", message: msg });
      }
      if (alert.notify_telegram && tgSettings?.enabled && tgSettings.notify_price_alerts && tgSettings.chat_id) {
        sendTelegram({
          chat_id: tgSettings.chat_id,
          message: `🔔 <b>가격 알림</b>\n${alert.symbol}/USDT\n${condText} → $${alert.target_price.toLocaleString()}\n현재: $${coin.price.toLocaleString()}`,
        });
        pushHistory({ channel: "telegram", type: "price", message: msg });
      }
      await supabase
        .from("price_alerts")
        .update({ triggered: true, triggered_at: new Date().toISOString() })
        .eq("id", alert.id);
    });
  }, [coins, alerts, tgSettings]);

  // Trigger signal alerts
  const lastSignals = useMemo(() => new Map<string, string>(), []);
  useEffect(() => {
    if (!analyses.length || !signalAlerts.length) return;
    signalAlerts.forEach(cfg => {
      const a = analyses.find(x => x.coin.symbol === cfg.symbol);
      if (!a) return;
      const key = `${cfg.id}-${a.signal}`;
      if (lastSignals.get(cfg.id) === a.signal) return;
      lastSignals.set(cfg.id, a.signal);
      if (a.signal !== "WATCH" && a.confidence >= cfg.minConfidence) {
        const msg = `${cfg.symbol} ${a.signal} (신뢰도 ${a.confidence}%)`;
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(`📊 신호 알림`, { body: msg, tag: key });
        }
        pushHistory({ channel: "browser", type: "signal", message: msg });
      }
    });
  }, [analyses, signalAlerts, lastSignals]);

  const handleAdd = async () => {
    if (!user) return;
    const t = Number(target);
    if (!symbol || !t) {
      toast.error("심볼과 목표가는 필수입니다");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("price_alerts").insert({
      user_id: user.id,
      symbol: symbol.toUpperCase(),
      condition,
      target_price: t,
      notify_telegram: notifyTg,
    });
    setAdding(false);
    if (error) toast.error(error.message);
    else {
      toast.success("알림이 등록되었습니다");
      setTarget("");
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("price_alerts").delete().eq("id", id);
  };

  const handleClearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
    toast("알림 내역이 삭제되었습니다");
  };

  const handleTelegramTest = async () => {
    if (!tgSettings?.chat_id) {
      toast.error("설정에서 텔레그램 Chat ID를 먼저 등록하세요");
      return;
    }
    const res = await sendTelegram({
      chat_id: tgSettings.chat_id,
      message: "✅ <b>CryptoEdge AI</b> 알림 테스트 — 정상 동작합니다!",
    });
    if (res.ok) {
      toast.success("테스트 메시지를 발송했어요");
      pushHistory({ channel: "telegram", type: "price", message: "테스트 메시지 발송" });
    } else {
      toast.error(`발송 실패: ${res.error ?? "알 수 없는 오류"}`);
    }
  };

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPermission(p);
  };

  const handleAddSignalAlert = () => {
    if (!sigSymbol) return;
    setSignalAlerts(p => [...p, { id: crypto.randomUUID(), symbol: sigSymbol.toUpperCase(), minConfidence: sigConf }]);
    toast.success(`${sigSymbol.toUpperCase()} 신호 알림 등록`);
  };

  const handleAddPositionAlert = () => {
    const pct = Number(posPct);
    if (!posSymbol || !pct) return;
    setPositionAlerts(p => [...p, { id: crypto.randomUUID(), symbol: posSymbol.toUpperCase(), pctTarget: pct }]);
    toast.success(`${posSymbol.toUpperCase()} 포지션 알림 등록`);
  };

  const currentPrice = coins?.find((c) => c.symbol === symbol.toUpperCase())?.price;
  const active = alerts.filter((a) => !a.triggered);
  const triggered = alerts.filter((a) => a.triggered);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-5 p-4">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Bell className="h-6 w-6 text-primary" /> 알림 센터
            </h1>
            <p className="text-sm text-muted-foreground">가격·신호·포지션 알림을 한 곳에서 관리합니다</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleTelegramTest}>
            <Send className="mr-2 h-4 w-4" /> 텔레그램 연결 테스트
          </Button>
        </div>

        {permission === "default" && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <BellRing className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">브라우저 알림 권한</p>
                  <p className="text-xs text-muted-foreground">데스크톱 알림을 받으려면 권한이 필요합니다</p>
                </div>
              </div>
              <Button size="sm" onClick={requestPermission}>허용</Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="price">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="price"><Bell className="mr-1 h-3 w-3" />가격알림</TabsTrigger>
            <TabsTrigger value="signal"><Activity className="mr-1 h-3 w-3" />신호알림</TabsTrigger>
            <TabsTrigger value="position"><Wallet className="mr-1 h-3 w-3" />포지션알림</TabsTrigger>
          </TabsList>

          {/* 가격 알림 */}
          <TabsContent value="price" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">+ 가격 알림 등록</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <div className="space-y-1.5">
                    <Label>코인</Label>
                    <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
                    {currentPrice != null && (
                      <p className="text-[10px] text-muted-foreground">현재가: ${currentPrice.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>조건</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button type="button" variant={condition === "above" ? "default" : "outline"} size="sm" onClick={() => setCondition("above")}>이상</Button>
                      <Button type="button" variant={condition === "below" ? "default" : "outline"} size="sm" onClick={() => setCondition("below")}>이하</Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>목표가 (USDT)</Label>
                    <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAdd} disabled={adding} className="w-full">
                      {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" />등록</>}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Switch checked={notifyTg} onCheckedChange={setNotifyTg} />
                  <Label className="text-xs">텔레그램으로도 알림 받기</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">활성 ({active.length})</CardTitle></CardHeader>
              <CardContent>
                {loading ? (
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                ) : active.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">활성 알림이 없습니다</p>
                ) : (
                  <div className="space-y-2">
                    {active.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-md border border-border p-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {a.symbol}{" "}
                            <span className="text-xs font-normal text-muted-foreground">
                              {a.condition === "above" ? "≥" : "≤"} ${a.target_price.toLocaleString()}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleString("ko-KR")}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {triggered.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">발동됨 ({triggered.length})</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {triggered.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-md border border-border/50 p-3 opacity-60">
                        <p className="text-sm">{a.symbol} {a.condition === "above" ? "≥" : "≤"} ${a.target_price.toLocaleString()}</p>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 신호 알림 */}
          <TabsContent value="signal" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">+ 신호 알림 등록</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
                  <div className="space-y-1.5">
                    <Label>코인</Label>
                    <Input value={sigSymbol} onChange={e => setSigSymbol(e.target.value.toUpperCase())} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>최소 신뢰도: <span className="font-bold text-primary">{sigConf}%</span></Label>
                    <Slider min={50} max={95} step={1} value={[sigConf]} onValueChange={v => setSigConf(v[0])} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddSignalAlert}><Plus className="mr-1 h-4 w-4" />등록</Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">선택한 코인에서 신뢰도 X% 이상의 LONG/SHORT 신호 발생 시 알림</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">등록된 신호 알림 ({signalAlerts.length})</CardTitle></CardHeader>
              <CardContent>
                {signalAlerts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">등록된 신호 알림이 없습니다</p>
                ) : (
                  <div className="space-y-2">
                    {signalAlerts.map(s => (
                      <div key={s.id} className="flex items-center justify-between rounded-md border border-border p-3">
                        <p className="text-sm font-semibold">{s.symbol} <span className="text-xs font-normal text-muted-foreground">신뢰도 ≥ {s.minConfidence}%</span></p>
                        <Button size="sm" variant="ghost" onClick={() => setSignalAlerts(p => p.filter(x => x.id !== s.id))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 포지션 알림 */}
          <TabsContent value="position" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">+ 포지션 알림 등록</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-1.5">
                    <Label>코인 (오픈 포지션)</Label>
                    <Input value={posSymbol} onChange={e => setPosSymbol(e.target.value.toUpperCase())} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>수익/손실 % (절댓값)</Label>
                    <Input type="number" value={posPct} onChange={e => setPosPct(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddPositionAlert}><Plus className="mr-1 h-4 w-4" />등록</Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">해당 포지션이 ±X% 도달 시 알림 (오픈 포지션 데이터 연동 시 동작)</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">등록된 포지션 알림 ({positionAlerts.length})</CardTitle></CardHeader>
              <CardContent>
                {positionAlerts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">등록된 포지션 알림이 없습니다</p>
                ) : (
                  <div className="space-y-2">
                    {positionAlerts.map(s => (
                      <div key={s.id} className="flex items-center justify-between rounded-md border border-border p-3">
                        <p className="text-sm font-semibold">{s.symbol} <span className="text-xs font-normal text-muted-foreground">±{s.pctTarget}% 도달 시</span></p>
                        <Button size="sm" variant="ghost" onClick={() => setPositionAlerts(p => p.filter(x => x.id !== s.id))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 알림 발생 내역 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">알림 발생 내역 ({history.length})</CardTitle>
            {history.length > 0 && (
              <Button size="sm" variant="outline" onClick={handleClearHistory}>전체 삭제</Button>
            )}
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">아직 발생한 알림이 없습니다</p>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2 text-xs">
                    <span className="text-muted-foreground font-mono shrink-0">
                      {new Date(h.time).toLocaleTimeString("ko-KR")}
                    </span>
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      h.type === "price" ? "bg-blue-500/15 text-blue-400" :
                      h.type === "signal" ? "bg-emerald-500/15 text-emerald-400" :
                      "bg-amber-500/15 text-amber-400"
                    }`}>{h.type}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">[{h.channel}]</span>
                    <span className="text-foreground truncate">{h.message}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
