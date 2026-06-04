/**
 * 몬테카를로 1000회 결과를 박스플롯 한 줄로 시각화.
 * 5% — 25% — 50% — 75% — 95% 구간.
 */
import type { MonteCarloResult } from '@/utils/profitFirstBacktest';

export function MonteCarloBoxPlot({ mc }: { mc: MonteCarloResult }) {
  const min = mc.worst5;
  const max = mc.best5;
  const range = max - min || 1;
  const pct = (v: number) => ((v - min) / range) * 100;

  const ticks = [min, mc.p25, mc.median, mc.p75, max];

  return (
    <div className="space-y-3">
      <div className="relative h-16">
        {/* whisker line */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-border" />
        {/* box (25% ~ 75%) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-10 rounded bg-primary/30 border border-primary/60"
          style={{
            left: `${pct(mc.p25)}%`,
            width: `${pct(mc.p75) - pct(mc.p25)}%`,
          }}
        />
        {/* median */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-12 w-0.5 bg-primary"
          style={{ left: `${pct(mc.median)}%` }}
        />
        {/* whisker caps */}
        {[min, max].map(v => (
          <div key={v} className="absolute top-1/2 -translate-y-1/2 h-6 w-px bg-muted-foreground"
               style={{ left: `${pct(v)}%` }} />
        ))}
      </div>
      <div className="relative h-4">
        {ticks.map((v, i) => (
          <div key={i} className="absolute text-[10px] font-mono text-muted-foreground -translate-x-1/2"
               style={{ left: `${pct(v)}%` }}>
            {v >= 0 ? '+' : ''}{v.toFixed(0)}%
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1 text-center text-[10px]">
        <span className="text-red-400">5%</span>
        <span className="text-amber-400">25%</span>
        <span className="text-foreground font-bold">중간값</span>
        <span className="text-amber-400">75%</span>
        <span className="text-emerald-400">95%</span>
      </div>
    </div>
  );
}
