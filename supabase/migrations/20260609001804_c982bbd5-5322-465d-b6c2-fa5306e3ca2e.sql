
ALTER TABLE public.exchange_api_keys DROP CONSTRAINT IF EXISTS exchange_api_keys_exchange_check;
ALTER TABLE public.exchange_api_keys ADD CONSTRAINT exchange_api_keys_exchange_check
  CHECK (exchange = ANY (ARRAY['binance','bybit','okx','bitget','gate']));
