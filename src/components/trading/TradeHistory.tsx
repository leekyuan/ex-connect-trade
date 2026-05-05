import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface TradeLog {
  id: string;
  exchange: string;
  symbol: string;
  entry_price: number;
  tp1_price: number;
  tp2_price: number;
  sl_price: number;
  tp_split_ratio: number;
  leverage: number;
  position_size: number;
  status: string;
  created_at: string;
}

export function TradeHistory() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<TradeLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchLogs();

    // Realtime subscription
    const channel = supabase
      .channel("trade_logs_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trade_logs", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setLogs((prev) => [payload.new as TradeLog, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from("trade_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) setLogs(data);
    setLoading(false);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "executed": return <CheckCircle className="h-4 w-4 text-success" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-warning" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">거래 내역</h3>
      </div>
      {logs.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          아직 거래 내역이 없습니다.
        </div>
      ) : (
        <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="px-4 py-3 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                {statusIcon(log.status)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{log.symbol}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent text-accent-foreground uppercase">
                      {log.exchange}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    Entry: ${log.entry_price.toLocaleString()} | TP1: ${log.tp1_price.toLocaleString()} | SL: ${log.sl_price.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-foreground">${log.position_size.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
