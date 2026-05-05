---
name: market-screener-page
description: TOP 30 sortable screener with RSI/MACD/volume composite score, strategy auto-tag, side drawer
type: feature
---
- 경로: `/market-screener`. 사이드바 + 모바일탭에서 진입.
- 데이터: `useCoinMarketCap` (CMC TOP 30, 스테이블 자동 제외) + `useBinanceTicker` (24h 라이브) + `useScreenerScores` (코인별 5m/1h/4h RSI+MACD+볼륨 합성).
- 전략 자동 태그: 3개 TF 중 |score-50| 가장 큰 TF → SCALP / DAY / SWING.
- 필터: 전략, 24h 변동률 ±3/5/10%, 볼륨 스파이크 200/300%.
- 정렬: 모든 수치 컬럼.
- 30s 자동 새로고침 + 카운트다운.
- 행 클릭 → `ScreenerCoinDrawer` 열림: 1h TradingView 미니차트 + `computeUnifiedSignal` 6대 이론 통합 (entry/TP/SL/SR).
