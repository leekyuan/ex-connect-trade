import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TradingRule {
  id: string;
  rule_text: string;
  category: string;
  is_active: boolean;
  sort_order: number;
}

export function useTradingRules() {
  const [rules, setRules] = useState<TradingRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from("trading_rules")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setRules((data ?? []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (rule_text: string, category = "general") => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("trading_rules").insert({
      rule_text, category, user_id: u.user.id, sort_order: rules.length,
    });
    fetch();
  };
  const toggle = async (id: string, is_active: boolean) => {
    await supabase.from("trading_rules").update({ is_active }).eq("id", id);
    fetch();
  };
  const update = async (id: string, patch: Partial<TradingRule>) => {
    await supabase.from("trading_rules").update(patch).eq("id", id);
    fetch();
  };
  const remove = async (id: string) => {
    await supabase.from("trading_rules").delete().eq("id", id);
    fetch();
  };
  return { rules, loading, add, toggle, update, remove, refresh: fetch };
}