## 목표
"첫 10초 안에 롱/숏/관망을 판단할 수 있는" 전문 트레이딩 터미널로 재편. 잡다한 기능은 하위로 숨기고, BTC/ETH 선물 신호 + 전략 검증 + API 보안 3축에 집중.

## 새 정보 구조 (IA)

```
/                    Today Signal Dashboard  (홈 = 신호 카드 중심)
/verification        Strategy Verification Dashboard
/security            Risk & API Safety
/portfolio           (기존, 사이드바)
/journal             (기존, 사이드바)
/screener            (Advanced 하위로 이동)
/analysis            (Advanced 하위)
/backtest            (Advanced 하위, /verification 으로 진입 유도)
/legal/terms         이용약관
/legal/privacy       개인정보처리방침
/legal/risk          투자 유의사항
/legal/api-policy    API 보안 정책
/legal/refund        환불 정책
```

## 1. 홈 — Today Signal Dashboard (`src/pages/Index.tsx` 교체)

상단 디스클레이머 바: "수익을 보장하지 않습니다 · 매매 의사결정 보조 도구"

핵심: `<TodaySignalCard symbol="BTCUSDT" />`, `<TodaySignalCard symbol="ETHUSDT" />` 2장이 첫 화면을 점유. 모바일에서는 세로 스택.

각 카드:
- 상태 배지: `LONG READY` / `SHORT READY` / `WAIT` / `NO TRADE` (초록/빨강/노랑/회색)
- EP1, EP2 / TP1, TP2, TP3 / SL 가격 표
- R:R, TP1 확률, 최근 100회 PF, 최근 30회 PF
- 진입 금지 사유 (있을 때): "Rolling30 PF 0.94 — 기준 미달"
- CTA: "전략 검증 보기" → `/verification?symbol=BTCUSDT`

데이터: 기존 `useMarketAnalysis` + `unifiedSignal` + `unifiedBacktest` 재사용. 기준 미달이면 자동 `WAIT/NO TRADE`.

## 2. Strategy Verification Dashboard (`src/pages/VerificationPage.tsx` 신규)

기존 `SignalBacktestCard` + `unifiedBacktest` 확장. 표시 지표:
PF · Win Rate · Trades · MaxDD · Avg R · TP1 Hit · Long PF / Short PF · OOS PF · Rolling30 PF · 수수료/슬리피지 적용 여부 · Top1~3 winner 제거 후 PF.

기준 통과 시 `검증 통과` 배지, 미달 시 `실거래 비추천 · 모의검증 필요` 배지. 기준은 사용자 문서 그대로 코드 상수화.

## 3. Risk & API Safety (`src/pages/SecurityPage.tsx` 신규 + ConnectApiModal 강화)

- API Key 입력 모달 진입 시 보안 안내 단계(체크박스 3개 필수):
  - "출금 권한 비활성화 확인"
  - "거래 권한만 허용"
  - "IP Whitelist 설정 권장"
- Secret 저장 후 마스킹, 재표시 불가
- Paper Mode 기본 ON 토글, 실거래 전환 시 2단계 확인
- 리스크 한도 UI: 1회 손실 한도, 일일 손실 한도, 연속 손실 정지 N회, 최대 레버리지 슬라이더 (기존 `trading_rules` 테이블 사용)

## 4. 컴포넌트 신규/수정

신규:
- `src/components/today/TodaySignalCard.tsx`
- `src/components/today/DisclaimerBar.tsx`
- `src/components/verification/VerificationCard.tsx` (기준 통과/미달 배지 포함)
- `src/components/security/ApiSafetyModal.tsx` (3단계 체크 + 키 입력)
- `src/components/security/RiskLimitsForm.tsx`
- `src/pages/VerificationPage.tsx`, `src/pages/SecurityPage.tsx`
- `src/pages/legal/{Terms,Privacy,RiskDisclosure,ApiPolicy,Refund}.tsx`

수정:
- `src/pages/Index.tsx` → Today Signal Dashboard
- `src/components/layout/AppSidebar.tsx` → 신규 IA, Advanced 그룹으로 screener/analysis/backtest 이동
- `src/components/layout/MobileTabBar.tsx` → Today / Verify / Security / More
- `src/App.tsx` → 신규 라우트
- `src/components/dashboard/ConnectApiModal.tsx` → `ApiSafetyModal` 사용

## 5. 카피 정비
전 코드베이스에서 다음 표현 검색 후 치환:
- "자동 수익", "고승률 보장", "돈 버는 AI" → 제거
- 표준 문구: "AI 기반 매매 의사결정 보조", "백테스트 기반 신호 검증", "실거래 전 모의검증 필수", "수익을 보장하지 않습니다"
- 메인 CTA: "전략 검증 보기" 우선, 보조 CTA "오늘 신호 보기"

## 6. 디자인 토큰
- 다크 배경 유지, 신호색은 `--signal-long`(green) / `--signal-short`(red) / `--signal-wait`(amber) / `--signal-none`(muted) 4종만 사용
- 큰 마케팅 문구 제거, 숫자 우선 (tabular-nums)

## 작업 순서
1. 디자인 토큰(신호색) 추가 → `index.css`, `tailwind.config.ts`
2. `TodaySignalCard` + `DisclaimerBar` + 새 `Index.tsx`
3. `VerificationPage` + `VerificationCard` + 기준 상수
4. `ApiSafetyModal` + `RiskLimitsForm` + `SecurityPage`
5. Legal 5개 페이지 (정적)
6. 사이드바/모바일탭/라우트 정비
7. 카피 sweep

## 범위 밖 (이번 작업 안 함)
- 신규 백테스트 엔진 (기존 `unifiedBacktest` 재사용, 지표만 노출)
- 결제 연동
- 알림/텔레그램 변경

작업 후 변경 파일 목록과 핵심 변경점을 요약합니다.