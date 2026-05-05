import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TelegramSettings {
  id: string;
  user_id: string;
  chat_id: string;
  enabled: boolean;
  notify_scalping: boolean;
  notify_daytrading: boolean;
  notify_swing: boolean;
  notify_price_alerts: boolean;
  min_confidence: number;
}

export function useTelegramSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<TelegramSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("telegram_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (mounted) {
        setSettings((data as TelegramSettings | null) ?? null);
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel(`telegram-settings-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "telegram_settings",
          filter: `user_id=eq.${user.id}`,
        },
        () => load(),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { settings, loading };
}
