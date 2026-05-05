import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Plan = "free" | "pro" | "enterprise";

export interface Subscription {
  id: string;
  user_id: string;
  plan: Plan;
  status: string;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
}

export const PLAN_LIMITS = {
  free: { coins: 5, autoTradePositions: 0, telegram: false, backtest: false, api: false },
  pro: { coins: 30, autoTradePositions: 3, telegram: true, backtest: false, api: false },
  enterprise: { coins: Infinity, autoTradePositions: Infinity, telegram: true, backtest: true, api: true },
} as const;

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (mounted) {
        setSubscription((data as Subscription | null) ?? { id: "", user_id: user.id, plan: "free", status: "active", stripe_subscription_id: null, current_period_end: null });
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel("subscription-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const plan: Plan = subscription?.plan ?? "free";
  const limits = PLAN_LIMITS[plan];

  return { subscription, plan, limits, loading };
}
