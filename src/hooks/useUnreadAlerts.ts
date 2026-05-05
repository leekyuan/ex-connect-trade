import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const KEY = 'cryptoedge-alerts-lastvisit';

export function useUnreadAlerts() {
  const [unread, setUnread] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const since = localStorage.getItem(KEY) || new Date(0).toISOString();
      const { count } = await supabase
        .from('price_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('triggered', true)
        .gt('triggered_at', since);
      if (alive) setUnread(count ?? 0);
    }
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return unread;
}

export function markAlertsRead() {
  localStorage.setItem(KEY, new Date().toISOString());
}
