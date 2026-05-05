import { useEffect, useRef, useCallback } from 'react';
import type { CoinAnalysis } from './useMarketAnalysis';

/** Request notification permission on mount; send alerts when new LONG/SHORT signals appear */
export function useSignalNotifications(analyses: CoinAnalysis[], enabled: boolean) {
  const prevSignals = useRef<Map<string, string>>(new Map());

  // Request permission once
  useEffect(() => {
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (analyses.length === 0) return;

    const prev = prevSignals.current;
    const newMap = new Map<string, string>();

    analyses.forEach(a => {
      const sym = a.coin.symbol;
      const oldSig = prev.get(sym);
      newMap.set(sym, a.signal);

      // Only notify on signal change to LONG or SHORT
      if (oldSig && oldSig !== a.signal && a.signal !== 'WATCH') {
        const icon = a.signal === 'LONG' ? '🟢' : '🔴';
        const dir = a.signal === 'LONG' ? '롱' : '숏';
        new Notification(`${icon} ${sym} ${dir} 신호 발생`, {
          body: `신뢰도 ${a.confidence}% — ${a.reasoning[0] ?? ''}`,
          tag: `signal-${sym}`,
        });
      }
    });

    prevSignals.current = newMap;
  }, [analyses, enabled]);
}
