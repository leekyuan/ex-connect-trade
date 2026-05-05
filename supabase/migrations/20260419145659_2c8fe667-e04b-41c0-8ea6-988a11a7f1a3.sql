-- 1. 텔레그램 알림 설정 (Lovable Telegram Connector 사용 - bot_token은 시스템 공용, chat_id만 사용자별)
CREATE TABLE IF NOT EXISTS public.telegram_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  chat_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  notify_scalping boolean NOT NULL DEFAULT true,
  notify_daytrading boolean NOT NULL DEFAULT true,
  notify_swing boolean NOT NULL DEFAULT true,
  notify_price_alerts boolean NOT NULL DEFAULT true,
  min_confidence integer NOT NULL DEFAULT 65,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own telegram settings" ON public.telegram_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own telegram settings" ON public.telegram_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own telegram settings" ON public.telegram_settings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own telegram settings" ON public.telegram_settings
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_telegram_settings_updated
  BEFORE UPDATE ON public.telegram_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. 포트폴리오 거래 (수동/시뮬레이션 거래)
CREATE TABLE IF NOT EXISTS public.portfolio_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  symbol text NOT NULL,
  side text NOT NULL CHECK (side IN ('LONG','SHORT')),
  entry_price numeric NOT NULL,
  exit_price numeric,
  stop_loss numeric,
  take_profit numeric,
  quantity numeric NOT NULL,
  leverage integer NOT NULL DEFAULT 1,
  pnl_usdt numeric DEFAULT 0,
  pnl_pct numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  entry_at timestamptz NOT NULL DEFAULT now(),
  exit_at timestamptz,
  note text
);

ALTER TABLE public.portfolio_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own portfolio trades" ON public.portfolio_trades
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own portfolio trades" ON public.portfolio_trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own portfolio trades" ON public.portfolio_trades
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own portfolio trades" ON public.portfolio_trades
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_portfolio_trades_user_status ON public.portfolio_trades(user_id, status);
CREATE INDEX idx_portfolio_trades_user_entry ON public.portfolio_trades(user_id, entry_at DESC);

-- 3. 가격 알림
CREATE TABLE IF NOT EXISTS public.price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  symbol text NOT NULL,
  condition text NOT NULL CHECK (condition IN ('above','below')),
  target_price numeric NOT NULL,
  triggered boolean NOT NULL DEFAULT false,
  triggered_at timestamptz,
  notify_telegram boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own price alerts" ON public.price_alerts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own price alerts" ON public.price_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own price alerts" ON public.price_alerts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own price alerts" ON public.price_alerts
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_price_alerts_user_triggered ON public.price_alerts(user_id, triggered);