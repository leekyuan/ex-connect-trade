import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  calcPortfolioStats,
  buildHeatmap,
  tradesToCSV,
  downloadCSV,
  type PortfolioTrade,
} from "@/utils/portfolio";
import { generateDemoTrades, calcExtendedStats, parseBinanceCSV } from "@/utils/portfolioDemo";
import {
  AreaChart,
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import MultiExchangeBalancePanel from "@/components/Portfolio/MultiExchangeBalancePanel";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Download,
  Upload,
  Loader2,
  TrendingUp,
  TrendingDown,
  PieChart,
  X,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

function MetricCard({
  label,
  value,
  color = "text-foreground",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

const heatColor = (v: number | null) => {
  if (v === null) return "bg-muted/30 text-muted-foreground";
  if (v >= 10) return "bg-emerald-600 text-white";
  if (v >= 5) return "bg-emerald-500/70 text-white";
  if (v >= 0) return "bg-emerald-500/30 text-emerald-200";
  if (v > -5) return "bg-red-500/30 text-red-200";
  if (v > -10) return "bg-red-500/70 text-white";
  return "bg-red-600 text-white";
};

const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

type RangeFilter = "1W" | "1M" | "3M" | "ALL";

export default function PortfolioPage() {
  const { user } = useAuth();
  const [dbTrades, setDbTrades] = useState<PortfolioTrade[]>([]);
  const [demoTrades, setDemoTrades] = useState<PortfolioTrade[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<RangeFilter>("ALL");
  const importRef = useRef<HTMLInputElement>(null);

  // form state
  const [symbol, setSymbol] = useState("BTC");
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [leverage, setLeverage] = useState("1");

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("portfolio_trades")
        .select("*")
        .eq("user_id", user.id)
        .order("entry_at", { ascending: false });
      if (mounted) {
        setDbTrades((data as PortfolioTrade[]) ?? []);
        setLoading(false);
      }
    };
    load();
    const channel = supabase
      .channel(`portfolio-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portfolio_trades", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Demo mode shows demo trades, otherwise DB
  const trades = demoTrades ?? dbTrades;

  // Apply range filter to closed trades
  const filteredTrades = useMemo(() => {
    if (range === "ALL") return trades;
    const now = Date.now();
    const days = range === "1W" ? 7 : range === "1M" ? 30 : 90;
    const cutoff = now - days * 86400_000;
    return trades.filter(t => new Date(t.entry_at).getTime() >= cutoff);
  }, [trades, range]);

  const stats = useMemo(() => calcPortfolioStats(filteredTrades), [filteredTrades]);
  const ext = useMemo(() => calcExtendedStats(filteredTrades), [filteredTrades]);
  const heatmap = useMemo(() => buildHeatmap(stats.monthly), [stats.monthly]);

  const isEmpty = trades.length === 0;
  const isDemo = demoTrades !== null;

  const handleLoadDemo = () => {
    setDemoTrades(generateDemoTrades(20));
    toast.success("데모 데이터 20건 로드됨");
  };

  const handleClearDemo = () => {
    setDemoTrades(null);
    toast("데모 모드 해제됨");
  };

  const handleAdd = async () => {
    if (!user) return;
    if (isDemo) {
      toast.error("데모 모드에서는 거래를 추가할 수 없습니다");
      return;
    }
    const ep = Number(entryPrice);
    const xp = exitPrice ? Number(exitPrice) : null;
    const qty = Number(quantity);
    const lev = Number(leverage) || 1;
    if (!symbol || !ep || !qty) {
      toast.error("심볼/진입가/수량은 필수입니다");
      return;
    }
    setAdding(true);
    let pnlUsdt = 0;
    let pnlPct = 0;
    let status: "open" | "closed" = "open";
    let exitAt: string | null = null;
    if (xp) {
      const raw = side === "LONG" ? xp / ep - 1 : ep / xp - 1;
      pnlPct = Number((raw * lev * 100).toFixed(2));
      pnlUsdt = Number((raw * ep * qty * lev).toFixed(2));
      status = "closed";
      exitAt = new Date().toISOString();
    }
    const { error } = await supabase.from("portfolio_trades").insert({
      user_id: user.id,
      symbol: symbol.toUpperCase(),
      side,
      entry_price: ep,
      exit_price: xp,
      quantity: qty,
      leverage: lev,
      pnl_usdt: pnlUsdt,
      pnl_pct: pnlPct,
      status,
      exit_at: exitAt,
    });
    setAdding(false);
    if (error) toast.error(error.message);
    else {
      toast.success("거래가 추가되었습니다");
      setOpen(false);
      setEntryPrice("");
      setExitPrice("");
      setQuantity("");
    }
  };

  const handleClosePosition = async (trade: PortfolioTrade) => {
    if (isDemo) return;
    const exitStr = window.prompt(`청산 가격 입력 (${trade.symbol}/${trade.side})`, String(trade.entry_price));
    if (!exitStr) return;
    const xp = Number(exitStr);
    if (!xp) return;
    const raw = trade.side === "LONG" ? xp / trade.entry_price - 1 : trade.entry_price / xp - 1;
    const pnlPct = Number((raw * trade.leverage * 100).toFixed(2));
    const pnlUsdt = Number((raw * trade.entry_price * trade.quantity * trade.leverage).toFixed(2));
    const { error } = await supabase
      .from("portfolio_trades")
      .update({
        exit_price: xp,
        pnl_pct: pnlPct,
        pnl_usdt: pnlUsdt,
        status: "closed",
        exit_at: new Date().toISOString(),
      })
      .eq("id", trade.id);
    if (error) toast.error(error.message);
    else toast.success("포지션이 청산되었습니다");
  };

  const handleExportCSV = () => {
    const csv = tradesToCSV(filteredTrades);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    downloadCSV(`cryptoedge_trades_${date}.csv`, csv);
  };

  const handleImportClick = () => importRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (isDemo) {
      toast.error("데모 모드를 먼저 해제하세요");
      e.target.value = "";
      return;
    }
    const text = await file.text();
    const parsed = parseBinanceCSV(text);
    e.target.value = "";
    if (parsed.length === 0) {
      toast.error("파싱 가능한 거래가 없습니다");
      return;
    }
    const rows = parsed.map(p => ({
      user_id: user.id,
      symbol: p.symbol!,
      side: p.side!,
      entry_price: p.entry_price!,
      exit_price: p.exit_price ?? null,
      quantity: p.quantity!,
      leverage: p.leverage ?? 1,
      pnl_usdt: p.pnl_usdt ?? 0,
      pnl_pct: p.pnl_pct ?? 0,
      status: p.status ?? "closed",
      entry_at: p.entry_at ?? new Date().toISOString(),
      exit_at: p.exit_at ?? null,
    }));
    const { error } = await supabase.from("portfolio_trades").insert(rows);
    if (error) toast.error(error.message);
    else toast.success(`${rows.length}개 거래를 가져왔습니다`);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Empty state with demo button
  if (isEmpty) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-2xl p-8 text-center space-y-4">
          <PieChart className="mx-auto h-12 w-12 text-primary/60" />
          <h1 className="text-2xl font-bold">포트폴리오</h1>
          <p className="text-muted-foreground">
            아직 거래 내역이 없습니다. 데모 데이터로 미리보기를 시작하거나 직접 거래를 추가하세요.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button size="lg" onClick={handleLoadDemo}>
              <Sparkles className="mr-2 h-4 w-4" /> 데모 데이터로 미리보기
            </Button>
            <Button size="lg" variant="outline" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> 거래 추가
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5 p-4">
        {isDemo && (
          <div className="flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-400">데모 모드 — 가상 거래 데이터로 표시 중</span>
            </div>
            <Button size="sm" variant="outline" onClick={handleClearDemo}>
              <XCircle className="mr-2 h-4 w-4" /> 데모 종료
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <PieChart className="h-6 w-6 text-primary" /> 포트폴리오
            </h1>
            <p className="text-sm text-muted-foreground">실거래 + 시뮬레이션 거래 기록 및 분석</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={importRef} type="file" accept=".csv" onChange={handleImportFile} className="hidden" />
            <Button variant="outline" size="sm" onClick={handleImportClick}>
              <Upload className="mr-2 h-4 w-4" /> CSV 가져오기
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!trades.length}>
              <Download className="mr-2 h-4 w-4" /> CSV 내보내기
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" /> 거래 추가
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>거래 추가</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>심볼</Label>
                    <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>방향</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(["LONG", "SHORT"] as const).map((s) => (
                        <Button
                          key={s}
                          type="button"
                          variant={side === s ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSide(s)}
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>진입가</Label>
                    <Input type="number" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>청산가 (선택)</Label>
                    <Input type="number" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>수량</Label>
                    <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>레버리지</Label>
                    <Input type="number" value={leverage} onChange={(e) => setLeverage(e.target.value)} />
                  </div>
                </div>
                {entryPrice && exitPrice && quantity && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
                    {(() => {
                      const ep = Number(entryPrice), xp = Number(exitPrice), qty = Number(quantity), lev = Number(leverage) || 1;
                      const raw = side === "LONG" ? xp / ep - 1 : ep / xp - 1;
                      const pct = raw * lev * 100;
                      const usd = raw * ep * qty * lev;
                      const cls = pct >= 0 ? "text-emerald-400" : "text-red-400";
                      return (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">예상 손익</span>
                          <span className={`font-bold ${cls}`}>
                            {pct >= 0 ? "+" : ""}{pct.toFixed(2)}% / {usd >= 0 ? "+" : ""}${usd.toFixed(2)}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
                  <Button onClick={handleAdd} disabled={adding}>
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "추가"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">📊 거래 분석</TabsTrigger>
            <TabsTrigger value="balances">💰 거래소 잔고</TabsTrigger>
          </TabsList>

          <TabsContent value="balances">
            <MultiExchangeBalancePanel />
          </TabsContent>

          <TabsContent value="overview" className="space-y-5">
        {/* Range filter */}
        <div className="flex gap-1.5">
          {(["1W", "1M", "3M", "ALL"] as RangeFilter[]).map(r => (
            <Button
              key={r}
              size="sm"
              variant={range === r ? "default" : "outline"}
              onClick={() => setRange(r)}
            >
              {r === "ALL" ? "전체" : r === "1W" ? "1주" : r === "1M" ? "1개월" : "3개월"}
            </Button>
          ))}
        </div>

        {/* 지표 카드 */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="총 거래" value={String(stats.totalTrades)} />
          <MetricCard label="오픈" value={String(stats.openTrades)} />
          <MetricCard
            label="총 PnL"
            value={`${stats.totalPnl >= 0 ? "+" : ""}$${stats.totalPnl.toLocaleString()}`}
            color={stats.totalPnl >= 0 ? "text-emerald-500" : "text-red-500"}
          />
          <MetricCard
            label="총 수익률"
            value={`${stats.totalReturnPct >= 0 ? "+" : ""}${stats.totalReturnPct}%`}
            color={stats.totalReturnPct >= 0 ? "text-emerald-500" : "text-red-500"}
          />
          <MetricCard
            label="승률"
            value={`${stats.winRate}%`}
            color={stats.winRate >= 50 ? "text-emerald-500" : "text-amber-500"}
          />
          <MetricCard
            label="MDD"
            value={`${stats.maxDD}%`}
            color={stats.maxDD > 20 ? "text-red-500" : "text-amber-500"}
          />
        </div>

        {/* 확장 지표 */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            label="Profit Factor"
            value={ext.profitFactor.toFixed(2)}
            color={ext.profitFactor >= 1.5 ? "text-emerald-500" : ext.profitFactor >= 1 ? "text-amber-500" : "text-red-500"}
          />
          <MetricCard
            label="평균 거래 PnL"
            value={`${ext.avgPerTrade >= 0 ? "+" : ""}$${ext.avgPerTrade}`}
            color={ext.avgPerTrade >= 0 ? "text-emerald-500" : "text-red-500"}
          />
          <MetricCard label="최대 연속 수익" value={`${ext.maxWinStreak}회`} color="text-emerald-500" />
          <MetricCard label="최대 연속 손실" value={`${ext.maxLossStreak}회`} color="text-red-500" />
          <MetricCard
            label="베스트/워스트"
            value={`${ext.best?.pnl_usdt?.toFixed(0) ?? 0} / ${ext.worst?.pnl_usdt?.toFixed(0) ?? 0}`}
          />
        </div>

        {/* 에쿼티 커브 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">에쿼티 커브</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.curve.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                청산된 거래가 없습니다.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={stats.curve}>
                  <defs>
                    <linearGradient id="pf-eq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: any, name: any, props: any) => {
                      if (name === "equity") {
                        const pnl = props?.payload?.pnl ?? 0;
                        return [`$${Number(value).toLocaleString()} (PnL: ${pnl >= 0 ? "+" : ""}$${pnl})`, "잔고"];
                      }
                      return [value, name];
                    }}
                  />
                  <Area type="monotone" dataKey="equity" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#pf-eq)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 월별 히트맵 */}
        {heatmap.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">월별 수익률 히트맵</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="px-2 py-2 text-left">연도</th>
                      {MONTHS.map((m) => (
                        <th key={m} className="px-1 py-2 text-center font-medium">{m}</th>
                      ))}
                      <th className="px-2 py-2 text-center font-bold">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.map((row) => (
                      <tr key={row.year}>
                        <td className="px-2 py-1 font-bold">{row.year}</td>
                        {row.months.map((v, i) => (
                          <td key={i} className="px-1 py-1">
                            <div className={`rounded px-1 py-1.5 text-center ${heatColor(v)}`}>
                              {v === null ? "—" : `${v >= 0 ? "+" : ""}${v}%`}
                            </div>
                          </td>
                        ))}
                        <td className="px-2 py-1 text-center font-bold">
                          <span className={row.total >= 0 ? "text-emerald-500" : "text-red-500"}>
                            {row.total >= 0 ? "+" : ""}{row.total}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 거래 내역 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">거래 내역 ({filteredTrades.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  {["진입일", "심볼", "방향", "레버리지", "진입가", "청산가", "수익률", "PnL", "상태", ""].map((h) => (
                    <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((t) => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="px-2 py-2">{t.entry_at.slice(0, 10)}</td>
                    <td className="px-2 py-2 font-semibold">{t.symbol}</td>
                    <td className="px-2 py-2">
                      <Badge variant={t.side === "LONG" ? "default" : "destructive"} className="text-[10px]">
                        {t.side === "LONG" ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                        {t.side}
                      </Badge>
                    </td>
                    <td className="px-2 py-2">{t.leverage}x</td>
                    <td className="px-2 py-2">{Number(t.entry_price).toLocaleString()}</td>
                    <td className="px-2 py-2">{t.exit_price ? Number(t.exit_price).toLocaleString() : "—"}</td>
                    <td className={`px-2 py-2 font-semibold ${(t.pnl_pct ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {t.pnl_pct ? `${t.pnl_pct >= 0 ? "+" : ""}${t.pnl_pct}%` : "—"}
                    </td>
                    <td className={`px-2 py-2 font-semibold ${(t.pnl_usdt ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {t.pnl_usdt ? `${t.pnl_usdt >= 0 ? "+" : ""}${t.pnl_usdt}` : "—"}
                    </td>
                    <td className="px-2 py-2">
                      <Badge variant={t.status === "open" ? "outline" : "secondary"} className="text-[10px]">
                        {t.status === "open" ? "오픈" : "청산"}
                      </Badge>
                    </td>
                    <td className="px-2 py-2">
                      {t.status === "open" && !isDemo && (
                        <Button size="sm" variant="ghost" onClick={() => handleClosePosition(t)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
