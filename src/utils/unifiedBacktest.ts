/**
 * Unified-signal backtester:
 * - Recomputes UnifiedSignal at each closed candle, enters at next open.
 * - Holds until opposite-side label or until SL/TP from signal hits.
 * - Compares vs Buy & Hold of the underlying.
 */
import { fetchKlines } from './backtest';
import { computeUnifiedSignal } from './unifiedSignal';
import type { Candle } from './indicators';

export type Period = '1m' | '3m' | '6m' | '1y';

export interface UnifiedBacktestConfig {
  symbol: string;
  period: Period;
  initialCash: number;
}

export interface UnifiedTrade {
  entryDate: string;
  exitDate: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  pnlUsdt: number;
  signalLabel: string;
  exitReason: 'OPP' | 'TP' | 'SL';
}

export interface UnifiedBacktestResult {
  trades: UnifiedTrade[];
  totalReturnPct: number;
  buyHoldReturnPct: number;
  winRatePct: number;
  totalTrades: number;
  maxDrawdownPct: number;
  equityCurve: { date: string; equity: number; bh: number }[];
  startPrice: number;
  endPrice: number;
}

const PERIOD_DAYS: Record<Period, number> = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 };
const FEE = 0.0004; // 0.04% per side
const SLIP = 0.0005; // 0.05% per side
const INTERVAL = '1h';

export async function runUnifiedBacktest(
  config: UnifiedBacktestConfig,
  onProgress: (msg: string) => void
): Promise<UnifiedBacktestResult> {
  onProgress('과거 데이터 수집 중...');
  const days = PERIOD_DAYS[config.period];
  const end = Date.now();
  const start = end - days * 86400000;
  const candles = await fetchKlines(config.symbol, INTERVAL, start, end);
  if (candles.length < 80) throw new Error('데이터 부족');

  onProgress('통합 신호 시뮬레이션 중...');

  const trades: UnifiedTrade[] = [];
  let cash = config.initialCash;
  let position:
    | null
    | {
        side: 'LONG' | 'SHORT';
        entry: number;
        sl: number;
        tp: number;
        entryDate: string;
        entryTime: number;
        label: string;
        size: number; // USDT used
      } = null;

  const equityCurve: { date: string; equity: number; bh: number }[] = [];
  const startPrice = candles[60]?.open ?? candles[0].open;

  for (let i = 60; i < candles.length - 1; i++) {
    const slice = candles.slice(0, i + 1) as Candle[];
    const cur = candles[i];
    const next = candles[i + 1];
    const sig = computeUnifiedSignal(slice, cur.close);
    if (!sig) continue;

    // ── 1. Manage existing position ──
    if (position) {
      let exitRaw: number | null = null;
      let reason: UnifiedTrade['exitReason'] | null = null;

      if (position.side === 'LONG') {
        if (next.low <= position.sl) { exitRaw = position.sl; reason = 'SL'; }
        else if (next.high >= position.tp) { exitRaw = position.tp; reason = 'TP'; }
      } else {
        if (next.high >= position.sl) { exitRaw = position.sl; reason = 'SL'; }
        else if (next.low <= position.tp) { exitRaw = position.tp; reason = 'TP'; }
      }

      // Opposite signal → exit at next open
      const oppositeBuy = position.side === 'SHORT' && (sig.label === 'BUY' || sig.label === 'STRONG_BUY');
      const oppositeSell = position.side === 'LONG' && (sig.label === 'SELL' || sig.label === 'STRONG_SELL');
      if (!exitRaw && (oppositeBuy || oppositeSell)) {
        exitRaw = next.open;
        reason = 'OPP';
      }

      if (exitRaw && reason) {
        const exit = position.side === 'LONG' ? exitRaw * (1 - SLIP) : exitRaw * (1 + SLIP);
        const rawPct = position.side === 'LONG' ? exit / position.entry - 1 : position.entry / exit - 1;
        const grossPnl = position.size * rawPct;
        const fees = position.size * FEE * 2;
        const netPnl = grossPnl - fees;
        cash += netPnl;
        trades.push({
          entryDate: position.entryDate,
          exitDate: new Date(next.time).toISOString(),
          side: position.side,
          entryPrice: position.entry,
          exitPrice: exit,
          pnlPct: Number((rawPct * 100 - 0.18).toFixed(3)),
          pnlUsdt: Number(netPnl.toFixed(2)),
          signalLabel: position.label,
          exitReason: reason,
        });
        position = null;
      }
    }

    // ── 2. New entry on signal ──
    if (!position) {
      const isBuy = sig.label === 'STRONG_BUY' || sig.label === 'BUY';
      const isSell = sig.label === 'STRONG_SELL' || sig.label === 'SELL';
      if (isBuy || isSell) {
        const side: 'LONG' | 'SHORT' = isBuy ? 'LONG' : 'SHORT';
        const rawEntry = next.open;
        const entry = side === 'LONG' ? rawEntry * (1 + SLIP) : rawEntry * (1 - SLIP);
        const size = cash * 0.95; // commit 95% cash
        position = {
          side,
          entry,
          sl: sig.sl,
          tp: sig.tp1,
          entryDate: new Date(next.time).toISOString(),
          entryTime: next.time,
          label: sig.label,
          size,
        };
      }
    }

    // Equity snapshot
    if (i % 24 === 0 || i === candles.length - 2) {
      let mark = cash;
      if (position) {
        const px = cur.close;
        const dir = position.side === 'LONG' ? 1 : -1;
        mark = cash + position.size * ((px - position.entry) / position.entry) * dir;
      }
      const bh = config.initialCash * (cur.close / startPrice);
      equityCurve.push({
        date: new Date(cur.time).toISOString().slice(0, 10),
        equity: Number(mark.toFixed(2)),
        bh: Number(bh.toFixed(2)),
      });
    }
  }

  const endPrice = candles[candles.length - 1].close;
  const finalEquity = equityCurve.length ? equityCurve[equityCurve.length - 1].equity : cash;
  const totalReturnPct = Number(((finalEquity / config.initialCash - 1) * 100).toFixed(2));
  const buyHoldReturnPct = Number(((endPrice / startPrice - 1) * 100).toFixed(2));

  const wins = trades.filter((t) => t.pnlUsdt > 0).length;
  const winRatePct = trades.length ? Number(((wins / trades.length) * 100).toFixed(1)) : 0;

  // Max DD on equity curve
  let peak = config.initialCash;
  let maxDD = 0;
  equityCurve.forEach((p) => {
    if (p.equity > peak) peak = p.equity;
    const dd = ((peak - p.equity) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  });

  return {
    trades,
    totalReturnPct,
    buyHoldReturnPct,
    winRatePct,
    totalTrades: trades.length,
    maxDrawdownPct: Number(maxDD.toFixed(2)),
    equityCurve,
    startPrice,
    endPrice,
  };
}
