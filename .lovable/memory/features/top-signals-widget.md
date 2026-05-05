---
name: top-signals-widget
description: Dashboard TOP 3 live recommendations with 30s refresh and quick entry/backtest deeplink
type: feature
---
# 대시보드 TOP 신호 위젯

## 위치
- `src/components/dashboard/TopSignalsWidget.tsx` — Dashboard 페이지 상단 (StatusBoard 아래)

## 동작
- 모니터링: CMC 상위 8개 코인, daytrading(1h) 캔들
- 5개 가격 이론을 inline으로 직접 호출 (useAdvancedAnalysis 훅 X — rules of hooks 준수)
- 가중치 = getStoredWeights(), minConfirm=2, |score|≥25 이면 방향 결정
- 신뢰도 desc 정렬 → 상위 3개 표시
- 30초 주기 재계산 + 새 70%+ 신호는 sonner 토스트

## 카드
- 신뢰도별 톤: 80%+ success, 65-80% warning, else muted
- "즉시 진입" → onQuickEntry callback 또는 토스트
- "검증" → /backtest?symbol=XXX&mode=daytrading 딥링크
  - BacktestPage가 URL param 읽어 자동 실행
