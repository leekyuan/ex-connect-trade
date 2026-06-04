/**
 * 월별 수익률 히트맵 (행=연도, 열=월, 셀=%).
 */
import type { MonthlyReturn } from '@/utils/profitFirstBacktest';

const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

function cellColor(v: number | null): string {
  if (v === null) return 'bg-muted/20 text-muted-foreground/50';
  if (v >= 10) return 'bg-emerald-500/70 text-white';
  if (v >= 5)  return 'bg-emerald-500/50 text-white';
  if (v >= 2)  return 'bg-emerald-500/30 text-emerald-50';
  if (v > 0)   return 'bg-emerald-500/15 text-emerald-200';
  if (v > -2)  return 'bg-red-500/15 text-red-200';
  if (v > -5)  return 'bg-red-500/30 text-red-50';
  if (v > -10) return 'bg-red-500/50 text-white';
  return 'bg-red-500/70 text-white';
}

export function MonthlyReturnsHeatmap({ data }: { data: MonthlyReturn[] }) {
  if (!data.length) return null;
  const years = Array.from(new Set(data.map(d => d.year))).sort();
  const lookup = new Map<string, number>();
  data.forEach(d => lookup.set(`${d.year}-${d.month}`, d.returnPct));

  return (
    <div className="overflow-auto">
      <table className="w-full text-[11px] border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="text-left font-medium text-muted-foreground px-1">연도</th>
            {MONTHS.map(m => (
              <th key={m} className="text-center font-medium text-muted-foreground w-12">{m}월</th>
            ))}
            <th className="text-center font-medium text-muted-foreground w-14">YTD</th>
          </tr>
        </thead>
        <tbody>
          {years.map(y => {
            const monthly = MONTHS.map((_, idx) => lookup.get(`${y}-${idx + 1}`) ?? null);
            const ytd = monthly.reduce((s, v) => v !== null ? (1 + s / 100) * (1 + v / 100) * 100 - 100 : s, 0);
            return (
              <tr key={y}>
                <td className="font-mono text-foreground px-1">{y}</td>
                {monthly.map((v, idx) => (
                  <td key={idx}
                      className={`rounded text-center font-mono py-1.5 ${cellColor(v)}`}>
                    {v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
                  </td>
                ))}
                <td className={`rounded text-center font-mono font-bold py-1.5 ${cellColor(ytd)}`}>
                  {ytd >= 0 ? '+' : ''}{ytd.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
