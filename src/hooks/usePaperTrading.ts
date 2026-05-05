import { useState, useEffect, useCallback } from 'react';

const KEY = 'cryptoedge-paper-v1';
const INITIAL_BALANCE = 10000;

export interface PaperPosition {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  entryPrice: number;
  openedAt: number;
}

interface PaperState {
  balance: number;
  positions: PaperPosition[];
  realizedPnl: number;
}

const load = (): PaperState => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { balance: INITIAL_BALANCE, positions: [], realizedPnl: 0 };
};

const save = (s: PaperState) => {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
};

export function usePaperTrading() {
  const [state, setState] = useState<PaperState>(load);

  useEffect(() => { save(state); }, [state]);

  const buy = useCallback((symbol: string, qty: number, price: number) => {
    const cost = qty * price;
    if (cost > state.balance) return { ok: false, error: '잔고 부족' };
    setState(s => ({
      ...s,
      balance: s.balance - cost,
      positions: [
        ...s.positions,
        { id: crypto.randomUUID(), symbol, side: 'BUY', qty, entryPrice: price, openedAt: Date.now() },
      ],
    }));
    return { ok: true };
  }, [state.balance]);

  const sell = useCallback((symbol: string, qty: number, price: number) => {
    // FIFO close from existing BUY positions on this symbol
    setState(s => {
      let remaining = qty;
      const newPositions: PaperPosition[] = [];
      let realized = 0;
      let cashAdd = 0;
      for (const p of s.positions) {
        if (p.symbol !== symbol || p.side !== 'BUY' || remaining <= 0) {
          newPositions.push(p);
          continue;
        }
        const closeQty = Math.min(p.qty, remaining);
        realized += (price - p.entryPrice) * closeQty;
        cashAdd += price * closeQty;
        remaining -= closeQty;
        const left = p.qty - closeQty;
        if (left > 0) newPositions.push({ ...p, qty: left });
      }
      // If still remaining, open a SHORT (simple)
      if (remaining > 0) {
        newPositions.push({
          id: crypto.randomUUID(), symbol, side: 'SELL', qty: remaining, entryPrice: price, openedAt: Date.now(),
        });
        cashAdd += price * remaining; // collateral simplification
      }
      return {
        balance: s.balance + cashAdd,
        positions: newPositions,
        realizedPnl: s.realizedPnl + realized,
      };
    });
    return { ok: true };
  }, []);

  const reset = useCallback(() => {
    setState({ balance: INITIAL_BALANCE, positions: [], realizedPnl: 0 });
  }, []);

  return { ...state, buy, sell, reset, initialBalance: INITIAL_BALANCE };
}
