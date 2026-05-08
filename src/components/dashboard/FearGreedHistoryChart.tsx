import { useEffect, useMemo, useState } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from 'recharts';
import { Activity, Loader2 } from 'lucide-react';
import { fetchKlinesFallback } from '@/lib/multiExchangeKlines';

interface Row { date: string; fng: number; btc?: number; }

const CACHE_KEY = 'fng_history_cache_v1';
const CACHE_TTL = 6 * 3600 * 1000;

export function FearGreedHistoryChart() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [overlay, setOverlay] = useState(true);

  useEffect(() => {
    let alive = true;
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < CACHE_TTL) {
          setRows(parsed.rows);
          setLoading(false);
          return;
        }
      } catch {}
    }

    Promise.all([
      fetch('https://api.alternative.me/fng/?limit=30').then(r => r.json()),
      fetchKlinesFallback('BTC', '1d', 30).catch(() => null),
    ]).then(([fngJ, btcRes]) => {
      if (!alive) return;
      const fngItems: { value: number; ts: number }[] = (fngJ?.data ?? []).map((d: any) => ({
        value: Number(d.value),
        ts: Number(d.timestamp) * 1000,
      })).reverse();

      const btcCloses = btcRes?.candles.map(c => ({ ts: c.time, close: c.close })) ?? [];
      // normalize BTC to 0-100 scale based on min/max in window
      const btcVals = btcCloses.map(b => b.close);
      const bmin = Math.min(...btcVals, Infinity);
      const bmax = Math.max(...btcVals, -Infinity);
      const brange = bmax - bmin || 1;

      const merged: Row[] = fngItems.map(f => {
        const date = new Date(f.ts).toISOString().slice(5, 10);
        const btcMatch = btcCloses.find(b => Math.abs(b.ts - f.ts) < 24 * 3600 * 1000);
        const btcNorm = btcMatch ? ((btcMatch.close - bmin) / brange) * 100 : undefined;
        return { date, fng: f.value, btc: btcNorm };
      });

      setRows(merged);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), rows: merged }));
      setLoading(false);
    }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const stats = useMemo(() => {
    if (rows.length === 0) return null;
    const vals = rows.map(r => r.fng);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const cur = vals[vals.length - 1];
    // 연속 일수 (현재 구간)
    const zone = (v: number) => v < 25 ? 'extreme_fear' : v < 45 ? 'fear' : v < 55 ? 'neutral' : v < 75 ? 'greed' : 'extreme_greed';
    const curZone = zone(cur);
    let streak = 0;
    for (let i = vals.length - 1; i >= 0; i--) {
      if (zone(vals[i]) === curZone) streak++;
      else break;
    }
    const zoneLabel = { extreme_fear: '극단 공포', fear: '공포', neutral: '중립', greed: '탐욕', extreme_greed: '극단 탐욕' }[curZone];
    return { avg, max, min, cur, streak, zoneLabel };
  }, [rows]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 h-80 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">공포·탐욕 30일 히스토리</h3>
        </div>
        <button onClick={() => setOverlay(o => !o)}
          className={`text-[10px] px-2 py-1 rounded-md border ${
            overlay ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-muted border-border text-muted-foreground'
          }`}>
          BTC 오버레이
        </button>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={rows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
          <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={10} />
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={25} stroke="#ef4444" strokeDasharray="3 3" />
          <ReferenceLine y={75} stroke="#10b981" strokeDasharray="3 3" />
          <Area type="monotone" dataKey="fng" name="공포·탐욕" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} strokeWidth={2} />
          {overlay && (
            <Line type="monotone" dataKey="btc" name="BTC (정규화)" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {stats && (
        <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
          <div className="rounded-lg bg-muted/40 p-2">
            <div className="text-muted-foreground">평균</div>
            <div className="font-mono font-bold text-base">{stats.avg.toFixed(0)}</div>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <div className="text-muted-foreground">최고</div>
            <div className="font-mono font-bold text-base text-emerald-400">{stats.max}</div>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <div className="text-muted-foreground">최저</div>
            <div className="font-mono font-bold text-base text-red-400">{stats.min}</div>
          </div>
          <div className="rounded-lg bg-primary/10 p-2 border border-primary/30">
            <div className="text-muted-foreground">{stats.zoneLabel}</div>
            <div className="font-mono font-bold text-base">{stats.streak}일째</div>
          </div>
        </div>
      )}
    </div>
  );
}
