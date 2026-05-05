# Project Memory

## Core
Professional dark theme trading terminal UI.
Stack: Supabase (Auth, DB, Edge Functions), `ccxt` for Binance/Bybit/OKX.
User API keys MUST be encrypted and protected by Supabase RLS.
Real-time feeds via Binance WebSocket, charts via TradingView widget.

## Memories
- [Trading Infrastructure](mem://arch/trading-infrastructure) — Core tech stack including Supabase, ccxt, and supported exchanges
- [Auto-Trading Logic](mem://features/auto-trading-logic) — Manual & AI trading modes, RSI strategies, TP/SL logic
- [Market Data Integration](mem://features/market-data-integration) — Real-time data via Binance WS, TradingView widget, Supabase realtime
- [Futures Trading Config](mem://features/futures-trading-config) — BTC futures settings, leverage, and PNL tracking
- [Dashboard Layout](mem://ui/dashboard-layout) — Dark theme terminal UI, sidebar navigation structure
- [Market Analysis Signals](mem://features/market-analysis-signals) — CMC API integration, multi-mode signals, confidence scoring
- [Advanced Analysis Engine](mem://features/advanced-analysis-engine) — 6 major trading theories, consensus score, timeframe rules
- [Signal Notifications](mem://features/signal-notifications) — Desktop alerts via Browser Notification API
- [Market Analysis Multi-TF](mem://features/market-analysis-multi-tf) — Scalp/Day/Swing groups with HTF-weighted signals
- [Neo-Wave Realtime](mem://features/neo-wave-realtime) — Glenn Neely chart overlay + 3 scenarios
- [Market Screener Page](mem://features/market-screener) — `/market-screener` TOP30 sortable table, strategy auto-tag, side drawer
- [Dashboard TOP30 Overhaul](mem://features/dashboard-top30-overhaul) — Heatmap + Top signals + Funding + F&G card + leverage paper trading
- [Global UX Shortcuts](mem://features/global-ux-shortcuts) — Cmd+K palette, hotkeys, unread badge, sidebar persistence
