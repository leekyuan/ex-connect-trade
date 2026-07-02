# Changelog

All important project changes should be recorded here.

## [Unreleased]

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

### Changed

- README updated to define this repository as the main project source
- `.env.example` updated to match the frontend Supabase variable name used by the code
- `execute-trade` now validates live risk limits before placing orders
- `execute-trade` now fails closed when mandatory stop-loss placement fails
- `binance-proxy` now blocks non-allowlisted and unprotected mutating requests
- Binance close-position helper now sends `reduceOnly=true`

### Fixed

- Fixed `.env.example` mismatch from `VITE_SUPABASE_ANON_KEY` to `VITE_SUPABASE_PUBLISHABLE_KEY`

### Removed

- N/A
