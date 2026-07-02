# Project Status

## Main Project

Project name: CryptoEdgeAI - Main Dashboard  
GitHub repository: ex-connect-trade  
Status: Main Lovable project connected to GitHub

## Current Goal

Prepare the project so Codex, Claude, and Lovable can safely modify and review it without confusing it with old Remix versions.

## Current Classification

This repository is not dashboard-only.

It is live-trading capable because it contains:

- Supabase Edge Function trade execution through `execute-trade`
- Binance Futures signed proxy through `binance-proxy`
- API key storage in `exchange_api_keys`
- UI paths that can call live order functions

Treat the project as a high-risk trading application until server-side safety gates are strengthened.

## Current Priorities

1. Keep this repository as the main source of truth.
2. Preserve existing working UI and dashboard behavior.
3. Identify and document trading-related logic.
4. Separate experiment changes from production changes.
5. Keep all secrets out of GitHub.
6. Do not enable live trading by default.
7. Move critical risk controls from UI/localStorage into server-side enforcement.

## Current Safety Implementation

Server-side safety brake added:

- `supabase/functions/_shared/riskGuard.ts`
- `supabase/functions/execute-trade/index.ts`
- `supabase/functions/binance-proxy/index.ts`
- `supabase/migrations/20260702000100_add_trade_risk_guards.sql`

Default behavior:

- Live order execution is blocked unless `LIVE_TRADING_ENABLED=true` is configured server-side.
- Only allowlisted symbols can be traded.
- Server-side leverage, position size, estimated loss, and daily loss checks run before `execute-trade`.
- `execute-trade` requires an idempotency key to reduce duplicate-order risk.
- `binance-proxy` allows only specific Binance Futures endpoints and blocks unprotected market orders by default.

## Supabase Deployment Status

Active Supabase project ref: `hquupjdbfughvvffqctv`

Deployment status on 2026-07-02:

- Local project linked to `hquupjdbfughvvffqctv`.
- `LIVE_TRADING_ENABLED=false` configured in Supabase Edge Function secrets.
- Risk guard secrets configured for symbol allowlist, leverage cap, position cap, and loss caps.
- `execute-trade` deployed and ACTIVE.
- `binance-proxy` deployed and ACTIVE.
- Unauthenticated HTTP checks return 401, as expected.

Important schema note:

- The remote Supabase DB currently has a different legacy schema than the local migration history.
- Do not run full `supabase db push` until the remote schema is reconciled or baselined.
- The risk guard DB change was applied directly: `trade_logs.idempotency_key` plus a unique `(user_id, idempotency_key)` index.
- Live trading must remain disabled until the remote DB schema is reconciled with the app code, especially `exchange_api_keys`, `trade_history`, and `trade_logs`.

## Do Not Confuse With

- Old Remix projects
- Archived Lovable experiments
- Backup versions
- Test-only dashboards

## Next Review Tasks

- Review `REPO_AUDIT_REPORT.md`.
- Reconcile the remote Supabase schema with the app code before enabling live trading.
- Unify API key storage forms and verify `exchange_api_keys` exists remotely.
- Decide whether to baseline existing remote migrations or create a clean production Supabase project.
- Add automated tests for live-trading safety gates.
