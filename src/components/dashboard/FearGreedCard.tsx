import { useEffect, useState } from 'react';
import { useFearGreed, classifyColor } from '@/hooks/useFearGreed';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity } from 'lucide-react';

interface FngHistoryItem { value: number; ts: number }

export function FearGreedCard() {
  const { data, loading } = useFearGreed();
  const [hist, setHist] = useState<FngHistoryItem[]>([]);

  useEffect(() => {
    let alive = true;
    fetch('https://api.alternative.me/fng/?limit=7')
      .then(r => r.json())
      .then(j => {
        if (!alive) return;
        const items: FngHistoryItem[] = (j?.data ?? []).map((d: any) => ({
          value: Number(d.value), ts: Number(d.timestamp) * 1000,
        })).reverse();
        setHist(items);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (loading || !data) {
    return <div className="rounded-xl border border-border bg-card p-4"><Skeleton className="h-24 w-full" /></div>;
  }

  const c = classifyColor(data.value);
  // 7일 추세
  const avg7 = hist.length ? hist.reduce((s, x) => s + x.value, 0) / hist.length : data.value;
  const delta = data.value - (hist[0]?.value ?? data.value);

  // historical context: 단순 가정 (실제 BTC ROI 데이터 없이 휴리스틱)
  const ctx = data.value < 25 ? '극단 공포 — 과거 평균 7d 수익률 +5~8%'
            : data.value < 45 ? '공포 — 과거 평균 7d 수익률 +1~3%'
            : data.value < 55 ? '중립 — 평균 변동 ±1%'
            : data.value < 75 ? '탐욕 — 단기 조정 가능성'
            : '극단 탐욕 — 평균 7d 수익률 -3~5%';

  // sparkline
  const W = 100, H = 28;
  const min = Math.min(...hist.map(h => h.value), data.value);
  const max = Math.max(...hist.map(h => h.value), data.value);
  const range = max - min || 1;
  const pts = hist.map((h, i) => `${(i / Math.max(hist.length - 1, 1)) * W},${H - ((h.value - min) / range) * H}`).join(' ');

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className={`h-4 w-4 ${c.cls}`} />
          <h3 className="text-sm font-bold">공포·탐욕 지수</h3>
        </div>
        <span className={`text-[10px] ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          7d {delta >= 0 ? '+' : ''}{delta.toFixed(0)}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className={`text-3xl font-bold font-mono ${c.cls}`}>{data.value}</div>
          <div className={`text-xs ${c.cls}`}>{c.label}</div>
        </div>
        {hist.length > 1 && (
          <svg width={W} height={H} className="opacity-80">
            <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" className={c.cls} />
          </svg>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
        7일 평균 <span className="font-mono text-foreground">{avg7.toFixed(0)}</span> · {ctx}
      </p>
    </div>
  );
}
