import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "moderator" | "user";

/**
 * Reads the current user's roles from the public.user_roles table.
 * Role checks are server-side only — no URL/query-string bypass.
 */
export function useRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) { setRoles([]); setLoading(false); return; }
      const { data, error } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (!alive) return;
      if (error) { setRoles([]); }
      else { setRoles((data ?? []).map((r: any) => r.role as AppRole)); }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  const isAdmin = roles.includes("admin");
  const isModerator = isAdmin || roles.includes("moderator");
  return { roles, isAdmin, isModerator, loading };
}
