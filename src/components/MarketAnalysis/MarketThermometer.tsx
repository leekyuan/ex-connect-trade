import { useMemo } from 'react';
import { Thermometer } from 'lucide-react';
import type { CoinAnalysis } from '@/hooks/useMarketAnalysis';

interface Props {
  analyses: CoinAnalysis[];
}

export function MarketThermometer({ analyses }: Props) {
  const stats = useMemo(() => {
    if (!analyses.length) return { long: 0, short: 0, neutral: 0, total: 0, longPct: 0, shortPct: 0, neutralPct: 0, mood: '데이터 없음', moodColor: 'text-muted-foreground' };
    const long = analyses.filter(a => a.signal === 'LONG').length;
    const short = analyses.filter(a => a.signal === 'SHORT').length;
    const neutral = analyses.filter(a => a.signal === 'WATCH').length;
    const total = analyses.length;
    const longPct = Math.round((long / total) * 100);
    const shortPct = Math.round((short / total) * 100);
    const neutralPct = 100 - longPct - shortPct;

    let mood = '중립';
    let moodColor = 'text-muted-foreground';
    const diff = longPct - shortPct;
    if (diff > 30) { mood = '강한 강세 🔥'; moodColor = 'text-emerald-400'; }
    else if (diff > 10) { mood = '약한 강세'; moodColor = 'text-emerald-300'; }
    else if (diff < -30) { mood = '강한 약세 ❄️'; moodColor = 'text-red-400'; }
    else if (diff < -10) { mood = '약한 약세'; moodColor = 'text-red-300'; }
    else { mood = '횡보 / 중립'; moodColor = 'text-amber-400'; }

    return { long, short, neutral, total, longPct, shortPct, neutralPct, mood, moodColor };
  }, [analyses]);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Thermometer className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">시장 온도계</span>
          <span className="text-[10px] text-muted-foreground">({stats.total}개 분석)</span>
        </div>
        <span className={`text-xs font-bold ${stats.moodColor}`}>{stats.mood}</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        {stats.longPct > 0 && (
          <div className="bg-emerald-500 flex items-center justify-center text-[9px] font-bold text-white" style={{ width: `${stats.longPct}%` }}>
            {stats.longPct >= 12 && `${stats.longPct}%`}
          </div>
        )}
        {stats.neutralPct > 0 && (
          <div className="bg-gray-500 flex items-center justify-center text-[9px] font-bold text-white" style={{ width: `${stats.neutralPct}%` }}>
            {stats.neutralPct >= 12 && `${stats.neutralPct}%`}
          </div>
        )}
        {stats.shortPct > 0 && (
          <div className="bg-red-500 flex items-center justify-center text-[9px] font-bold text-white" style={{ width: `${stats.shortPct}%` }}>
            {stats.shortPct >= 12 && `${stats.shortPct}%`}
          </div>
        )}
      </div>
      <div className="flex justify-between mt-1.5 text-[10px]">
        <span className="text-emerald-400">LONG {stats.long}</span>
        <span className="text-muted-foreground">중립 {stats.neutral}</span>
        <span className="text-red-400">SHORT {stats.short}</span>
      </div>
    </div>
  );
}
