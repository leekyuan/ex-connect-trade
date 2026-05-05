import { useEffect, useState } from 'react';
import { computeScreenerScore, type ScreenerScore } from '@/utils/scoreScreener';

/**
 * 여러 코인을 순차 fetch (rate-limit 안전).
 * 결과를 누적적으로 set 하여 UI가 점진적으로 채워짐.
 */
export function useScreenerScores(symbols: string[], refreshMs = 60_000) {
  const [scores, setScores] = useState<Record<string, ScreenerScore | null>>({});
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (symbols.length === 0) return;
    let cancelled = false;

    async function run() {
      setLoading(true);
      setProgress(0);
      const next: Record<string, ScreenerScore | null> = {};
      for (let i = 0; i < symbols.length; i++) {
        if (cancelled) return;
        const sym = symbols[i];
        const s = await computeScreenerScore(sym);
        if (cancelled) return;
        next[sym] = s;
        setScores(prev => ({ ...prev, [sym]: s }));
        setProgress(i + 1);
        // light rate-limit gap
        await new Promise(r => setTimeout(r, 80));
      }
      setLoading(false);
    }

    run();
    const id = setInterval(run, refreshMs);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(','), refreshMs]);

  return { scores, progress, loading, total: symbols.length };
}
