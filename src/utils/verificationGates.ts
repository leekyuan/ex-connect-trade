/**
 * Strategy verification gates — 유료 SaaS 신뢰도 기준.
 * 거래수/PF/TP1/AvgR/MaxDD/OOS PF/Rolling30 PF 모두 통과 시 "실거래 권장".
 */
import type { UnifiedBacktestResult, UnifiedTrade } from './unifiedBacktest';

export const GATES = {
  minTrades: 100,
  minPF: 1.30,
  minTp1Rate: 0.50,
  minAvgR: 0.07,     // +0.07R
  maxDD_R: 10,       // 10R 이하
  minOosPF: 1.20,
  minRolling30PF: 1.10,
} as const;

export interface GateMetrics {
  trades: number;
  pf: number;
  winRate: number;
  tp1HitRate: number;
  avgR: number;
  maxDD_R: number;
  longPF: number;
  shortPF: number;
  oosPF: number;
  rolling30PF: number;
  topRemovedPF: number;     // top 3 winner 제거 후 PF
  feesIncluded: boolean;
  slippageIncluded: boolean;
}

export interface GateCheck {
  key: keyof typeof GATES;
  label: string;
  required: number;
  actual: number;
  pass: boolean;
}

function pf(trades: UnifiedTrade[]): number {
  let g = 0, l = 0;
  for (const t of trades) { if (t.pnlUsdt > 0) g += t.pnlUsdt; else l += -t.pnlUsdt; }
  if (l === 0) return g > 0 ? 99 : 0;
  return g / l;
}

/** R = 단일 손실 평균 (절대값). avgR = 평균PnL / R */
function avgR(trades: UnifiedTrade[]): number {
  const losses = trades.filter(t => t.pnlUsdt < 0).map(t => -t.pnlUsdt);
  if (losses.length === 0) return 0;
  const R = losses.reduce((a, b) => a + b, 0) / losses.length;
  if (R <= 0) return 0;
  const avgPnl = trades.reduce((a, t) => a + t.pnlUsdt, 0) / trades.length;
  return avgPnl / R;
}

export function computeGateMetrics(r: UnifiedBacktestResult): GateMetrics {
  const trades = r.trades;
  const longs = trades.filter(t => t.side === 'LONG');
  const shorts = trades.filter(t => t.side === 'SHORT');

  const tp1Hits = trades.filter(t => t.exitReason === 'TP').length;
  const tp1Rate = trades.length ? tp1Hits / trades.length : 0;

  // OOS: 마지막 30% 구간
  const split = Math.floor(trades.length * 0.7);
  const oos = trades.slice(split);

  // Rolling30: 최근 30 trades
  const rolling30 = trades.slice(-30);

  // Top 3 winner 제거
  const sorted = [...trades].sort((a, b) => b.pnlUsdt - a.pnlUsdt);
  const withoutTop = sorted.slice(3);

  // MaxDD를 R 단위로 환산: R≈losses 평균(USDT). 단순 변환
  const losses = trades.filter(t => t.pnlUsdt < 0).map(t => -t.pnlUsdt);
  const R = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 1;
  const ddUsdt = (r.maxDrawdownPct / 100) * (trades.reduce((a, t) => a + Math.abs(t.pnlUsdt), 0) || 1);
  const maxDD_R = R > 0 ? ddUsdt / R : 0;

  return {
    trades: trades.length,
    pf: pf(trades),
    winRate: trades.length ? trades.filter(t => t.pnlUsdt > 0).length / trades.length : 0,
    tp1HitRate: tp1Rate,
    avgR: avgR(trades),
    maxDD_R,
    longPF: pf(longs),
    shortPF: pf(shorts),
    oosPF: pf(oos),
    rolling30PF: pf(rolling30),
    topRemovedPF: pf(withoutTop),
    feesIncluded: true,
    slippageIncluded: true,
  };
}

export function evaluateGates(m: GateMetrics): { checks: GateCheck[]; allPass: boolean } {
  const checks: GateCheck[] = [
    { key: 'minTrades',     label: '거래수 ≥ 100',          required: GATES.minTrades,      actual: m.trades,        pass: m.trades >= GATES.minTrades },
    { key: 'minPF',         label: 'Profit Factor ≥ 1.30',  required: GATES.minPF,          actual: m.pf,            pass: m.pf >= GATES.minPF },
    { key: 'minTp1Rate',    label: 'TP1 Hit Rate ≥ 50%',    required: GATES.minTp1Rate,     actual: m.tp1HitRate,    pass: m.tp1HitRate >= GATES.minTp1Rate },
    { key: 'minAvgR',       label: 'Avg R ≥ +0.07',          required: GATES.minAvgR,        actual: m.avgR,          pass: m.avgR >= GATES.minAvgR },
    { key: 'maxDD_R',       label: 'MaxDD ≤ 10R',            required: GATES.maxDD_R,        actual: m.maxDD_R,       pass: m.maxDD_R <= GATES.maxDD_R },
    { key: 'minOosPF',      label: 'OOS PF ≥ 1.20',          required: GATES.minOosPF,       actual: m.oosPF,         pass: m.oosPF >= GATES.minOosPF },
    { key: 'minRolling30PF',label: 'Rolling30 PF ≥ 1.10',    required: GATES.minRolling30PF, actual: m.rolling30PF,   pass: m.rolling30PF >= GATES.minRolling30PF },
  ];
  return { checks, allPass: checks.every(c => c.pass) };
}
