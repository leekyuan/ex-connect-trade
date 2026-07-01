/**
 * Trade Eligibility Gate — 유료 SaaS 안전 검증 통합 유틸.
 * 모든 신호/전략 검증 카드가 공통으로 사용.
 *
 * 상태:
 *  - BLOCKED       : 전략 검증 실패. 실거래/페이퍼 진입 금지
 *  - WATCH_ONLY    : 일부 조건 충족. 관찰만 가능
 *  - PAPER_ONLY    : 백테스트 최소 기준 통과. 실거래 전 Paper 검증 필요
 *  - LIVE_ELIGIBLE : 모든 검증 기준 통과. 실거래 가능
 *  - NO_SIGNAL     : 현재 신호 없음
 */
import type { GateMetrics } from './verificationGates';
import { GATES } from './verificationGates';

export type EligibilityState =
  | 'BLOCKED'
  | 'WATCH_ONLY'
  | 'PAPER_ONLY'
  | 'LIVE_ELIGIBLE'
  | 'NO_SIGNAL';

export interface EligibilityResult {
  state: EligibilityState;
  reasons: string[];       // 사용자에게 보여줄 사유
  hardBlock: boolean;      // 반드시 차단
  passCount: number;
  totalGates: number;
}

export const ELIGIBILITY_META: Record<EligibilityState, {
  label: string;
  short: string;
  tone: string;   // text
  bg: string;
  ring: string;
}> = {
  BLOCKED:       { label: '실거래 차단됨',      short: 'BLOCKED',       tone: 'text-red-300',       bg: 'bg-red-500/15',      ring: 'ring-red-500/40' },
  WATCH_ONLY:    { label: '관찰만 가능',        short: 'WATCH_ONLY',    tone: 'text-amber-300',     bg: 'bg-amber-500/15',    ring: 'ring-amber-500/30' },
  PAPER_ONLY:    { label: 'Paper 검증 필요',     short: 'PAPER_ONLY',    tone: 'text-sky-300',       bg: 'bg-sky-500/15',      ring: 'ring-sky-500/40' },
  LIVE_ELIGIBLE: { label: '실거래 가능',        short: 'LIVE_ELIGIBLE', tone: 'text-emerald-300',   bg: 'bg-emerald-500/15',  ring: 'ring-emerald-500/40' },
  NO_SIGNAL:    { label: '신호 없음',           short: 'NO_SIGNAL',     tone: 'text-muted-foreground', bg: 'bg-muted/40',     ring: 'ring-border' },
};

/**
 * Hard block 조건 — 하나라도 해당되면 즉시 BLOCKED.
 */
function hardBlockReasons(m: GateMetrics): string[] {
  const r: string[] = [];
  if (m.pf < 1.0)        r.push(`Profit Factor ${m.pf.toFixed(2)} < 1.0 (기대값 음수)`);
  if (m.avgR < 0)        r.push(`Avg R ${m.avgR.toFixed(2)} < 0 (평균 손실 전략)`);
  if (m.oosPF < 1.0)     r.push(`OOS PF ${m.oosPF.toFixed(2)} < 1.0 (검증구간 손실)`);
  return r;
}

/**
 * 통과하지 못한 개별 게이트 사유.
 */
function gateFailReasons(m: GateMetrics): string[] {
  const r: string[] = [];
  if (m.trades      < GATES.minTrades)       r.push(`거래수 ${m.trades} < 최소 ${GATES.minTrades}`);
  if (m.pf          < GATES.minPF)           r.push(`Profit Factor ${m.pf.toFixed(2)} < 최소 기준 ${GATES.minPF}`);
  if (m.tp1HitRate  < GATES.minTp1Rate)      r.push(`TP1 Hit Rate ${(m.tp1HitRate*100).toFixed(1)}% < 최소 ${(GATES.minTp1Rate*100)}%`);
  if (m.avgR        < GATES.minAvgR)         r.push(`Avg R ${m.avgR.toFixed(2)} < 최소 기준 +${GATES.minAvgR}`);
  if (m.maxDD_R     > GATES.maxDD_R)         r.push(`Max DD ${m.maxDD_R.toFixed(0)}R > 허용 기준 ${GATES.maxDD_R}R`);
  if (m.oosPF       < GATES.minOosPF)        r.push(`OOS PF ${m.oosPF.toFixed(2)} < 최소 기준 ${GATES.minOosPF}`);
  if (m.rolling30PF < GATES.minRolling30PF)  r.push(`Rolling30 PF ${m.rolling30PF.toFixed(2)} < 최소 기준 ${GATES.minRolling30PF}`);
  return r;
}

/**
 * 전략 검증 게이트 결과 → 거래 자격 상태로 매핑.
 * @param hasSignal — 지금 방향성 신호가 있는지 (없으면 NO_SIGNAL 후보)
 */
export function computeEligibility(m: GateMetrics | null, hasSignal: boolean): EligibilityResult {
  if (!m) {
    return {
      state: hasSignal ? 'WATCH_ONLY' : 'NO_SIGNAL',
      reasons: ['전략 검증 데이터 없음 — Paper Mode 검증 필요'],
      hardBlock: false,
      passCount: 0, totalGates: 7,
    };
  }
  const hard = hardBlockReasons(m);
  const fails = gateFailReasons(m);
  const passCount = 7 - fails.length;

  if (hard.length > 0) {
    return { state: 'BLOCKED', reasons: [...hard, ...fails.filter(f => !hard.some(h => f.includes(h.split(' ')[0])))], hardBlock: true, passCount, totalGates: 7 };
  }
  if (fails.length === 0) {
    return hasSignal
      ? { state: 'LIVE_ELIGIBLE', reasons: ['모든 검증 기준 통과'], hardBlock: false, passCount, totalGates: 7 }
      : { state: 'PAPER_ONLY',    reasons: ['검증 통과 · 현재 방향성 신호 대기'], hardBlock: false, passCount, totalGates: 7 };
  }
  // 일부 미달이지만 hard block 은 아님 → PAPER_ONLY / WATCH_ONLY
  // 거래수 부족만이 유일한 실패 → PAPER_ONLY
  const onlyDataShort = fails.length === 1 && m.trades < GATES.minTrades;
  if (onlyDataShort) {
    return { state: 'PAPER_ONLY', reasons: fails, hardBlock: false, passCount, totalGates: 7 };
  }
  // 그 외 다수 미달 → 관찰만
  return { state: 'WATCH_ONLY', reasons: fails, hardBlock: false, passCount, totalGates: 7 };
}

/** Live 실거래 허용 여부 (Bot Safety용) */
export function isLiveAllowed(e: EligibilityResult): boolean {
  return e.state === 'LIVE_ELIGIBLE';
}
