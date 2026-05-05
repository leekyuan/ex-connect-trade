---
name: dashboard-top30-overhaul
description: TOP 30 heatmap + Top signals + Funding + F&G card + leverage/auto-SL paper trading
type: feature
---
- `/dashboard`는 5×6 시총 TOP 30 히트맵 (Top30Heatmap.tsx) — 시총 비중에 따라 큰 타일/작은 타일, 색상은 24h 등락률, 클릭 시 `/market-analysis?symbol=...`.
- 위젯 3종: `TopSignalsCard` (TOP 5 강한 신호), `FundingRateWidget` (Binance Futures `premiumIndex`), `FearGreedCard` (7일 sparkline + 컨텍스트).
- `PaperTradingPanel`: 1-20x 레버리지 슬라이더 + 자동 SL(-2%) 스위치 추가. 토스트 메시지에 적용 표시.
