
-- trading_settings table for API keys, leverage, and strategy parameters
CREATE TABLE public.trading_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  exchange text NOT NULL DEFAULT 'binance',
  api_key_encrypted text,
  api_secret_encrypted text,
  passphrase_encrypted text,
  default_leverage integer NOT NULL DEFAULT 10,
  auto_trade_enabled boolean NOT NULL DEFAULT false,
  strategy_params jsonb DEFAULT '{"rsi_period": 14, "rsi_oversold": 30, "rsi_overbought": 70}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, exchange)
);

ALTER TABLE public.trading_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trading settings" ON public.trading_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trading settings" ON public.trading_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trading settings" ON public.trading_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trading settings" ON public.trading_settings FOR DELETE USING (auth.uid() = user_id);

-- trade_history table for logging every buy/sell with PNL
CREATE TABLE public.trade_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  exchange text NOT NULL,
  symbol text NOT NULL,
  side text NOT NULL DEFAULT 'buy',
  entry_price numeric NOT NULL,
  exit_price numeric,
  quantity numeric NOT NULL,
  leverage integer NOT NULL DEFAULT 1,
  pnl numeric,
  pnl_percent numeric,
  status text NOT NULL DEFAULT 'open',
  order_type text NOT NULL DEFAULT 'limit',
  strategy text DEFAULT 'manual',
  metadata jsonb,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trade history" ON public.trade_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trade history" ON public.trade_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trade history" ON public.trade_history FOR UPDATE USING (auth.uid() = user_id);

-- Enable realtime for trade_history
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_history;
