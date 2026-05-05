---
name: neo-wave-realtime
description: Realtime Glenn Neely Neo-Wave detection with chart overlay (swing labels/channel/wave line) and 3 forward scenarios
type: feature
---
# Neo-Wave 실시간 분석 + 차트 시각화

## 모듈
- `src/utils/theories/neely.ts` — `analyzeNeely()` 확장. 출력은 `NeoWaveResult`:
  - `structure.labeledSwings` (0~5 또는 진행 단계에 따른 부분 라벨)
  - `structure.channel` (1·3 / 2·4 평행 채널)
  - `structure.stage` / `progress` (0..1) / `rules` (룰 검증 4종)
  - `scenarios[3]`: `base` / `extension` / `failure` — 각각 probability·target·invalidation·color

## 실시간 훅
- `src/hooks/useRealtimeNeoWave.ts`
- 초기 REST 300봉 → Binance WebSocket `@kline_<interval>` 구독
- 마지막 캔들 라이브 갱신, 1초 throttle로 `analyzeNeely` 재계산
- 반환: `{ candles, result, loading, error, lastUpdate, live }`

## 차트 컴포넌트
- `src/components/MarketAnalysis/NeoWaveChart.tsx` (lightweight-charts 4.2)
- 표시: 캔들스틱 + 스윙 마커(0~5) + 평행 채널(보라) + 5파 진행선(에메랄드 점선)
- 시나리오 3종: 현재가→target 점선(시나리오 색상) + invalidation 수평선
- `highlightedScenario` prop으로 선택된 시나리오만 강조

## 시나리오 패널
- `src/components/MarketAnalysis/NeoWaveScenarioPanel.tsx`
- 진행 단계·진행률 바·Neely 룰 4종 체크 표시
- 시나리오 카드 클릭으로 차트 강조 토글

## 페이지 통합
- `MarketAnalysisPage`에 차트 뷰 토글 추가: **Neo-Wave 분석 차트** ↔ **TradingView (지표 자유 추가)**
- Neo-Wave 모드에서는 라이브 배지 + 마지막 갱신 시각 표시
