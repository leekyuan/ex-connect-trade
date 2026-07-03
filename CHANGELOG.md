# Changelog

All important project changes should be recorded here.

## [Unreleased]

### Backend Status (2026-07-03)

- Active backend: **Lovable Cloud** (managed Supabase). Frontend env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) are auto-managed by Cloud and must not be edited manually.
- External Supabase project `hoylvkjlkkvwiqvxuajx` is **standby/backup only** — not connected to the running app.
- `LIVE_TRADING_ENABLED` remains unset (default `false`). Server-side risk guard hard-blocks live orders.
- `execute-trade` and `binance-proxy` retain JWT validation, allowlist, idempotency, and reduce-only enforcement. Do not disable.



### Added

- Main project documentation workflow
- Project status document
- Safety rules document
- Prompt history document
- Environment example file
- Repository audit report
- Server-side live-trading safety requirements
- Shared server-side risk guard for Supabase Edge Functions
- Live trading default-off environment gate
- Binance Futures endpoint allowlist
- Trade execution idempotency-key migration
- Frontend idempotency keys for `execute-trade` requests
- Supabase project link to `hquupjdbfughvvffqctv`
- Supabase Edge Function deployment notes for `execute-trade` and `binance-proxy`
- Clean Supabase production project `cryptoedgeai-production` using ref `hoylvkjlkkvwiqvxuajx`
- Full migration baseline applied to the clean production Supabase DB

### Changed

- README updated to define this repository as the main project source
- `.env.example` updated to match the frontend Supabase variable name used by the code
- `execute-trade` now validates live risk limits before placing orders
- `execute-trade` now fails closed when mandatory stop-loss placement fails
- `binance-proxy` now blocks non-allowlisted and unprotected mutating requests
- Binance close-position helper now sends `reduceOnly=true`
- `.gitignore` now excludes Supabase CLI local temp files
- Supabase config now targets the clean production project `hoylvkjlkkvwiqvxuajx`

### Fixed

- Fixed `.env.example` mismatch from `VITE_SUPABASE_ANON_KEY` to `VITE_SUPABASE_PUBLISHABLE_KEY`
- Applied the risk guard `trade_logs.idempotency_key` column and unique index directly to the linked Supabase DB because the remote legacy schema does not match the full local migration history

### Deprecated

- Legacy Supabase project `hquupjdbfughvvffqctv` is no longer the main production target for this repository

### Removed

- N/A
