# Prompt History

Use this file to track important prompts given to Lovable, Codex, Claude, or other AI tools.

## Format

### YYYY-MM-DD - Tool Name

Prompt summary:

```text
Paste or summarize the prompt here.
```

Result:

```text
Summarize what changed.
```

Risk notes:

```text
Mention anything that needs review.
```

## 2026-07-02 - GitHub Setup

Prompt summary:

```text
Connected the main Lovable project to GitHub and prepared documentation files for Codex/Claude collaboration.
```

Result:

```text
Created initial project management documentation for CryptoEdgeAI.
```

Risk notes:

```text
Verify that no real secrets remain in the current tree or Git history.
```

## 2026-07-02 - Codex Repository Audit

Prompt summary:

```text
Audit the extracted GitHub repository for project structure, secrets, Supabase usage, and trading safety risks.
```

Result:

```text
Generated REPO_AUDIT_REPORT.md, corrected .env.example, and updated project safety/status documentation.
```

Risk notes:

```text
The repo is live-trading capable. Server-side risk enforcement, endpoint allowlisting, and duplicate-order protection are required before production live trading.
```

## 2026-07-02 - Server-Side Risk Guard

Prompt summary:

```text
Implement the server-side risk guard before adding more live trading features.
```

Result:

```text
Added shared Edge Function risk guard, live trading default-off gate, Binance endpoint allowlist, idempotency migration, and frontend idempotency/reduce-only request updates.
```

Risk notes:

```text
LIVE_TRADING_ENABLED must remain false until migrations, Supabase Edge Function secrets, and controlled live/testnet verification are complete.
```
