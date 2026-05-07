import { useEffect, useState } from 'react';
import type { Candle } from '@/utils/indicators';
import { analyzeICT } from '@/utils/theories/ict';
import { analyzeWyckoff } from '@/utils/theories/wyckoff';
import { analyzeHarmonic } from '@/utils/theories/harmonic';
import { analyzeNeely } from '@/utils/theories/neely';
import { analyzeFractal } from '@/utils/theories/fractal';
import { fetchKlinesFallback, type ExchangeId } from '@/lib/multiExchangeKlines';

export type Dir = 'LONG' | 'SHORT' | 'WATCH';

export interface CoinTheorySignals {
  ict: { dir: Dir; confidence: number };
  wyckoff: { dir: Dir; confidence: number };
  harmonic: { dir: Dir; confidence: number };
  neely: { dir: Dir; confidence: number };
  fractal: { dir: Dir; confidence: number };
  /** 5개 중 LONG/SHORT 다수결 */
  consensus: Dir;
  longCount: number;
  shortCount: number;
}

const cache = new Map<string, { ts: number; data: CoinTheorySignals }>();
const TTL = 60_000;

async function fetchKlines(sym: string): Promise<Candle[]> {
  const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}USDT&interval=1h&limit=120`);
  if (!r.ok) throw new Error('klines');
  const raw: any[] = await r.json();
  return raw.map(c => ({
    time: c[0], open: +c[1], high: +c[2], low: +c[3], close: +c[4], volume: +c[5],
  }));
}

function toDir(s: 'LONG' | 'SHORT' | 'WATCH'): Dir { return s; }

async function computeFor(sym: string): Promise<CoinTheorySignals | null> {
  const cached = cache.get(sym);
  if (cached && Date.now() - cached.ts < TTL) return cached.data;
  try {
    const candles = await fetchKlines(sym);
    if (candles.length < 30) return null;
    const price = candles[candles.length - 1].close;
    const ict = analyzeICT(candles, price);
    const wy = analyzeWyckoff(candles, price);
    const ha = analyzeHarmonic(candles, price);
    const ne = analyzeNeely(candles, price);
    const fr = analyzeFractal(candles, price);

    const all = [ict, wy, ha, ne, fr];
    const longCount = all.filter(x => x.signal === 'LONG').length;
    const shortCount = all.filter(x => x.signal === 'SHORT').length;
    const consensus: Dir = longCount > shortCount && longCount >= 2 ? 'LONG'
      : shortCount > longCount && shortCount >= 2 ? 'SHORT' : 'WATCH';

    const data: CoinTheorySignals = {
      ict: { dir: toDir(ict.signal), confidence: ict.confidence },
      wyckoff: { dir: toDir(wy.signal), confidence: wy.confidence },
      harmonic: { dir: toDir(ha.signal), confidence: ha.confidence },
      neely: { dir: toDir(ne.signal), confidence: ne.confidence },
      fractal: { dir: toDir(fr.signal), confidence: fr.confidence },
      consensus, longCount, shortCount,
    };
    cache.set(sym, { ts: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}

export function useScreenerTheories(symbols: string[], refreshMs = 60_000) {
  const [data, setData] = useState<Record<string, CoinTheorySignals | null>>({});
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (symbols.length === 0) return;
    let cancelled = false;
    async function run() {
      setProgress(0);
      for (let i = 0; i < symbols.length; i++) {
        if (cancelled) return;
        const sym = symbols[i];
        const r = await computeFor(sym);
        if (cancelled) return;
        setData(prev => ({ ...prev, [sym]: r }));
        setProgress(i + 1);
        await new Promise(res => setTimeout(res, 120));
      }
    }
    run();
    const id = setInterval(run, refreshMs);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(','), refreshMs]);

  return { data, progress, total: symbols.length };
}
