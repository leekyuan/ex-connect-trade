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
  consensus: Dir;
  longCount: number;
  shortCount: number;
  exchange: ExchangeId;
  fallback: boolean;
  /** 캔들 부족 또는 모든 거래소 실패 */
  status?: 'ok' | 'low_data' | 'failed';
}

const cache = new Map<string, { ts: number; data: CoinTheorySignals }>();
const TTL = 60_000;

function toDir(s: 'LONG' | 'SHORT' | 'WATCH'): Dir { return s; }

async function computeFor(sym: string, tf = '1h'): Promise<CoinTheorySignals | null> {
  const ck = `${sym}-${tf}`;
  const cached = cache.get(ck);
  if (cached && Date.now() - cached.ts < TTL) return cached.data;
  try {
    const { candles, exchange, fallback } = await fetchKlinesFallback(sym, tf, 200);
    if (candles.length < 50) {
      const data: CoinTheorySignals = {
        ict: { dir: 'WATCH', confidence: 0 },
        wyckoff: { dir: 'WATCH', confidence: 0 },
        harmonic: { dir: 'WATCH', confidence: 0 },
        neely: { dir: 'WATCH', confidence: 0 },
        fractal: { dir: 'WATCH', confidence: 0 },
        consensus: 'WATCH', longCount: 0, shortCount: 0,
        exchange, fallback, status: 'low_data',
      };
      cache.set(ck, { ts: Date.now(), data });
      return data;
    }
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
      exchange, fallback, status: 'ok',
    };
    cache.set(ck, { ts: Date.now(), data });
    return data;
  } catch {
    const data: CoinTheorySignals = {
      ict: { dir: 'WATCH', confidence: 0 },
      wyckoff: { dir: 'WATCH', confidence: 0 },
      harmonic: { dir: 'WATCH', confidence: 0 },
      neely: { dir: 'WATCH', confidence: 0 },
      fractal: { dir: 'WATCH', confidence: 0 },
      consensus: 'WATCH', longCount: 0, shortCount: 0,
      exchange: 'BINANCE', fallback: false, status: 'failed',
    };
    return data;
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
