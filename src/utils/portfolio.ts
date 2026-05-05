export interface PortfolioTrade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  quantity: number;
  leverage: number;
  pnl_usdt: number | null;
  pnl_pct: number | null;
  status: 'open' | 'closed';
  entry_at: string;
  exit_at: string | null;
  note: string | null;
}

export interface PortfolioStats {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  totalPnl: number;
  totalReturnPct: number;
  winRate: number;
  avgPnlPct: number;
  sharpe: number;
  maxDD: number;
  curve: { date: string; equity: number; pnl: number }[];
  monthly: { year: number; month: number; pnlPct: number }[];
}

export const INITIAL_CAPITAL = 10000;

export function calcPortfolioStats(
  trades: PortfolioTrade[],
  initialCapital = INITIAL_CAPITAL,
): PortfolioStats {
  const closed = trades
    .filter((t) => t.status === 'closed' && t.exit_at)
    .sort(
      (a, b) =>
        new Date(a.exit_at!).getTime() - new Date(b.exit_at!).getTime(),
    );

  const totalPnl = closed.reduce((s, t) => s + (t.pnl_usdt ?? 0), 0);
  const wins = closed.filter((t) => (t.pnl_usdt ?? 0) > 0);
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;

  let capital = initialCapital;
  const curve = closed.map((t) => {
    capital += t.pnl_usdt ?? 0;
    return {
      date: (t.exit_at ?? '').slice(0, 10),
      equity: Number(capital.toFixed(2)),
      pnl: Number((t.pnl_usdt ?? 0).toFixed(2)),
    };
  });

  const returns = closed.map((t) => t.pnl_pct ?? 0);
  const avg = returns.length
    ? returns.reduce((a, b) => a + b, 0) / returns.length
    : 0;
  const std =
    returns.length > 1
      ? Math.sqrt(
          returns.reduce((a, b) => a + (b - avg) ** 2, 0) / returns.length,
        ) || 1
      : 1;
  const sharpe = std > 0 ? (avg / std) * Math.sqrt(252) : 0;

  let peak = initialCapital;
  let maxDD = 0;
  let running = initialCapital;
  closed.forEach((t) => {
    running += t.pnl_usdt ?? 0;
    if (running > peak) peak = running;
    const dd = ((peak - running) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  });

  const monthMap = new Map<string, number>();
  closed.forEach((t) => {
    const key = (t.exit_at ?? '').slice(0, 7);
    if (!key) return;
    monthMap.set(key, (monthMap.get(key) ?? 0) + (t.pnl_usdt ?? 0));
  });
  const monthly = Array.from(monthMap.entries()).map(([k, pnl]) => {
    const [y, m] = k.split('-').map(Number);
    return {
      year: y,
      month: m,
      pnlPct: Number(((pnl / initialCapital) * 100).toFixed(2)),
    };
  });

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: trades.filter((t) => t.status === 'open').length,
    totalPnl: Number(totalPnl.toFixed(2)),
    totalReturnPct: Number(((totalPnl / initialCapital) * 100).toFixed(2)),
    winRate: Number(winRate.toFixed(1)),
    avgPnlPct: Number(avg.toFixed(2)),
    sharpe: Number(sharpe.toFixed(3)),
    maxDD: Number(maxDD.toFixed(2)),
    curve,
    monthly,
  };
}

export function buildHeatmap(
  monthly: { year: number; month: number; pnlPct: number }[],
): { year: number; months: (number | null)[]; total: number }[] {
  const grouped = new Map<number, (number | null)[]>();
  monthly.forEach(({ year, month, pnlPct }) => {
    if (!grouped.has(year)) grouped.set(year, Array(12).fill(null));
    grouped.get(year)![month - 1] = pnlPct;
  });
  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, months]) => ({
      year,
      months,
      total: Number(
        months.reduce<number>((s, v) => s + (v ?? 0), 0).toFixed(2),
      ),
    }));
}

export function tradesToCSV(trades: PortfolioTrade[]): string {
  const header = [
    'entry_at',
    'exit_at',
    'symbol',
    'side',
    'leverage',
    'entry_price',
    'exit_price',
    'quantity',
    'pnl_usdt',
    'pnl_pct',
    'status',
    'note',
  ];
  const rows = trades.map((t) =>
    [
      t.entry_at,
      t.exit_at ?? '',
      t.symbol,
      t.side,
      t.leverage,
      t.entry_price,
      t.exit_price ?? '',
      t.quantity,
      t.pnl_usdt ?? '',
      t.pnl_pct ?? '',
      t.status,
      (t.note ?? '').replace(/"/g, '""'),
    ]
      .map((v) => `"${String(v ?? '')}"`)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
