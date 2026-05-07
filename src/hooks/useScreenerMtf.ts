/**
 * MTF (Multi-Timeframe) 매트릭스 — 코인 × TF 별 신호
 * 거래소 폴백 사용. 5개씩 순차 배치.
 */
import { useEffect, useState } from 'react';
import { fetchKlinesFallback } from '@/lib/multiExchangeKlines';
import { analyzeICT } from '@/utils/theories/ict';
import { analyzeWyckoff } from '@/utils/theories/wyckoff';
import { analyzeHarmonic } from '@/utils/theories/harmonic';
import { analyzeNeely } from '@/utils/theories/neely';
import { analyzeFractal } from '@/utils/theories/fractal';

export type MtfDir = 'LONG' | 'SHORT' | 'WATCH';
export interface MtfCell { dir: MtfDir; score: number; status: 'ok' | 'low_data' | 'failed' }
export type MtfRow = Record<string, MtfCell | null>;

export const MTF_TFS = ['15m', '1h', '4h', '1d'] as const;
export type MtfTf = typeof MTF_TFS[number];

const cache = new Map<string, { ts: number; cell: MtfCell }>();
const TTL = 60_000;

async function computeCell(sym: string, tf: MtfTf): Promise<MtfCell> {
  const ck = `${sym}-${tf}`;
  const c = cache.get(ck);
  if (c && Date.now() - c.ts < TTL) return c.cell;
  try {
    const { candles } = await fetchKlinesFallback(sym, tf, 200);
    if (candles.length < 50) {
      const cell: MtfCell = { dir: 'WATCH', score: 0, status: 'low_data' };
      cache.set(ck, { ts: Date.now(), cell });
      return cell;
    }
    const price = candles[candles.length - 1].close;
    const all = [
      analyzeICT(candles, price),
      analyzeWyckoff(candles, price),
      analyzeHarmonic(candles, price),
      analyzeNeely(candles, price),
      analyzeFractal(candles, price),
    ];
    const longCount = all.filter(x => x.signal === 'LONG').length;
    const shortCount = all.filter(x => x.signal === 'SHORT').length;
    const dir: MtfDir = longCount > shortCount && longCount >= 2 ? 'LONG'
      : shortCount > longCount && shortCount >= 2 ? 'SHORT' : 'WATCH';
    const matched = all.filter(x => x.signal === dir);
    const score = matched.length
      ? Math.round(matched.reduce((s, x) => s + x.confidence, 0) / matched.length)
      : Math.round(all.reduce((s, x) => s + x.confidence, 0) / all.length);
    const cell: MtfCell = { dir, score, status: 'ok' };
    cache.set(ck, { ts: Date.now(), cell });
    return cell;
  } catch {
    return { dir: 'WATCH', score: 0, status: 'failed' };
  }
}

export interface MtfState {
  matrix: Record<string, MtfRow>;
  progress: number;
  total: number;
}

export function useScreenerMtf(symbols: string[], refreshMs = 30_000) {
  const [matrix, setMatrix] = useState<Record<string, MtfRow>>({});
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (symbols.length === 0) return;
    let cancelled = false;
    const total = symbols.length * MTF_TFS.length;

    async function run() {
      setProgress(0);
      let done = 0;
      // 코인 5개씩 묶어 모든 TF 병렬
      const batchSize = 5;
      for (let i = 0; i < symbols.length; i += batchSize) {
        if (cancelled) return;
        const batch = symbols.slice(i, i + batchSize);
        const tasks: Promise<{ sym: string; tf: MtfTf; cell: MtfCell }>[] = [];
        for (const sym of batch) {
          for (const tf of MTF_TFS) {
            tasks.push(computeCell(sym, tf).then(cell => ({ sym, tf, cell })));
          }
        }
        const results = await Promise.all(tasks);
        if (cancelled) return;
        setMatrix(prev => {
          const next = { ...prev };
          for (const { sym, tf, cell } of results) {
            next[sym] = { ...(next[sym] ?? {}), [tf]: cell };
          }
          return next;
        });
        done += results.length;
        setProgress(done);
        await new Promise(r => setTimeout(r, 250));
      }
      void total;
    }
    run();
    const id = setInterval(run, refreshMs);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(','), refreshMs]);

  return { matrix, progress, total: symbols.length * MTF_TFS.length };
}
