import type { PortfolioTrade } from '@/utils/portfolio';

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX'];
const PRICES: Record<string, number> = {
  BTC: 78000, ETH: 3200, SOL: 180, BNB: 620, XRP: 2.3, ADA: 0.92, DOGE: 0.38, AVAX: 42,
};

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

/** Generate 20 demo trades over the past 30 days. Closed mostly, a couple open. */
export function generateDemoTrades(count = 20): PortfolioTrade[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const trades: PortfolioTrade[] = [];
  for (let i = 0; i < count; i++) {
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const basePrice = PRICES[sym];
    const side: 'LONG' | 'SHORT' = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    const lev = [3, 5, 10][Math.floor(Math.random() * 3)];
    const entry = basePrice * (1 + rand(-0.05, 0.05));
    // 60% wins
    const win = Math.random() < 0.6;
    const movePct = win
      ? rand(0.5, 4) / 100
      : -rand(0.4, 2.5) / 100;
    const exit = side === 'LONG' ? entry * (1 + movePct) : entry * (1 - movePct);
    const qty = Number((rand(50, 500) / basePrice).toFixed(4));
    const raw = side === 'LONG' ? exit / entry - 1 : entry / exit - 1;
    const pnlPct = Number((raw * lev * 100).toFixed(2));
    const pnlUsdt = Number((raw * entry * qty * lev).toFixed(2));
    const ageDays = Math.floor(rand(0, 30));
    const entryAt = new Date(now - ageDays * day - rand(0, day)).toISOString();
    const isOpen = i < 2; // 2 open positions
    trades.push({
      id: `demo-${i}`,
      symbol: sym,
      side,
      entry_price: Number(entry.toFixed(2)),
      exit_price: isOpen ? null : Number(exit.toFixed(2)),
      stop_loss: null,
      take_profit: null,
      quantity: qty,
      leverage: lev,
      pnl_usdt: isOpen ? 0 : pnlUsdt,
      pnl_pct: isOpen ? 0 : pnlPct,
      status: isOpen ? 'open' : 'closed',
      entry_at: entryAt,
      exit_at: isOpen ? null : new Date(new Date(entryAt).getTime() + rand(1, 48) * 3600_000).toISOString(),
      note: 'Demo trade',
    });
  }
  return trades.sort((a, b) => new Date(b.entry_at).getTime() - new Date(a.entry_at).getTime());
}

/** Extended stats for portfolio. */
export function calcExtendedStats(trades: PortfolioTrade[]) {
  const closed = trades.filter(t => t.status === 'closed');
  const pnls = closed.map(t => t.pnl_usdt ?? 0);
  const wins = pnls.filter(p => p > 0);
  const losses = pnls.filter(p => p < 0);
  const grossWin = wins.reduce((s, v) => s + v, 0);
  const grossLoss = Math.abs(losses.reduce((s, v) => s + v, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0;
  const avgPerTrade = closed.length ? pnls.reduce((s, v) => s + v, 0) / closed.length : 0;

  // consecutive win/loss streak
  let maxWinStreak = 0, maxLossStreak = 0, curW = 0, curL = 0;
  closed
    .sort((a, b) => new Date(a.exit_at!).getTime() - new Date(b.exit_at!).getTime())
    .forEach(t => {
      const p = t.pnl_usdt ?? 0;
      if (p > 0) { curW++; curL = 0; if (curW > maxWinStreak) maxWinStreak = curW; }
      else if (p < 0) { curL++; curW = 0; if (curL > maxLossStreak) maxLossStreak = curL; }
    });

  const best = closed.reduce<PortfolioTrade | null>(
    (b, t) => (!b || (t.pnl_usdt ?? 0) > (b.pnl_usdt ?? 0)) ? t : b, null
  );
  const worst = closed.reduce<PortfolioTrade | null>(
    (b, t) => (!b || (t.pnl_usdt ?? 0) < (b.pnl_usdt ?? 0)) ? t : b, null
  );

  return {
    profitFactor: Number(profitFactor.toFixed(2)),
    avgPerTrade: Number(avgPerTrade.toFixed(2)),
    maxWinStreak,
    maxLossStreak,
    best,
    worst,
  };
}

/** Parse Binance Futures-style CSV. Expects columns including symbol/side/price/qty/realizedPnl. */
export function parseBinanceCSV(text: string): Partial<PortfolioTrade>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const rows: Partial<PortfolioTrade>[] = [];

  const find = (...names: string[]) => header.findIndex(h => names.some(n => h.includes(n)));
  const idxSymbol = find('symbol', 'pair');
  const idxSide = find('side', 'direction');
  const idxEntry = find('entry', 'price');
  const idxExit = find('exit', 'close');
  const idxQty = find('qty', 'amount', 'quantity');
  const idxPnl = find('pnl', 'realized');
  const idxTime = find('time', 'date');

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    if (cols.length < 3) continue;
    const symbol = (cols[idxSymbol] ?? '').replace(/USDT$|USD$|PERP$/i, '').toUpperCase();
    if (!symbol) continue;
    const sideStr = (cols[idxSide] ?? 'LONG').toUpperCase();
    const side: 'LONG' | 'SHORT' = sideStr.includes('SELL') || sideStr.includes('SHORT') ? 'SHORT' : 'LONG';
    const entry = Number(cols[idxEntry]) || 0;
    const exit = idxExit >= 0 ? Number(cols[idxExit]) || null : null;
    const qty = Number(cols[idxQty]) || 0;
    const pnl = idxPnl >= 0 ? Number(cols[idxPnl]) || 0 : 0;
    const time = idxTime >= 0 ? cols[idxTime] : new Date().toISOString();
    if (!entry || !qty) continue;
    rows.push({
      symbol,
      side,
      entry_price: entry,
      exit_price: exit,
      quantity: qty,
      leverage: 1,
      pnl_usdt: pnl,
      pnl_pct: entry > 0 ? Number(((pnl / (entry * qty)) * 100).toFixed(2)) : 0,
      status: exit ? 'closed' : 'open',
      entry_at: time,
      exit_at: exit ? time : null,
    });
  }
  return rows;
}
