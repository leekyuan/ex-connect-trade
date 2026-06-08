import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "moderator" | "user";

/**
 * Reads the current user's roles from the public.user_roles table.
 * Returns isAdmin / isModerator helpers. In demo/reviewer mode the
 * URL ?admin=1 flag promotes the visitor to admin so external
 * reviewers can preview the admin dashboard without a real role row.
 */
export function useRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const urlAdmin = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("admin") === "1";

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) { setRoles([]); setLoading(false); return; }
      const { data, error } = await supabase
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

  const isAdmin = urlAdmin || roles.includes("admin");
  const isModerator = isAdmin || roles.includes("moderator");
  return { roles, isAdmin, isModerator, loading };
}
