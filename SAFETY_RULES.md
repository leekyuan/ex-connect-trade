# Safety Rules

This project may involve crypto trading, crypto signals, or future automated trading workflows.

Real funds can be lost. Safety rules must be preserved.

## Current Operating Baseline (2026-07-07)

- Active backend: **Lovable Cloud** (managed Supabase). External Supabase transition is **cancelled**.
- `hoylvkjlkkvwiqvxuajx` = standby/backup only, NOT the running backend.
- `hquupjdbfughvvffqctv` = legacy, unused.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID` are auto-managed by Lovable Cloud — do NOT edit `.env` / `.env.local` / `.env.example` manually.
- Never commit real API keys or `service_role` key. `service_role` MUST NOT appear in frontend code.
- `LIVE_TRADING_ENABLED` is unset (= default `false`). Server-side guard hard-blocks all live orders.
- Live trading remains OFF and must NOT be enabled without explicit admin approval and completed server safety review.


## Mandatory Rules

- Live trading must be disabled by default.
- Paper/test mode must be the default mode.
- API keys must never be hardcoded.
- Secrets must never be committed to GitHub.
- Use `.env.example` for examples only.
- Do not remove stop-loss, loss limits, exposure limits, or emergency stop logic.
- Do not claim guaranteed profit.
- Do not use future data in backtests.
- Do not remove error handling around orders, API calls, or account state checks.
- UI-only or localStorage-only safety checks are not enough for live trading.
- Server-side functions must enforce risk limits before any live order is sent.
- Live order functions must fail closed when validation, API lookup, SL placement, or account-state checks fail.
- `LIVE_TRADING_ENABLED` must stay `false` until explicit production approval.
- `LIVE_TRADING_ENABLED` must stay `false` until the clean production Supabase project has passed authenticated end-to-end tests.
- Do not use the legacy Supabase project `hquupjdbfughvvffqctv` as the main production DB.
- Binance proxy order endpoints must stay allowlisted.
- Unprotected market orders must stay blocked unless there is a separately reviewed bracket-order flow.

## Required Trading Safety Controls

Any live or paper trading system must include:

- Max loss per trade
- Max daily loss
- Max total account exposure
- Duplicate order prevention
- API failure handling
- Position state verification
- Manual emergency stop
- Clear paper/live mode separation
- Server-side leverage cap
- Server-side max position size check
- Server-side daily loss check
- Server-side duplicate-order/idempotency check
- Server-side allowlist for exchange API endpoints
- Idempotency key for every live order request
- Default-off environment switch for mutating live trading functions
- Verified remote DB tables for API keys, trade history, trade logs, and idempotency checks

## AI Agent Rules

Codex, Claude, Lovable, or any AI assistant must not:

- Delete safety logic without explicit approval
- Convert paper trading to live trading by default
- Add real API keys to code
- Hide risk warnings from the UI
- Present simulations as guaranteed results
- Bypass `REPO_AUDIT_REPORT.md` findings without explicit approval
