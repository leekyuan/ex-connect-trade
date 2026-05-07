/**
 * 실시간 Binance 캔들 + 멀티거래소 폴백 + Neo-Wave 분석 훅
 *
 * - 초기: 멀티거래소(Binance→OKX→Bybit→MEXC) REST로 캔들 로드
 * - Binance에 있을 때만 WebSocket 실시간 갱신, 그 외엔 30초 폴링
 */
import { useEffect, useRef, useState } from 'react';
import type { Candle } from '@/utils/indicators';
import { analyzeNeely, type NeoWaveResult } from '@/utils/theories/neely';
import { fetchKlinesFallback, type ExchangeId } from '@/lib/multiExchangeKlines';

interface State {
  candles: Candle[];
  result: NeoWaveResult | null;
  loading: boolean;
  error: string | null;
  lastUpdate: number;
  live: boolean;
  exchange: ExchangeId | null;
  fallback: boolean;
}

export function useRealtimeNeoWave(symbol: string, interval: string) {
  const [state, setState] = useState<State>({
    candles: [], result: null, loading: true, error: null,
    lastUpdate: 0, live: false, exchange: null, fallback: false,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const recalcTimer = useRef<number | null>(null);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    setState(s => ({
      ...s, loading: true, error: null, candles: [], result: null,
      live: false, exchange: null, fallback: false,
    }));

    fetchKlinesFallback(symbol, interval, 300)
      .then(({ candles, exchange, fallback }) => {
        if (!alive) return;
        candlesRef.current = candles;
        const lastPrice = candles[candles.length - 1]?.close ?? 0;
        const result = analyzeNeely(candles, lastPrice);
        setState({
          candles, result, loading: false, error: null,
          lastUpdate: Date.now(), live: false, exchange, fallback,
        });

        if (exchange === 'BINANCE' || exchange === 'BINANCE_FUT') {
          // WebSocket (현물 스트림 사용; 둘 다 같은 가격으로 충분)
          const wsSym = `${symbol.toLowerCase()}usdt@kline_${interval}`;
          const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSym}`);
          wsRef.current = ws;

          ws.onopen = () => alive && setState(s => ({ ...s, live: true }));
          ws.onclose = () => alive && setState(s => ({ ...s, live: false }));
          ws.onerror = () => alive && setState(s => ({ ...s, live: false }));

          ws.onmessage = (ev) => {
            if (!alive) return;
            try {
              const msg = JSON.parse(ev.data);
              const k = msg.k;
              if (!k) return;
              const newCandle: Candle = {
                time: k.t, open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v,
              };
              const cur = candlesRef.current;
              const last = cur[cur.length - 1];
              if (last && last.time === newCandle.time) cur[cur.length - 1] = newCandle;
              else if (!last || newCandle.time > last.time) {
                cur.push(newCandle);
                if (cur.length > 400) cur.shift();
              }
              if (recalcTimer.current) return;
              recalcTimer.current = window.setTimeout(() => {
                recalcTimer.current = null;
                if (!alive) return;
                const snap = candlesRef.current.slice();
                const result = analyzeNeely(snap, snap[snap.length - 1].close);
                setState(s => ({ ...s, candles: snap, result, lastUpdate: Date.now() }));
              }, 1000);
            } catch { /* ignore */ }
          };
        } else {
          // 폴백 거래소 → 30초 폴링
          const poll = async () => {
            try {
              const { candles: fresh } = await fetchKlinesFallback(symbol, interval, 300);
              if (!alive) return;
              candlesRef.current = fresh;
              const result = analyzeNeely(fresh, fresh[fresh.length - 1].close);
              setState(s => ({ ...s, candles: fresh, result, lastUpdate: Date.now(), live: true }));
            } catch { /* ignore */ }
          };
          pollTimer.current = window.setInterval(poll, 30_000);
          setState(s => ({ ...s, live: true }));
        }
      })
      .catch(e => alive && setState(s => ({ ...s, loading: false, error: e.message })));

    return () => {
      alive = false;
      if (wsRef.current) { try { wsRef.current.close(); } catch { /* ignore */ } wsRef.current = null; }
      if (recalcTimer.current) { clearTimeout(recalcTimer.current); recalcTimer.current = null; }
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    };
  }, [symbol, interval]);

  return state;
}
