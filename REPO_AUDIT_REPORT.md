# Repository Audit Report

Date: 2026-07-02 KST

## 1. Executive Summary

This repository is live-trading capable, not dashboard-only.

The app contains a React/Vite frontend, Supabase tables, Supabase Edge Functions, paper trading UI, Binance Futures proxy logic, live position closing, and direct trade execution through `execute-trade`.

The latest extracted tree does not contain a committed `.env` file, and `.gitignore` now blocks common local env files. No obvious hardcoded service-role key, exchange secret, private key, or OpenAI key was found in the current tree during static search.

## 2. Security Findings

### High

- Exchange credentials are stored in `public.exchange_api_keys` as plaintext columns: `api_key`, `api_secret`, and optional `passphrase`.
  RLS limits user access, but a database/admin compromise would expose usable exchange secrets.
  Relevant file: `supabase/migrations/20260318123433_079227c7-a6e1-4664-aa45-7d9fb5c30ce3.sql`

- `binance-proxy` signs and forwards caller-provided Binance Futures endpoints as long as the endpoint starts with `/fapi/`.
  This should be allowlisted before production because it can reach many authenticated Binance futures actions.
  Relevant file: `supabase/functions/binance-proxy/index.ts`

- Current Git history may still contain removed `.env` values if they were committed before deletion.
  If any true secret was ever committed, rotate it in Supabase/exchanges.

### Medium

- `.env.example` previously documented `VITE_SUPABASE_ANON_KEY`, but the frontend reads `VITE_SUPABASE_PUBLISHABLE_KEY`.
  This has been corrected in `.env.example`.

- API key save flows are inconsistent.
  `ApiSafetyModal`, `ExchangeSettings`, and `BinanceApiSettings` include user-scoped storage, but `ApiKeyForm` upserts using `onConflict: "exchange"` and does not explicitly include `user_id`.
  Relevant file: `src/components/trading/ApiKeyForm.tsx`

## 3. Trading Safety Findings

### High

- `execute-trade` can create live exchange orders with ccxt.
  It sets leverage, places an entry limit order, then attempts TP1/TP2/SL orders.
  If protective TP/SL orders fail after entry, the function logs partial status but does not cancel the entry or force a safe rollback.
  Relevant file: `supabase/functions/execute-trade/index.ts`

- Server-side risk enforcement is not yet strong enough.
  UI risk settings are mostly localStorage-based and are not enforced inside `execute-trade` or `binance-proxy`.
  Relevant files:
  - `src/components/security/RiskLimitsForm.tsx`
  - `src/hooks/useGlobalSafety.ts`
  - `supabase/functions/execute-trade/index.ts`

- `OrderPanel` allows up to 125x leverage and uses a mock account balance for risk calculation.
  Relevant file: `src/components/Dashboard/OrderPanel.tsx`

- `PaperTradingPanel` can switch into live mode and send Binance market orders through `binance-proxy`.
  Relevant file: `src/components/Dashboard/PaperTradingPanel.tsx`

### Medium

- `auto-trade` is currently a placeholder RSI signal function. It returns signals but does not itself place orders.
  It should be renamed or heavily labeled as signal-only unless connected to a separate guarded executor.
  Relevant file: `supabase/functions/auto-trade/index.ts`

## 4. Architecture Findings

- App stack: Vite, React, TypeScript, shadcn-style UI, Supabase, Edge Functions.
- Core folders:
  - `src/pages`: routed app pages
  - `src/components`: dashboard, trading, market analysis, safety, UI components
  - `src/hooks`: market data, profile, safety, paper trading hooks
  - `src/utils`: signals, backtests, exchange API wrapper, risk/eligibility helpers
  - `supabase/functions`: Edge Functions for trading, proxying, news, Telegram, AI summaries
  - `supabase/migrations`: schema and RLS setup

## 5. Verification

Commands run with bundled Node/pnpm:

```text
vite build
vitest run
```

Results:

- Production build passed.
- Vitest passed: 1 test file, 1 test.
- Build warning: main JS chunk is larger than 500 kB.
- Build warning: some modules are both static and dynamic imports, reducing code-splitting benefit.

Note:

- Dependency install required network access.
- Local `node_modules/` and `dist/` were generated for verification and should not be committed.

## 6. Required Fixes Before Live Trading

1. Add server-side risk checks in every live execution function.
2. Add a hard server-side paper/live mode gate.
3. Restrict `binance-proxy` to an allowlist of safe endpoints.
4. Prevent entry orders unless SL placement can be guaranteed or rollback is implemented.
5. Add duplicate-order/idempotency protection.
6. Validate leverage, position size, symbol, side, entry, SL, TP, and account exposure server-side.
7. Encrypt exchange API secrets or move to a stronger secret-storage model.
8. Unify API key forms and remove/replace `ApiKeyForm` if it bypasses the intended `user_id,exchange` key path.
9. Rotate any key that was ever committed in `.env`.

## 7. Recommended Next Code Changes

Priority order:

1. Replace localStorage-only safety state with DB-backed user risk settings.
2. Add tests for risk limits, leverage caps, missing SL, duplicate orders, and paper/live separation.
3. Add exchange-key encryption or move exchange secrets to a stronger secret-storage model.
4. Add a true emergency stop switch that can disable all mutating Edge Functions.
5. Add monitoring/alerting for blocked live-order attempts.

## 8. Implemented Safety Brake

Implemented on 2026-07-02:

- Added shared server-side risk guard: `supabase/functions/_shared/riskGuard.ts`
- Added live trading default-off gate: `LIVE_TRADING_ENABLED=false`
- Added symbol allowlist: `ALLOWED_TRADING_SYMBOLS`
- Added server-side max leverage, max position, estimated per-trade loss, and daily loss checks
- Added idempotency-key requirement for `execute-trade`
- Added `trade_logs.idempotency_key` migration and unique index
- Added Binance Futures endpoint allowlist in `binance-proxy`
- Blocked unprotected Binance proxy market orders by default
- Made frontend `execute-trade` calls send an idempotency key
- Made Binance proxy close-position calls send `reduceOnly=true`

Remaining production requirement:

- Do not set `LIVE_TRADING_ENABLED=true` until Supabase migrations are applied, Edge Function secrets are configured, and live-order tests pass on a controlled account/testnet workflow.
