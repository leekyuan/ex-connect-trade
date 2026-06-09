
-- Explicitly deny writes from anon/authenticated on subscriptions (only service_role can modify)
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon, authenticated;

-- Explicitly deny writes from anon/authenticated on user_roles (privilege escalation prevention)
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;

-- Add restrictive policies to make intent explicit
DROP POLICY IF EXISTS "Deny user writes to subscriptions" ON public.subscriptions;
CREATE POLICY "Deny user writes to subscriptions"
ON public.subscriptions AS RESTRICTIVE
FOR ALL TO authenticated, anon
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny user writes to user_roles" ON public.user_roles;
CREATE POLICY "Deny user writes to user_roles"
ON public.user_roles AS RESTRICTIVE
FOR INSERT TO authenticated, anon
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny user updates to user_roles" ON public.user_roles;
CREATE POLICY "Deny user updates to user_roles"
ON public.user_roles AS RESTRICTIVE
FOR UPDATE TO authenticated, anon
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny user deletes from user_roles" ON public.user_roles;
CREATE POLICY "Deny user deletes from user_roles"
ON public.user_roles AS RESTRICTIVE
FOR DELETE TO authenticated, anon
USING (false);

-- trade_logs: append-only by design but add explicit deny for clarity
DROP POLICY IF EXISTS "Deny updates to trade_logs" ON public.trade_logs;
CREATE POLICY "Deny updates to trade_logs"
ON public.trade_logs AS RESTRICTIVE
FOR UPDATE TO authenticated, anon
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny deletes from trade_logs" ON public.trade_logs;
CREATE POLICY "Deny deletes from trade_logs"
ON public.trade_logs AS RESTRICTIVE
FOR DELETE TO authenticated, anon
USING (false);

-- Revoke EXECUTE on SECURITY DEFINER functions from public/anon/authenticated
-- has_role is used in RLS policies (called by Postgres planner, not directly) — safe to revoke
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_subscription() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
