
-- 1. error_logs: require auth for both insert & select
DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Users can view own error logs" ON public.error_logs;

CREATE POLICY "Authenticated users insert own error logs"
ON public.error_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own error logs"
ON public.error_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 2. subscriptions: remove user-side INSERT/UPDATE; only service role manages
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
-- SELECT policy remains so users can view their plan

-- 3. trade_history: add DELETE policy
CREATE POLICY "Users can delete own trade history"
ON public.trade_history FOR DELETE TO authenticated
USING (auth.uid() = user_id);
