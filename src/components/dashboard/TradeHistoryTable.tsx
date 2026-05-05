import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FlaskConical, Key } from "lucide-react";

interface TradeRecord {
  id: string;
  exchange: string;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  leverage: number;
  pnl: number | null;
  pnl_percent: number | null;
  status: string;
  strategy: string | null;
  opened_at: string;
  closed_at: string | null;
}

export function TradeHistoryTable() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    fetchTrades();

    const channel = supabase
      .channel("trade_history_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trade_history", filter: `user_id=eq.${user.id}` },
        () => fetchTrades()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Mock live price refresh every 3s for open positions
  useEffect(() => {
    const open = trades.filter(t => t.status === "open");
    if (open.length === 0) return;
    const id = setInterval(() => {
      const next: Record<string, number> = {};
      open.forEach(t => {
        const base = livePrices[t.symbol] ?? Number(t.entry_price);
        // ±0.05% wiggle
        next[t.symbol] = base * (1 + (Math.random() - 0.5) * 0.001);
      });
      setLivePrices(prev => ({ ...prev, ...next }));
    }, 3000);
    return () => clearInterval(id);
  }, [trades]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTrades = async () => {
    const { data } = await supabase
      .from("trade_history")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(50);

    if (data) setTrades(data as TradeRecord[]);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">거래 내역</h3>
      </div>
      {trades.length === 0 ? (
        <div className="px-4 py-10 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            아직 거래 내역이 없습니다.
          </p>
          <p className="text-xs text-muted-foreground">
            백테스트를 실행하거나 API를 연결하면 거래가 표시됩니다
          </p>
          <div className="flex gap-2 justify-center">
            <Link to="/backtest">
              <Button size="sm" variant="outline">
                <FlaskConical className="h-3.5 w-3.5 mr-1" /> 백테스트 실행
              </Button>
            </Link>
            <Link to="/settings">
              <Button size="sm" variant="outline">
                <Key className="h-3.5 w-3.5 mr-1" /> API 연결
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">시간</TableHead>
                <TableHead className="text-xs">심볼</TableHead>
                <TableHead className="text-xs">방향</TableHead>
                <TableHead className="text-xs text-right">진입가</TableHead>
                <TableHead className="text-xs text-right">현재/청산가</TableHead>
                <TableHead className="text-xs text-right">PNL</TableHead>
                <TableHead className="text-xs">상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((t) => {
                const live = livePrices[t.symbol];
                const currentPrice = t.status === "open"
                  ? (live ?? Number(t.entry_price))
                  : (t.exit_price ? Number(t.exit_price) : null);
                let displayPnl: number | null = t.pnl != null ? Number(t.pnl) : null;
                if (t.status === "open" && currentPrice) {
                  const raw = t.side === "buy"
                    ? currentPrice / Number(t.entry_price) - 1
                    : Number(t.entry_price) / currentPrice - 1;
                  displayPnl = raw * Number(t.entry_price) * Number(t.quantity) * Number(t.leverage);
                }
                return (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {new Date(t.opened_at).toLocaleString("ko-KR", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-xs font-mono font-medium text-foreground">
                      {t.symbol}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          t.side === "buy"
                            ? "border-success/30 text-success text-[10px]"
                            : "border-destructive/30 text-destructive text-[10px]"
                        }
                      >
                        {t.side === "buy" ? "LONG" : "SHORT"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-right text-foreground">
                      ${Number(t.entry_price).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-right text-muted-foreground">
                      {currentPrice ? `$${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                      {t.status === "open" && live && (
                        <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-xs font-mono text-right font-medium ${
                        displayPnl != null && displayPnl >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {displayPnl != null
                        ? `${displayPnl >= 0 ? "+" : ""}$${displayPnl.toFixed(2)}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          t.status === "open"
                            ? "border-warning/30 text-warning"
                            : t.status === "closed"
                            ? "border-success/30 text-success"
                            : "border-destructive/30 text-destructive"
                        }`}
                      >
                        {t.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
