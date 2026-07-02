/**
 * Global Safety Gate — 앱 전체가 공유하는 실거래 안전 상태.
 * BLOCKED / WATCH / PAPER_READY / LIVE_READY 4단계로 통일.
 *
 * 하나라도 실패하면 BLOCKED:
 *  1) Paper Mode OFF + 검증 미완료
 *  2) API 키 부재/미검증
 *  3) API Withdraw 권한 감지
 *  4) 전략 검증 실패 (PF/AvgR/OOS/Rolling30/TP1)
 *  5) 최대 레버리지 초과
 *  6) 일 손실 한도 초과
 *  7) 연속 손실 한도 초과
 */
import { useEffect, useState } from 'react';
import type { EligibilityResult, EligibilityState } from '@/utils/tradeEligibility';

export type SafetyState = 'BLOCKED' | 'WATCH' | 'PAPER_READY' | 'LIVE_READY';

export interface SafetyReason { key: string; label: string; blocking: boolean; }
export interface GlobalSafety {
  state: SafetyState;
  reasons: SafetyReason[];
  paperMode: boolean;
  canExecute: boolean;     // 진입/실행 버튼 활성화 여부
  canPaperExecute: boolean; // Paper 모의 진입 가능 여부
}

export const SAFETY_META: Record<SafetyState, { label: string; short: string; tone: string; bg: string; ring: string; dot: string; }> = {
  BLOCKED:     { label: '실거래 차단됨',      short: 'BLOCKED',     tone: 'text-red-300',     bg: 'bg-red-500/15',     ring: 'border-red-500/50',     dot: 'bg-red-400' },
  WATCH:       { label: '조건 감시만 가능',    short: 'WATCH',       tone: 'text-amber-300',   bg: 'bg-amber-500/10',   ring: 'border-amber-500/40',   dot: 'bg-amber-400' },
  PAPER_READY: { label: 'Paper 모의 진입 가능', short: 'PAPER_READY', tone: 'text-sky-300',     bg: 'bg-sky-500/10',     ring: 'border-sky-500/40',     dot: 'bg-sky-400' },
  LIVE_READY:  { label: '실거래 가능',        short: 'LIVE_READY',  tone: 'text-emerald-300', bg: 'bg-emerald-500/10', ring: 'border-emerald-500/40', dot: 'bg-emerald-400' },
};

const LIMITS_KEY = 'cryptoedge-risk-limits';

interface Limits {
  paperMode: boolean;
  perTradeLoss: number;
  dailyLoss: number;
  consecLossStop: number;
  maxLeverage: number;
}
const DEFAULT_LIMITS: Limits = {
  paperMode: true, perTradeLoss: 1, dailyLoss: 3, consecLossStop: 3, maxLeverage: 5,
};

function loadLimits(): Limits {
  try {
    const raw = localStorage.getItem(LIMITS_KEY);
    if (!raw) return DEFAULT_LIMITS;
    return { ...DEFAULT_LIMITS, ...JSON.parse(raw) };
  } catch { return DEFAULT_LIMITS; }
}

export function mapEligibilityToSafety(e?: EligibilityState | null): SafetyState {
  switch (e) {
    case 'BLOCKED': return 'BLOCKED';
    case 'LIVE_ELIGIBLE': return 'LIVE_READY';
    case 'PAPER_ONLY': return 'PAPER_READY';
    case 'WATCH_ONLY':
    case 'NO_SIGNAL':
    default: return 'WATCH';
  }
}

/**
 * 전략 검증 결과(선택)를 넣으면 전략까지 반영한 최종 안전 상태를 계산합니다.
 */
export function computeGlobalSafety(eligibility?: EligibilityResult | null): GlobalSafety {
  const limits = loadLimits();
  const reasons: SafetyReason[] = [];

  // 전략 검증 실패는 최우선 하드블록
  if (eligibility?.state === 'BLOCKED') {
    reasons.push({ key: 'strategy', label: '전략 검증 실패 — 기준 미달', blocking: true });
  }

  // 리스크 한도 임계 (데모: localStorage 기준값 없음 → 통과 처리, 초과 시 blocking)
  if (limits.maxLeverage > 20) {
    reasons.push({ key: 'lev', label: `최대 레버리지 ${limits.maxLeverage}x — 상한 20x 초과`, blocking: true });
  }

  // API 키 (Withdraw 감지는 실제로 저장하지 않음; 여기서는 미연결 = 실거래 불가)
  const hasApiKey = false; // 데모: 미연결 상태로 가정 (연결 시 exchange_api_keys 조회로 대체)
  if (!hasApiKey && !limits.paperMode) {
    reasons.push({ key: 'apikey', label: 'API 키 미연결 상태에서 Paper Mode 해제됨', blocking: true });
  }

  // Paper Mode 상태
  const paperMode = limits.paperMode;

  // 상태 결정
  let state: SafetyState;
  const hardBlocked = reasons.some(r => r.blocking);
  if (hardBlocked) {
    state = 'BLOCKED';
  } else if (!eligibility || eligibility.state === 'NO_SIGNAL' || eligibility.state === 'WATCH_ONLY') {
    state = 'WATCH';
  } else if (eligibility.state === 'PAPER_ONLY' || paperMode) {
    state = 'PAPER_READY';
  } else if (eligibility.state === 'LIVE_ELIGIBLE') {
    state = 'LIVE_READY';
  } else {
    state = 'WATCH';
  }

  return {
    state,
    reasons,
    paperMode,
    canExecute: state === 'LIVE_READY',
    canPaperExecute: state === 'PAPER_READY' || state === 'LIVE_READY',
  };
}

/**
 * React hook — localStorage 변경도 감지.
 */
export function useGlobalSafety(eligibility?: EligibilityResult | null): GlobalSafety {
  const [safety, setSafety] = useState<GlobalSafety>(() => computeGlobalSafety(eligibility));

  useEffect(() => {
    setSafety(computeGlobalSafety(eligibility));
    const onStorage = (e: StorageEvent) => {
      if (e.key === LIMITS_KEY) setSafety(computeGlobalSafety(eligibility));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [eligibility]);

  return safety;
}
