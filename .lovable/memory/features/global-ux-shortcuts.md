---
name: global-ux-shortcuts
description: Cmd+K command palette, hotkeys, alerts unread badge, sidebar persistence, info tooltips
type: feature
---
- DashboardLayout가 전역 마운트하는 도구: `CommandPalette` (Cmd/Ctrl+K — 페이지 + TOP 30 코인 즉시 이동), `KeyboardShortcutsModal` (`?` 키로 열림).
- 단축키: D 대시보드 / M 마켓 스크리너 / A 시장 분석 / B 백테스트 / P 포트폴리오 / N 알림 / Esc 모달 닫기. 입력 필드 포커스 시 비활성.
- 사이드바 collapse 상태 → `localStorage["cryptoedge-sidebar-open"]` 저장.
- `useUnreadAlerts`: `price_alerts.triggered_at > localStorage[lastvisit]` 카운트. AlertsPage 진입 시 `markAlertsRead()`. AppSidebar의 알림 항목에 빨간 배지.
- `InfoTip` 컴포넌트: 기술 용어 옆 ℹ 아이콘 한국어 툴팁.
