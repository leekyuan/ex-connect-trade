/**
 * Backtest → Strategy Verdict.
 * PFBacktestResult 를 7대 검증 기준으로 판정.
 */
import type { PFBacktestResult, PFTrade } from '@/utils/profitFirstBacktest';
import type { GateMetrics } from '@/utils/verificationGates';
import { GATES } from '@/utils/verificationGates';
import { computeEligibility, type EligibilityResult } from '@/utils/tradeEligibility';

export type VerdictState = 'PASS' | 'FAIL' | 'NEEDS_MORE_DATA' | 'PAPER_REQUIRED' | 'BLOCKED';

export interface StrategyVerdict {
  state: VerdictState;
  headline: string;
  reasons: string[];
  metrics: GateMetrics;
  eligibility: EligibilityResult;
}

function pf(trades: PFTrade[]) {
  let g = 0, l = 0;
  for (const t of trades) { if (t.pnlUsdt > 0) g += t.pnlUsdt; else l += -t.pnlUsdt; }
  if (l === 0) return g > 0 ? 99 : 0;
  return g / l;
}
function avgR(trades: PFTrade[]) {
  const losses = trades.filter(t => t.pnlUsdt < 0).map(t => -t.pnlUsdt);
  if (!losses.length || !trades.length) return 0;
  const R = losses.reduce((a, b) => a + b, 0) / losses.length;
  if (R <= 0) return 0;
  const avg = trades.reduce((a, t) => a + t.pnlUsdt, 0) / trades.length;
  return avg / R;
}

export function buildVerdict(r: PFBacktestResult, feesIncluded = true, slipIncluded = true): StrategyVerdict {
  const trades = r.trades;
  const split = Math.floor(trades.length * 0.7);
  const oos = trades.slice(split);
  const rolling30 = trades.slice(-30);
  const tp1Hits = trades.filter(t => t.exitReason === 'TP1_PARTIAL' || t.exitReason === 'TRAIL').length;
  const tp1HitRate = trades.length ? tp1Hits / trades.length : 0;

  const losses = trades.filter(t => t.pnlUsdt < 0).map(t => -t.pnlUsdt);
  const R = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 1;
  const totalAbs = trades.reduce((a, t) => a + Math.abs(t.pnlUsdt), 0) || 1;
  const ddUsdt = (r.metrics.maxDrawdownPct / 100) * totalAbs;
  const maxDD_R = R > 0 ? ddUsdt / R : 0;

  const metrics: GateMetrics = {
    trades: trades.length,
    pf: r.metrics.profitFactor,
    winRate: r.metrics.winRatePct / 100,
    tp1HitRate,
    avgR: avgR(trades),
    maxDD_R,
    longPF: pf(trades.filter(t => t.side === 'LONG')),
    shortPF: pf(trades.filter(t => t.side === 'SHORT')),
    oosPF: pf(oos),
    rolling30PF: pf(rolling30),
    topRemovedPF: pf([...trades].sort((a, b) => b.pnlUsdt - a.pnlUsdt).slice(3)),
    feesIncluded, slippageIncluded: slipIncluded,
  };

  const eligibility = computeEligibility(metrics, true);
  const reasons: string[] = [];
  let state: VerdictState;

  if (metrics.trades < GATES.minTrades) {
    reasons.push(`Trades ${metrics.trades} < 최소 ${GATES.minTrades}`);
  }
  if (metrics.pf < GATES.minPF)               reasons.push(`Profit Factor ${metrics.pf.toFixed(2)} < ${GATES.minPF}`);
  if (metrics.avgR < GATES.minAvgR)           reasons.push(`Avg R ${metrics.avgR.toFixed(2)} < +${GATES.minAvgR}`);
  if (metrics.oosPF < GATES.minOosPF)         reasons.push(`OOS PF ${metrics.oosPF.toFixed(2)} < ${GATES.minOosPF}`);
  if (metrics.rolling30PF < GATES.minRolling30PF) reasons.push(`Rolling30 PF ${metrics.rolling30PF.toFixed(2)} < ${GATES.minRolling30PF}`);
  if (metrics.maxDD_R > GATES.maxDD_R)        reasons.push(`Max DD ${metrics.maxDD_R.toFixed(0)}R > ${GATES.maxDD_R}R`);
  if (!feesIncluded || !slipIncluded)         reasons.push('수수료/슬리피지 미반영 — Paper Mode 검증 필요');

  const hardBlock = eligibility.state === 'BLOCKED';
  if (hardBlock) {
    state = 'BLOCKED';
  } else if (metrics.trades < GATES.minTrades && reasons.length <= 1) {
    state = 'NEEDS_MORE_DATA';
  } else if (reasons.length === 0) {
    state = 'PASS';
  } else if (!feesIncluded || !slipIncluded) {
    state = 'PAPER_REQUIRED';
  } else {
    state = 'FAIL';
  }

  const headline =
    state === 'PASS' ? '전략 판정: PASS — 모든 실거래 기준 통과'
    : state === 'BLOCKED' ? '전략 판정: BLOCKED — 손실 전략. 실거래/페이퍼 금지'
    : state === 'NEEDS_MORE_DATA' ? '전략 판정: NEEDS_MORE_DATA — 거래 표본 부족'
    : state === 'PAPER_REQUIRED' ? '전략 판정: PAPER_REQUIRED — Paper Mode 검증 필요'
    : '전략 판정: FAIL — 실거래 기준 미달';

  return { state, headline, reasons, metrics, eligibility };
}

export const VERDICT_META: Record<VerdictState, { tone: string; bg: string; ring: string; short: string }> = {
  PASS:             { tone: 'text-emerald-300',   bg: 'bg-emerald-500/10',  ring: 'border-emerald-500/40', short: 'PASS' },
  FAIL:             { tone: 'text-red-300',       bg: 'bg-red-500/10',      ring: 'border-red-500/40',     short: 'FAIL' },
  NEEDS_MORE_DATA:  { tone: 'text-sky-300',       bg: 'bg-sky-500/10',      ring: 'border-sky-500/40',     short: 'NEEDS DATA' },
  PAPER_REQUIRED:   { tone: 'text-amber-300',     bg: 'bg-amber-500/10',    ring: 'border-amber-500/40',   short: 'PAPER REQ' },
  BLOCKED:          { tone: 'text-red-300',       bg: 'bg-red-500/15',      ring: 'border-red-500/50',     short: 'BLOCKED' },
};
