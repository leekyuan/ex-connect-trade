import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SignalRow {
  id: string;
  symbol: string;
  timeframe: string;
  side: string;
  strength: string;
  confidence: number;
  entry_price: number;
  sl_price: number | null;
  tp1_price: number | null;
  tp2_price: number | null;
  reasons: any;
  status: string;
  resolved_price: number | null;
  resolved_at: string | null;
  pnl_pct: number | null;
  source: string | null;
  created_at: string;
}

export interface AccuracyStats {
  total: number;
  pending: number;
  win: number;
  loss: number;
  expired: number;
  winRate: number;
  avgPnl: number;
  bySide: { LONG: { win: number; total: number }; SHORT: { win: number; total: number } };
  byStrength: Record<string, { win: number; total: number }>;
}

export function useSignalHistory(limit = 200) {
  const [rows, setRows] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = async () => {
    const { data } = await supabase
      .from("signal_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    setRows((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
    const ch = supabase
      .channel("signal_history_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "signal_history" }, fetchRows)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return { rows, loading, refresh: fetchRows };
}

export function calcAccuracy(rows: SignalRow[]): AccuracyStats {
  const stats: AccuracyStats = {
    total: rows.length, pending: 0, win: 0, loss: 0, expired: 0,
    winRate: 0, avgPnl: 0,
    bySide: { LONG: { win: 0, total: 0 }, SHORT: { win: 0, total: 0 } },
    byStrength: {},
  };
  let pnlSum = 0; let pnlCount = 0;
  for (const r of rows) {
    if (r.status === "pending") stats.pending++;
    else if (r.status === "win") stats.win++;
    else if (r.status === "loss") stats.loss++;
    else if (r.status === "expired") stats.expired++;

    if (r.side === "LONG" || r.side === "SHORT") {
      const k = r.side as "LONG" | "SHORT";
      if (r.status === "win" || r.status === "loss") {
        stats.bySide[k].total++;
        if (r.status === "win") stats.bySide[k].win++;
      }
    }
    if (r.strength) {
      stats.byStrength[r.strength] ??= { win: 0, total: 0 };
      if (r.status === "win" || r.status === "loss") {
        stats.byStrength[r.strength].total++;
        if (r.status === "win") stats.byStrength[r.strength].win++;
      }
    }
    if (r.pnl_pct != null) { pnlSum += Number(r.pnl_pct); pnlCount++; }
  }
  const resolved = stats.win + stats.loss;
  stats.winRate = resolved ? (stats.win / resolved) * 100 : 0;
  stats.avgPnl = pnlCount ? pnlSum / pnlCount : 0;
  return stats;
}

/**
 * Resolve pending signals against current prices.
 * Called periodically (e.g. every 60s) with a price map.
 */
export async function resolvePendingSignals(priceMap: Record<string, number>) {
  const { data: pending } = await supabase
    .from("signal_history")
    .select("*")
    .eq("status", "pending")
    .limit(500);
  if (!pending) return;
  const now = Date.now();
  const updates: Promise<any>[] = [];
  for (const s of pending as any as SignalRow[]) {
    const p = priceMap[s.symbol];
    if (!p) continue;
    const ageMs = now - new Date(s.created_at).getTime();
    const tfMs = tfToMs(s.timeframe) * 24; // expire after ~24 candles
    let status: string | null = null;
    let pnl: number | null = null;
    const dir = s.side === "LONG" ? 1 : s.side === "SHORT" ? -1 : 0;
    if (!dir) continue;
    if (s.tp1_price && ((dir === 1 && p >= s.tp1_price) || (dir === -1 && p <= s.tp1_price))) {
      status = "win";
      pnl = ((s.tp1_price - s.entry_price) / s.entry_price) * 100 * dir;
    } else if (s.sl_price && ((dir === 1 && p <= s.sl_price) || (dir === -1 && p >= s.sl_price))) {
      status = "loss";
      pnl = ((s.sl_price - s.entry_price) / s.entry_price) * 100 * dir;
    } else if (ageMs > tfMs) {
      status = "expired";
      pnl = ((p - s.entry_price) / s.entry_price) * 100 * dir;
    }
    if (status) {
      updates.push(
        Promise.resolve(
          supabase.from("signal_history").update({
            status, resolved_price: p, resolved_at: new Date().toISOString(), pnl_pct: pnl,
          }).eq("id", s.id)
        )
      );
    }
  }
  await Promise.all(updates);
}

function tfToMs(tf: string): number {
  const m: Record<string, number> = {
    "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000,
    "4h": 14_400_000, "1d": 86_400_000,
  };
  return m[tf] ?? 3_600_000;
}