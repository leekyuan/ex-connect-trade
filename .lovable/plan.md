# 외부 검토자(Reviewer) 모드 구축 계획

전체 기능을 외부에서 빠르게 평가할 수 있도록 **데모/검토자 전용 레이어**를 새로 만듭니다. 기존 비즈니스 로직은 그대로 두고, 그 위에 "검토용 표면"을 덧씌우는 방식입니다.

---

## 1. Reviewer Hub (`/reviewer`) — 모든 페이지 진입 네비

- 새 페이지 `src/pages/ReviewerHubPage.tsx` 생성
- 카드 그리드로 17개 라우트(대시보드, 시장분석, 스크리너, 백테스트, 포트폴리오, 알림, 저널, 룰, 계산기, 상관관계, 정확도, 설정, 관리자, 위험고지, API 안내, 데모 안내, 랜딩) 전부 노출
- 각 카드에 **목적·기대 결과·테스트 시나리오** 한 줄 설명
- 상단 헤더에 "🔍 Reviewer Mode" 배너 + 데모 토글
- 랜딩(`/`)과 사이드바에서 항상 접근 가능

## 2. 일반/관리자 대시보드 분리

- `useRole()` 훅 추가 — `user_roles` 테이블 기반 (이미 가이드에 있는 패턴)
- DB: `app_role` enum (`admin`, `user`), `user_roles` 테이블, `has_role()` security-definer 함수 마이그레이션
- 신규 페이지 `src/pages/AdminDashboardPage.tsx` (`/admin`)
  - 가입자 수, 신호 수, 오류 로그, 시스템 상태, 사용자 목록(읽기 전용 데모)
- `Dashboard.tsx`는 그대로 일반 사용자 뷰
- 사이드바에 admin일 때만 "관리자" 메뉴 노출

## 3. 더미 데이터 시더

- `src/utils/demoSeed.ts` — 데모 모드 ON 시 localStorage에 가짜 거래/포지션/저널/알림/룰/포트폴리오 채움
- "데모 데이터 채우기 / 초기화" 버튼 (Reviewer Hub & Settings)
- 시드: 30일치 거래 50건, 미체결 알림 5건, 룰 8개, 저널 10건

## 4. 데모 모드 / 테스트넷

- 전역 `DemoModeContext` (`src/contexts/DemoModeContext.tsx`)
  - `localStorage: cryptoedge-demo-mode = "1"` 기본 ON
- 거래소 API 호출(`exchangeApi.ts`, `usePaperTrading`) — 데모 모드에서는 가짜 잔고($10,000) + 가짜 주문 반환
- `PaperTradingPanel`의 "실거래" 탭은 데모 모드에서 잠금 + "DEMO" 워터마크
- 자동매매 트리거는 데모에서 simulated 로그만 남김

## 5. 라벨/툴팁 강화

- 새 컴포넌트 `<FeatureLabel title desc />` — 헤더 카드 상단에 "이 기능은 무엇을 하나요?" 한 줄
- 8개 핵심 페이지(대시보드, 시장분석, 스크리너, 백테스트, 포트폴리오, 알림, 저널, 계산기) 상단에 삽입
- 주요 버튼(매수/매도/자동매매 시작/백테스트 실행)에 `<InfoTip>` 추가

## 6. 자동매매 = 데모 전용 표시

- `AITradingAssistant.tsx` 등 자동매매 UI에 큰 "DEMO ONLY — 실주문 발생 안 함" 뱃지
- 실제 `execute-trade` / `auto-trade` 엣지 함수 호출 전, 데모 모드면 클라이언트에서 차단하고 토스트로 "시뮬레이션 결과만 기록됨"

## 7. 법적 안내 페이지 3종

- `/disclaimer` — 투자 위험 고지 (원금 손실, 레버리지 위험, 미국·한국 규제)
- `/api-permissions` — 거래소 API 키 권한 안내 (Read+Trade만, **Withdraw 절대 금지**, IP 화이트리스트)
- `/risk-limits` — 일일 최대 손실, 포지션 한도, 레버리지 상한 기본값 설명
- 모두 사이드바 "도움말" 그룹 + Reviewer Hub + 랜딩 푸터에 링크

## 8. Publish 후 외부 접근

- `/` (LandingPage)에 "🔍 검토자용 데모 보기" CTA 추가 → `/reviewer`로 이동
- `/reviewer`는 비로그인도 접근 가능, 데모 모드 자동 ON
- 로그인 필요 라우트는 데모 모드일 때 게스트 세션으로 우회 (이미 `AuthContext`가 guest 허용)
- README에 검토자 체크리스트 추가

---

## 기술 변경 요약 (외부 검토자가 아닌 개발자용)

**신규 파일**
- `src/pages/ReviewerHubPage.tsx`, `AdminDashboardPage.tsx`, `DisclaimerPage.tsx`, `ApiPermissionsPage.tsx`, `RiskLimitsPage.tsx`
- `src/contexts/DemoModeContext.tsx`
- `src/hooks/useRole.ts`
- `src/utils/demoSeed.ts`
- `src/components/common/FeatureLabel.tsx`, `DemoBadge.tsx`, `ReviewerBanner.tsx`

**수정**
- `src/App.tsx` — 새 라우트 7개 등록, `DemoModeProvider` 래핑
- `src/components/layout/AppSidebar.tsx` — Reviewer/Admin/Help 그룹 추가
- `src/pages/LandingPage.tsx` — Reviewer CTA
- `src/components/dashboard/PaperTradingPanel.tsx`, `AITradingAssistant.tsx` — 데모 가드
- `src/utils/exchangeApi.ts` — 데모 모드 분기

**DB 마이그레이션**
- `app_role` enum + `user_roles` 테이블 + `has_role()` 함수 + RLS + GRANT

분량이 큰 작업이라 한 턴에 모두 처리합니다. 승인하시면 바로 구현 시작하겠습니다.