# 실거래 안전 잠금 & Secret 저장 하드닝 계획

목표: 앱을 "데모/검증 모드"로 완전히 잠그고, 실거래 경로는 서버 안전장치 뒤에서만 열리도록 재정비합니다. 프론트 신뢰를 제거하고 Edge Function이 최종 판정자가 됩니다.

---

## 1. 서버측 실거래 마스터 스위치

**공용 가드 모듈 강화** — `supabase/functions/_shared/riskGuard.ts`
- `assertLiveTradingEnabled()`: `Deno.env.get('LIVE_TRADING_ENABLED') === 'true'`가 아니면 즉시 403 반환 (기본값 false).
- `assertOrderAllowed({ user, symbol, leverage, notional, sl, method })`:
  - allowed symbol 화이트리스트 (BTCUSDT/ETHUSDT 등)
  - `leverage <= MAX_LEVERAGE` (기본 5)
  - `notional <= MAX_POSITION_USDT`
  - `sl` 필수
  - MARKET 주문은 `LIVE_TRADING_ENABLED=true`인 상태에서만 허용
  - idempotencyKey 중복 차단 (`trade_logs.idempotency_key` unique)
  - `trade_logs`에 요청/결과 기록

**적용 대상 Edge Functions**
- `execute-trade/index.ts` — 모든 주문 전 `assertLiveTradingEnabled` + `assertOrderAllowed`. TP/SL 등록 실패 시 entry 취소 후 실패 반환.
- `binance-proxy/index.ts` — `POST`/`DELETE`/`PUT` 및 `/leverage`, `/order` 경로는 `assertLiveTradingEnabled` 통과 시에만. `GET` 조회는 유지.
- `auto-trade/index.ts` — 이름 유지하되 실주문 호출 제거. 시그널만 리턴하고 상단에 "PAPER SIGNAL ONLY" 헤더. Strategy eligibility (PF/OOS/AvgR/Rolling30/MaxDD) 미통과 시 `state: BLOCKED` 반환.

---

## 2. exchange_api_keys 구조 개선

**마이그레이션**
- 새 컬럼 `api_secret_encrypted bytea`, `passphrase_encrypted bytea` 추가.
- RLS 정책 재작성: `SELECT`는 `id, exchange, api_key(마지막 4자), created_at, updated_at`만 노출하는 뷰 `exchange_api_keys_public`로 분리. 원본 테이블은 `SELECT`를 authenticated에서 회수하고, Edge Function(service_role)만 접근.
- GRANT 재정비: `authenticated`에는 `INSERT, UPDATE, DELETE`만. 조회는 뷰로.
- 서버측 대칭 암호화: `EXCHANGE_KEY_ENCRYPTION_SECRET`(32자) 사용 → `crypto.subtle` AES-GCM. Edge Function `save-exchange-key`, `delete-exchange-key`를 신설하여 저장/삭제를 서버에서 수행. 프론트는 이 함수를 통해서만 저장.

**프론트**
- `ApiKeyForm.tsx`의 `supabase.from("exchange_api_keys").upsert(...)` 제거. 대신 `supabase.functions.invoke("save-exchange-key", { body: { exchange, apiKey, apiSecret, passphrase } })` 호출.
- 저장 후 Secret은 상태에서 즉시 폐기, 재조회 불가.
- 모든 저장 진입점을 `ApiSafetyModal` / `ExchangeSettings` 두 곳으로 통일하고 `BinanceApiSettings`도 동일 함수 사용.

---

## 3. 프론트 Safety Gate 통합

- `useGlobalSafety`에 서버 상태 훅 `useServerSafety()` 추가: `functions.invoke("safety-status")` — LIVE_TRADING_ENABLED, hasApiKey, strategyEligible, limits를 서버에서 조회.
- `TradingPanel.tsx`, `OrderPanel.tsx`, `PaperTradingPanel.tsx`:
  - `safety.state !== 'LIVE_READY'` 또는 `demo` 또는 `paperMode`이면 실거래 버튼 `disabled`.
  - Paper/Demo에서는 `execute-trade` / `binance-proxy(POST)` 호출 자체를 클라이언트에서도 차단(2차 방어).
  - 실행 시 `idempotencyKey`(uuid) 필수 첨부.

---

## 4. auto-trade 분리

- `auto-trade/index.ts`는 신호 생성 + strategy verdict 반환만 수행.
- 실주문 호출 코드 제거, 응답에 `paperOnly: true` 명시.
- 검증 미통과 시 `{ state: 'BLOCKED', reasons: [...] }`.

---

## 5. Reviewer/Demo 모드

- `DemoModeContext`가 ON이면 모든 실거래 관련 함수 호출 앞단에서 조기 반환하고 sample fixture 사용.
- `.env.local`은 이미 gitignore. `.gitignore` 확인만.

---

## 6. 필요한 시크릿

- `LIVE_TRADING_ENABLED` = `false` (기본)
- `EXCHANGE_KEY_ENCRYPTION_SECRET` = 32+자 랜덤 (generate_secret)
- `ALLOWED_SYMBOLS` = `BTCUSDT,ETHUSDT`
- `MAX_LEVERAGE` = `5`, `MAX_POSITION_USDT` = `500`, `MAX_DAILY_LOSS_USDT` = `50`, `MAX_PER_TRADE_LOSS_USDT` = `20`

---

## 산출물 요약 (완료 시)

- 변경 파일 리스트
- 서버 가드 흐름 도식 (텍스트)
- 남은 수동 조치 (LIVE_TRADING_ENABLED 켜는 절차, 화이트리스트 튜닝)

---

## 확인 필요

이 계획대로 진행할까요? 특히 **(a) `exchange_api_keys` 테이블 마이그레이션(뷰 분리 + SELECT 권한 회수)** 과 **(b) 신규 Edge Function `save-exchange-key`/`safety-status`/`delete-exchange-key` 생성**은 되돌리기 번거로우니 승인 후 진행하겠습니다.
