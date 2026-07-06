-- Revoke broad column privileges then re-grant only the non-secret columns to authenticated.
REVOKE SELECT ON public.exchange_api_keys FROM authenticated;
REVOKE SELECT ON public.exchange_api_keys FROM anon;

GRANT SELECT (id, user_id, exchange, api_key, created_at, updated_at) ON public.exchange_api_keys TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.exchange_api_keys TO authenticated;
GRANT ALL ON public.exchange_api_keys TO service_role;