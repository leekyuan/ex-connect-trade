---
name: market-analysis-multi-tf
description: Market Analysis page uses HTF-weighted multi-timeframe unified signal grouped into Scalping/Daytrading/Swing
type: feature
---
# 시장 분석 — 멀티-TF HTF 가중 신호

## 그룹 (`src/utils/multiTfSignal.ts` — `STYLE_GROUPS`)
- **scalping ⚡**: 5m(×1) / 15m(×2) / 30m(×3)
- **daytrading 📈**: 1h(×1) / 4h(×2) / 12h(×3)
- **swing 🌊**: 1d(×1) / 3d(×2) / 1w(×3)

## HTF 가중 로직
- 한 코인을 그룹 내 3개 봉에서 동시에 `computeUnifiedSignal` 실행
- `weightedScore = 50 + Σ((score-50) × weight) / Σweight`
- 봉 weight가 높을수록(=HTF) 최종 점수에 더 크게 반영
- `agreement` = 같은 방향 신호인 TF 수
- `primaryTf` = 가장 높은 weight TF, primarySignal의 entry/SL/TP를 패널에 표시

## 차트 (`MarketTradingViewChart`)
- TradingView Advanced Chart **풀 버전** — 사용자가 자유롭게 지표 추가
- `hide_top_toolbar:false`, `hide_side_toolbar:false`, `withdateranges:true`, `details:true`, `allow_symbol_change:true`
- 사전 적용 지표: Volume 1개만 (사용자 선택권 보장)
- 그룹 내 어느 봉을 차트로 볼지 별도 선택 가능

## Glenn Neely (Neo-Wave) 분석
- `src/utils/theories/neely.ts` — `analyzeNeely`
- ZigZag 6 스윙으로 5파 임펄스 감지
- Neely 룰 체크: W3≥W1·W5, W3≈1.618×W1, W2/W4 시간 균형, 교대성
- 통합 신호 pattern 카테고리에 weight 8로 포함 (elliott/wyckoff와 동급)
