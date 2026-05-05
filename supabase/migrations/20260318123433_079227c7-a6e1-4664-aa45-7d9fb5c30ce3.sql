-- Create table for storing exchange API keys
CREATE TABLE public.exchange_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  exchange TEXT NOT NULL CHECK (exchange IN ('binance', 'bybit', 'okx')),
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  passphrase TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, exchange)
);

ALTER TABLE public.exchange_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own API keys"
  ON public.exchange_api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys"
  ON public.exchange_api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
  ON public.exchange_api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
  ON public.exchange_api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Trade execution logs
CREATE TABLE public.trade_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  exchange TEXT NOT NULL,
  symbol TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  tp1_price NUMERIC NOT NULL,
  tp2_price NUMERIC NOT NULL,
  sl_price NUMERIC NOT NULL,
  tp_split_ratio INTEGER NOT NULL,
  leverage INTEGER NOT NULL,
  position_size NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trade logs"
  ON public.trade_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trade logs"
  ON public.trade_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);