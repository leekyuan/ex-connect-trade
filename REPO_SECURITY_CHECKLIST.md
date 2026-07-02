# Repository Security Checklist

Use this checklist before committing or deploying trading-related changes.

## Immediate Checks

- [ ] `.env` is not visible in the latest GitHub file tree.
- [ ] `.gitignore` includes `.env`, `.env.local`, and `.env.*.local`.
- [ ] `.env.example` exists and contains placeholders only.
- [ ] No real API keys, passwords, tokens, or private keys are present in `.env.example`.
- [ ] README.md warns that secrets must not be committed.

## Supabase Key Review

- `VITE_SUPABASE_URL`: public project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: public frontend key used by this app.
- `SUPABASE_ANON_KEY`: Edge Function environment variable.
- `SUPABASE_SERVICE_ROLE_KEY`: secret. Must never be committed.
- Database password / connection string: secret. Must never be committed.
- JWT secret: secret. Must never be committed.

If any secret value was committed, rotate it.

## Trading App Safety

- [ ] Default mode is paper/test mode.
- [ ] Live trading cannot be activated accidentally.
- [ ] No exchange secret keys are stored in frontend code.
- [ ] `LIVE_TRADING_ENABLED=false` by default in server secrets.
- [ ] `ALLOWED_TRADING_SYMBOLS` is restricted to approved symbols only.
- [ ] `MAX_LIVE_LEVERAGE`, `MAX_POSITION_USDT`, and loss caps are configured conservatively.
- [ ] Server-side live trading functions enforce risk limits.
- [ ] Server-side live trading functions have duplicate-order protection.
- [ ] Binance proxy mutating endpoints are allowlisted only.
- [ ] Unprotected market orders are blocked by default.
- [ ] Risk warnings are visible.
- [ ] No UI text promises guaranteed profit.
- [ ] There is a manual emergency stop plan before live trading.
