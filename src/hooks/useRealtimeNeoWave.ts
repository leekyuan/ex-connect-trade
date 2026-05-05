/**
 * 실시간 Binance 캔들 + Neo-Wave 분석 훅
 *
 * - 초기: REST로 300개 캔들 로드
 * - 이후: WebSocket(@kline_<interval>)로 마지막 캔들 실시간 갱신
 * - 캔들이 갱신될 때마다 analyzeNeely 재계산 (throttle 1초)
 */
import { useEffect, useRef, useState } from 'react';
import type { Candle } from '@/utils/indicators';
import { analyzeNeely, type NeoWaveResult } from '@/utils/theories/neely';

interface State {
  candles: Candle[];
  result: NeoWaveResult | null;
  loading: boolean;
  error: string | null;
  /** 마지막 갱신 timestamp */
  lastUpdate: number;
  /** 라이브 연결 상태 */
  live: boolean;
}

export function useRealtimeNeoWave(symbol: string, interval: string) {
  const [state, setState] = useState<State>({
    candles: [], result: null, loading: true, error: null, lastUpdate: 0, live: false,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const recalcTimer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    setState(s => ({ ...s, loading: true, error: null, candles: [], result: null, live: false }));

    // ── 1) REST 초기 로드 ──
    fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=300`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: any[]) => {
        if (!alive) return;
        const cs: Candle[] = data.map(k => ({
          time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5],
        }));
        candlesRef.current = cs;
        const lastPrice = cs[cs.length - 1]?.close ?? 0;
        const result = analyzeNeely(cs, lastPrice);
        setState({
          candles: cs, result, loading: false, error: null,
          lastUpdate: Date.now(), live: false,
        });

        // ── 2) WebSocket 구독 ──
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
            if (last && last.time === newCandle.time) {
              cur[cur.length - 1] = newCandle;
            } else if (!last || newCandle.time > last.time) {
              cur.push(newCandle);
              if (cur.length > 400) cur.shift();
            }

            // throttle: 1초마다 재계산
            if (recalcTimer.current) return;
            recalcTimer.current = window.setTimeout(() => {
              recalcTimer.current = null;
              if (!alive) return;
              const snap = candlesRef.current.slice();
              const result = analyzeNeely(snap, snap[snap.length - 1].close);
              setState(s => ({
                ...s, candles: snap, result,
                lastUpdate: Date.now(),
              }));
            }, 1000);
          } catch { /* ignore */ }
        };
      })
      .catch(e => alive && setState(s => ({ ...s, loading: false, error: e.message })));

    return () => {
      alive = false;
      if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
      if (recalcTimer.current) { clearTimeout(recalcTimer.current); recalcTimer.current = null; }
    };
  }, [symbol, interval]);

  return state;
}
