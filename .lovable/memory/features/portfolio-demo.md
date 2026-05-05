---
name: Portfolio Demo & CSV Import
description: Client-side demo trade generator, Binance Futures CSV import parser, extended portfolio statistics
type: feature
---

`src/utils/portfolioDemo.ts` exports:
- `generateDemoTrades(count)` — creates 20 random trades over the past 30 days, 60% win rate, 2 open positions. Demo trades have `id: "demo-N"` and never touch the database.
- `calcExtendedStats(trades)` — Profit Factor, avg per trade, max consecutive win/loss streaks, best/worst trade.
- `parseBinanceCSV(text)` — heuristic parser for Binance Futures CSV exports. Strips USDT/USD/PERP suffix, infers side from sell/short keywords.

PortfolioPage renders an empty-state CTA ("데모 데이터로 미리보기") when there are no DB trades. Demo mode shows an amber banner and disables add/close/import actions.

Range filter (1W/1M/3M/ALL) is applied to all stats and the trades table.
