-- =========================================================
-- signal_history: AI 신호 적중률 추적
-- =========================================================
CREATE TABLE public.signal_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL DEFAULT '1h',
  side TEXT NOT NULL,                          -- LONG | SHORT | WATCH
  strength TEXT NOT NULL DEFAULT 'WEAK',       -- STRONG | MODERATE | WEAK
  confidence INTEGER NOT NULL DEFAULT 0,
  entry_price NUMERIC NOT NULL,
  sl_price NUMERIC,
  tp1_price NUMERIC,
  tp2_price NUMERIC,
  reasons JSONB,
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | win | loss | expired
  resolved_price NUMERIC,
  resolved_at TIMESTAMPTZ,
  pnl_pct NUMERIC,
  source TEXT DEFAULT 'screener',              -- screener | analysis | dashboard
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.signal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own signal history"
  ON public.signal_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own signal history"
  ON public.signal_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own signal history"
  ON public.signal_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own signal history"
  ON public.signal_history FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_signal_history_user_created ON public.signal_history(user_id, created_at DESC);
CREATE INDEX idx_signal_history_status ON public.signal_history(status);

-- =========================================================
-- trading_rules: 매매 원칙 체크리스트
-- =========================================================
CREATE TABLE public.trading_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  rule_text TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',    -- entry | exit | risk | psychology | general
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trading_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own trading rules"
  ON public.trading_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own trading rules"
  ON public.trading_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own trading rules"
  ON public.trading_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own trading rules"
  ON public.trading_rules FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_trading_rules_updated_at
  BEFORE UPDATE ON public.trading_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- trade_journal: 거래 일지
-- =========================================================
CREATE TABLE public.trade_journal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  trade_id UUID,                                -- optional link to portfolio_trades
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  entry_plan TEXT,                              -- 거래 전 계획
  review TEXT,                                  -- 거래 후 회고
  emotion_score INTEGER DEFAULT 5,              -- 1-10
  followed_rules BOOLEAN DEFAULT true,
  rule_violations JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  screenshot_url TEXT,
  outcome TEXT,                                 -- win | loss | breakeven | open
  pnl_pct NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own journal"
  ON public.trade_journal FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own journal"
  ON public.trade_journal FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own journal"
  ON public.trade_journal FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own journal"
  ON public.trade_journal FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_trade_journal_updated_at
  BEFORE UPDATE ON public.trade_journal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_trade_journal_user_created ON public.trade_journal(user_id, created_at DESC);