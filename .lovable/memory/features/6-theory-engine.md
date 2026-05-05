---
name: 6-theory-engine
description: Integrated 6-theory signal engine (Elliott/Dow/Wyckoff/Gann/Fibonacci/Fundamental) with weighted scoring
type: feature
---
# 6대 이론 통합 신호 엔진

## 모듈 (`src/utils/theories/`)
- elliott, dow, wyckoff, fibonacci (기존)
- **gann.ts**: 1x1 갠앵글 + 갠 스퀘어 25/50/75% 레벨
- **fundamental.ts**: Funding Rate, OI 24h 변화, L/S Ratio, F&G Index. Binance Futures public API + alternative.me/fng. 5분 캐시.

## 통합 점수 (`useAdvancedAnalysis.ts`)
- 각 이론은 -100~+100 score (signal × confidence)
- 가중치 평균 → finalScore
- 방향: ±25 임계값
- 컨펌: signal 일치 + confidence ≥ 50인 이론 ≥ minConfirm(기본 2)
- Entry/SL/TP1/TP2/RR은 컨펌 이론들의 평균 SL과 risk×2.5로 산출

## 가중치 영구화 (`useTheoryWeights.ts`)
- localStorage key: `cryptoedge-theory-weights-v1`
- 각 이론 0~3 범위, 기본 1.0
- 설정 페이지의 `TheoryWeightsSettings` + 분석 패널 인라인 슬라이더 양쪽에서 편집

## UI
- `AdvancedAnalysisPanel`: 통합 추천 카드 (스펙트럼 바, 컨펌 카운트, Entry/SL/TP1/TP2, R:R)
- `CoinTheoryModal`: 코인 카드의 "6대 이론" 버튼 → 모달로 단일 코인 정밀 분석
- `PushNotificationSettings`: Notification API 권한 + 테스트 발송
