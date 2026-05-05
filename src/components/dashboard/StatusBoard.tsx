import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet, TrendingUp, TrendingDown, Activity, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StatusData {
  balance: number;
  unrealizedPnl: number;
  openPositions: number;
  totalTrades: number;
  todayPnl: number;
  apiConnected: boolean;
}

export function StatusBoard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusData>({
    balance: 0,
    unrealizedPnl: 0,
    openPositions: 0,
    totalTrades: 0,
    todayPnl: 0,
    apiConnected: false,
  });
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date());

  useEffect(() => {
    if (!user) return;
    fetchStatus();
    const id = setInterval(fetchStatus, 30000);
    return () => clearInterval(id);
  }, [user]);

  const fetchStatus = async () => {
    // API connected? (mock — check exchange_api_keys)
    const { data: apiKeys } = await supabase
      .from("exchange_api_keys")
      .select("id")
      .limit(1);
    const apiConnected = !!apiKeys && apiKeys.length > 0;

    // Open positions
    const { data: openData } = await supabase
      .from("trade_history")
      .select("id, pnl")
      .eq("status", "open");

    // Total trades
    const { count: totalCount } = await supabase
      .from("trade_history")
      .select("id", { count: "exact", head: true });

    // Today's PnL (from trade_history closed today + open unrealized)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todayClosed } = await supabase
      .from("trade_history")
      .select("pnl")
      .eq("status", "closed")
      .gte("closed_at", today.toISOString());

    const todayRealized = (todayClosed ?? []).reduce(
      (s, t) => s + (Number(t.pnl) || 0), 0
    );
    const unrealizedPnl = (openData ?? []).reduce(
      (s, t) => s + (Number(t.pnl) || 0), 0
    );

    setStatus({
      balance: apiConnected ? 10000 : 0, // placeholder when connected
      unrealizedPnl,
      openPositions: openData?.length ?? 0,
      totalTrades: totalCount ?? 0,
      todayPnl: todayRealized + unrealizedPnl,
      apiConnected,
    });
    setUpdatedAt(new Date());
  };

  const cards = [
    {
      label: "잔고 (USDT)",
      value: status.apiConnected
        ? `$${status.balance.toLocaleString()}`
        : "—",
      icon: Wallet,
      color: status.apiConnected ? "text-primary" : "text-muted-foreground",
      badge: !status.apiConnected ? "API 미연결" : null,
    },
    {
      label: "미실현 PNL",
      value: `${status.unrealizedPnl >= 0 ? "+" : ""}$${status.unrealizedPnl.toFixed(2)}`,
      icon: status.unrealizedPnl >= 0 ? TrendingUp : TrendingDown,
      color: status.unrealizedPnl >= 0 ? "text-success" : "text-destructive",
    },
    {
      label: "오늘 수익률",
      value: `${status.todayPnl >= 0 ? "+" : ""}$${status.todayPnl.toFixed(2)}`,
      icon: Calendar,
      color: status.todayPnl >= 0 ? "text-success" : "text-destructive",
    },
    {
      label: "오픈 포지션",
      value: status.openPositions.toString(),
      icon: Activity,
      color: "text-warning",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-card border border-border rounded-lg p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
            <div className="flex items-center gap-1.5">
              {card.badge && (
                <Badge variant="outline" className="text-[9px] border-destructive/30 text-destructive">
                  {card.badge}
                </Badge>
              )}
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </div>
          <p className={`text-xl font-bold font-mono ${card.color}`}>{card.value}</p>
          <p className="text-[10px] text-muted-foreground">
            업데이트 {updatedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      ))}
    </div>
  );
}
