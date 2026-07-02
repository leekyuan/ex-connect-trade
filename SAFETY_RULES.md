# Safety Rules

This project may involve crypto trading, crypto signals, or future automated trading workflows.

Real funds can be lost. Safety rules must be preserved.

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

## AI Agent Rules

Codex, Claude, Lovable, or any AI assistant must not:

- Delete safety logic without explicit approval
- Convert paper trading to live trading by default
- Add real API keys to code
- Hide risk warnings from the UI
- Present simulations as guaranteed results
