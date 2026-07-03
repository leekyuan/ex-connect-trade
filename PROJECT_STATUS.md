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

Active backend: **Lovable Cloud (managed Supabase)**.

Standby/backup (NOT in use): external Supabase project `hoylvkjlkkvwiqvxuajx` (`cryptoedgeai-production`). Kept as a disaster-recovery candidate only. Do not point the frontend at it without an explicit migration plan.

Verified on 2026-07-03:

- Lovable Cloud connection healthy; DB/Auth/Edge Functions responding.
- Frontend env vars auto-managed by Cloud; `.env` / `.env.local` untouched.
- `LIVE_TRADING_ENABLED` unset → live trading hard-blocked by `_shared/riskGuard.ts`.
- `execute-trade`: JWT-gated, idempotency-key required, server-side leverage/size/loss caps, mandatory SL fail-closed.
- `binance-proxy`: JWT-gated, endpoint allowlist, market orders without `reduceOnly` rejected.
- API keys stored in `exchange_api_keys` (RLS: `auth.uid() = user_id`); no localStorage fallback.
- Paper Mode default ON via `useGlobalSafety`; `PaperTradingPanel` routes through simulation.



Historical note (2026-07-02): the standby project `hoylvkjlkkvwiqvxuajx` was previously provisioned with a full migration baseline and risk-guard secrets. It is retained as a cold backup only; the running app now uses Lovable Cloud.

Legacy: `hquupjdbfughvvffqctv` is deprecated — do not target.

Live trading must remain disabled until authenticated app flows, API-key storage, exchange behavior, and emergency procedures are tested end-to-end.

## Do Not Confuse With

- Old Remix projects
- Archived Lovable experiments
- Backup versions
- Test-only dashboards

## Manual QA Checklist (Auth → Dashboard → Paper → API Key)

Run against the preview URL. Do NOT enable `LIVE_TRADING_ENABLED`. Do NOT enter real exchange keys with withdraw permission.

### 1. Signup / Login
- [ ] Open `/auth`; sign up with a fresh email → success toast, redirected to dashboard.
- [ ] Log out (if UI exposes it) then log back in with same credentials → session restored.
- [ ] Refresh page → session persists (Supabase auth cookie/localStorage intact).
- [ ] Anonymous visitor auto-gets a guest session (`AuthContext` anonymous sign-in) → no crash on protected routes.
- [ ] Row in `profiles` auto-created via trigger; row in `subscriptions` (free plan) auto-created.

### 2. Dashboard load
- [ ] `/` (Today Signal) renders without console errors.
- [ ] BTC/ETH 4H signal cards show a status badge (BLOCKED / WATCH / PAPER_READY / LIVE_READY).
- [ ] If strategy is BLOCKED, no "LONG READY / SHORT READY" CTA is visible and execution buttons are disabled.
- [ ] Sidebar navigation to Verification, Security, Market Screener, Backtest all load without 500s.
- [ ] Global disclaimer bar visible at bottom.

### 3. Paper Mode
- [ ] `/security` → Risk Limits form: Paper Mode toggle is ON by default.
- [ ] Toggle Paper Mode OFF → Global Safety status flips to BLOCKED (paper required).
- [ ] Toggle Paper Mode ON → status returns to PAPER_READY / LIVE_READY per strategy gates.
- [ ] `PaperTradingPanel`: submit a simulated order → appears in trade history as paper (no network call to `execute-trade`).
- [ ] Network tab: no calls to `/functions/v1/execute-trade` while in Paper Mode.

### 4. API Key save UI
- [ ] `/security` → open API Safety Modal. Confirm 3 safety checkboxes are required before form unlocks.
- [ ] Enter dummy Binance testnet keys → Save → success toast.
- [ ] Verify write lands in `exchange_api_keys` table (RLS scoped to `auth.uid()`), NOT in `localStorage` (DevTools → Application → Local Storage should not contain plaintext keys).
- [ ] Reload page → "API 연결됨" indicator persists.
- [ ] Click "연결 테스트" → calls `binance-proxy` with JWT; returns 401 without JWT, 200 with valid session.
- [ ] Delete key → row removed from `exchange_api_keys`; UI reflects disconnected state.
- [ ] Attempt "Execute Live Order" while `LIVE_TRADING_ENABLED` is false → server responds with risk-guard block; UI shows blocked message.

### 5. Regression / safety
- [ ] No console errors on any of: `/`, `/verification`, `/backtest`, `/market-screener`, `/security`, `/settings`.
- [ ] Edge function logs (Cloud → Functions) show no unhandled exceptions during the run.
- [ ] `execute-trade` unauth call returns 401.
- [ ] `binance-proxy` unauth call returns 401.

## Next Review Tasks

- Automate the checklist above with Playwright.
- Add automated tests for live-trading safety gates.
- Re-run security scan after next migration.

