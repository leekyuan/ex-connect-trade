import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface JournalEntry {
  id: string;
  trade_id: string | null;
  symbol: string;
  side: string;
  entry_plan: string | null;
  review: string | null;
  emotion_score: number | null;
  followed_rules: boolean | null;
  rule_violations: any;
  tags: string[] | null;
  screenshot_url: string | null;
  outcome: string | null;
  pnl_pct: number | null;
  created_at: string;
  updated_at: string;
}

export function useTradeJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from("trade_journal")
      .select("*")
      .order("created_at", { ascending: false });
    setEntries((data ?? []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (entry: Partial<JournalEntry>) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("trade_journal").insert({
      user_id: u.user.id,
      symbol: entry.symbol ?? "BTCUSDT",
      side: entry.side ?? "LONG",
      entry_plan: entry.entry_plan ?? null,
      review: entry.review ?? null,
      emotion_score: entry.emotion_score ?? 5,
      followed_rules: entry.followed_rules ?? true,
      tags: entry.tags ?? [],
      outcome: entry.outcome ?? "open",
      pnl_pct: entry.pnl_pct ?? null,
    });
    fetch();
  };
  const update = async (id: string, patch: Partial<JournalEntry>) => {
    await supabase.from("trade_journal").update(patch).eq("id", id);
    fetch();
  };
  const remove = async (id: string) => {
    await supabase.from("trade_journal").delete().eq("id", id);
    fetch();
  };
  return { entries, loading, add, update, remove, refresh: fetch };
}