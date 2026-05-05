---
name: backtest-theory-comparison
description: Per-theory backtest comparison with confidence buckets and integrated weighted run
type: feature
---
# 이론별 백테스트 비교

## 모듈
- `src/utils/backtestTheory.ts` — runTheoryComparison(candles, opts)
- `src/components/Backtest/TheoryComparisonPanel.tsx` — 결과 UI

## 동작
- 같은 캔들 데이터에서 5개 가격 이론 + 통합신호를 각각 백테스트
- 룩어헤드 차단: 신호는 candles[0..i], 진입 candles[i+1].open + 슬리피지
- 한 캔들에 1거래만 (TP/SL 후 다음 인덱스부터 재탐색)
- TP = SL거리 × R (기본 R=2)

## 출력
- 이론별: 신호수/거래수/승률/PF/평균R/MDD/누적수익
- 통합신호: 가중치 기반 (`getStoredWeights()`), minConfirm=2
- 신뢰도 버킷: 50-60 / 60-70 / 70-80 / 80%+

## 통합 위치
- BacktestPage 결과 섹션, 월별 차트 아래
- runBacktest 결과에 `candles` 포함하여 재사용 (네트워크 절약)
