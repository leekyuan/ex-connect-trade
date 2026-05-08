import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Network, Loader2 } from 'lucide-react';
import { fetchKlinesFallback } from '@/lib/multiExchangeKlines';
import { useCoinMarketCap } from '@/hooks/useCoinMarketCap';

const TF_OPTIONS = [
  { label: '1H × 7D', tf: '1h', limit: 24 * 7 },
  { label: '4H × 30D', tf: '4h', limit: 6 * 30 },
  { label: '1D × 90D', tf: '1d', limit: 90 },
];

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

function colorFor(v: number): string {
  // -1 red, 0 neutral, +1 green
  const intensity = Math.abs(v);
  if (v >= 0) return `rgba(16, 185, 129, ${0.15 + intensity * 0.65})`;
  return `rgba(239, 68, 68, ${0.15 + intensity * 0.65})`;
}

export default function CorrelationPage() {
  const { coins } = useCoinMarketCap(60_000);
  const [tfIdx, setTfIdx] = useState(1);
  const [returns, setReturns] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const symbols = useMemo(() => coins.slice(0, 10).map(c => c.symbol), [coins]);

  useEffect(() => {
    if (symbols.length === 0) return;
    let alive = true;
    setLoading(true);
    setErr(null);
    const opt = TF_OPTIONS[tfIdx];
    Promise.all(symbols.map(async (s) => {
      try {
        const res = await fetchKlinesFallback(s, opt.tf, opt.limit);
        const closes = res.candles.map(c => c.close);
        const rets: number[] = [];
        for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
        return [s, rets] as const;
      } catch {
        return [s, [] as number[]] as const;
      }
    })).then(pairs => {
      if (!alive) return;
      const m: Record<string, number[]> = {};
      pairs.forEach(([s, r]) => { m[s] = r; });
      setReturns(m);
    }).catch(e => alive && setErr(e?.message ?? '데이터 로드 실패'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [symbols.join(','), tfIdx]);

  const matrix = useMemo(() => {
    return symbols.map(a => symbols.map(b => pearson(returns[a] ?? [], returns[b] ?? [])));
  }, [symbols, returns]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Network className="h-6 w-6 text-primary" /> 코인 상관관계 매트릭스
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Top 10 시총 코인 · 로그수익률 Pearson 상관계수
            </p>
          </div>
          <div className="flex gap-1">
            {TF_OPTIONS.map((opt, i) => (
              <button key={opt.label} onClick={() => setTfIdx(i)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                  tfIdx === i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </header>

        <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
          {err && <p className="text-sm text-destructive mb-2">{err}</p>}
          {loading && symbols.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="p-2 sticky left-0 bg-card"></th>
                  {symbols.map(s => (
                    <th key={s} className="p-2 font-mono text-muted-foreground">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {symbols.map((rowSym, i) => (
                  <tr key={rowSym}>
                    <td className="p-2 font-mono font-bold text-muted-foreground sticky left-0 bg-card">{rowSym}</td>
                    {symbols.map((colSym, j) => {
                      const v = matrix[i]?.[j] ?? 0;
                      return (
                        <td key={colSym}
                          className="p-2 text-center font-mono font-bold"
                          style={{ backgroundColor: i === j ? 'rgba(99,102,241,0.25)' : colorFor(v) }}
                          title={`${rowSym} vs ${colSym}: ${v.toFixed(3)}`}>
                          {v.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground space-y-1">
          <div className="font-bold text-foreground">해석</div>
          <div>· <span className="text-emerald-400 font-bold">+1</span>: 동일 방향 움직임 (분산투자 효과 낮음)</div>
          <div>· <span className="text-red-400 font-bold">-1</span>: 반대 움직임 (헤지 효과)</div>
          <div>· <span className="text-foreground font-bold">0</span> 부근: 독립적 움직임 (포트폴리오 분산에 유리)</div>
        </div>
      </div>
    </DashboardLayout>
  );
}
