---
name: Alert Center
description: Tabbed alert system for price/signal/position alerts with localStorage history and Telegram test
type: feature
---

AlertsPage uses 3 tabs:
- **Price alerts**: persisted in `price_alerts` table (Supabase), triggered by CMC price polling
- **Signal alerts**: stored in localStorage `cryptoedge-signal-alerts`, triggered when a coin's daytrading signal crosses a confidence threshold
- **Position alerts**: stored in localStorage `cryptoedge-position-alerts`, triggers reserved for when open position data is wired up

Notification history kept in localStorage `cryptoedge-alert-history` (last 50). Use `pushHistory()` helper to add. UI listens to `alert-history-updated` window event.

"텔레그램 연결 테스트" button calls `sendTelegram` with the user's chat_id from `useTelegramSettings`.
