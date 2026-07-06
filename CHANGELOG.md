# Changelog

All important project changes should be recorded here.

## [Unreleased]

### Security Hardening (2026-07-06)

- **`exchange_api_keys` 컬럼 권한 강화 (migration)**: `authenticated` 역할의 테이블-와이드 `SELECT` 권한을 회수하고, `api_secret` / `passphrase`를 제외한 컬럼(`id, user_id, exchange, api_key, created_at, updated_at`)만 컬럼 레벨 SELECT를 재부여. 프론트엔드에서는 Secret/Passphrase가 절대 조회되지 않으며, 서명은 `service_role`을 사용하는 Edge Function(`execute-trade`, `binance-proxy`)에서만 수행됩니다.
- **레거시 `ApiKeyForm.tsx` 저장 로직 제거**: `supabase.from("exchange_api_keys").upsert(..., { onConflict: "exchange" })` 평문 저장 경로를 삭제하고, Settings의 거래소 연동 화면으로 리디렉션하는 안내 컴포넌트로 대체했습니다.
- **프론트 Safety Gate 강제**: `TradingPanel`, `OrderPanel`, `PaperTradingPanel`의 실거래 실행 경로에 `isDemoMode()` + `useGlobalSafety()` 체크를 추가. Demo/Paper Mode 또는 `state !== 'LIVE_READY'`인 경우 `execute-trade` / `binance-proxy` 호출을 UI 단계에서 차단합니다(서버 가드는 유지).
- **서버측 실거래 마스터 스위치**: `LIVE_TRADING_ENABLED`는 시크릿에 설정되지 않은 상태(=false)이며, `supabase/functions/_shared/riskGuard.ts`의 `assertLiveTradingEnabled()`가 모든 실주문(POST/DELETE, leverage 변경, MARKET) 호출을 403으로 차단합니다.
- **`auto-trade` 분리 확인**: Edge Function은 RSI 시그널만 반환하고 실주문/`ccxt` 호출을 포함하지 않음을 재확인했습니다.
- `.env`, `.env.local`, `.env.*.local`은 `.gitignore`에 등록되어 있으며 커밋되지 않습니다.



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
