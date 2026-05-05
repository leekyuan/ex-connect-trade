---
name: auto-trade-simulator
description: 6-theory auto-trade scanner with virtual positions, ATR SL/TP, trailing, risk guards
type: feature
---
# Auto-Trade Simulator (UI-only, no real orders)

## 핵심
- `src/utils/autoTradeSimulator.ts` — 순수 함수 시뮬레이터: decideEntry, tickPosition, applyClosedTrade, checkRiskGuards
- `src/hooks/useAutoTradeScan.ts` — 1분 주기 스캔 훅, 가격 변동마다 포지션 tick
- `src/components/dashboard/AutoTradePanel.tsx` — Dashboard 자동매매 모드에 마운트

## 진입 규칙
- IntegratedSignal.confidence ≥ minConfidence (기본 70%) AND confirmCount ≥ minConfirm (기본 3)
- 동시 포지션 < maxPositions (기본 3), 동일 심볼 중복 금지
- 사이즈 = equity × riskPct / (SL거리/entry), ATR×1.5 SL

## 포지션 관리
- TP1(1.5R) 도달 → 50% 청산 + SL을 BE로 이동, 트레일링 활성화
- 트레일링 = highest/lowest − ATR×1.5
- TP2(2.5R) 또는 SL 터치 시 전량 청산

## 리스크 가드
- 일일 손실 ≥ dailyMaxLossPct(3%) → 자동 일시중지
- 연속 손절 ≥ consecLossLimit(3) → 일시중지
- DD ≥ drawdownStopPct(15%) → 자동 중지, ≥ 10% 경고

## 데이터 소스
- 모니터링 코인 = top N (기본 8) by CMC volume
- 1h 캔들 (useBinanceOHLCV daytrading) + 5종 가격기반 이론 (fundamental 제외)
- localStorage 가중치 그대로 사용
```
