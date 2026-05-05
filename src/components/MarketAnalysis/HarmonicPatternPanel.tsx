/**
 * 하모닉 패턴 분석 패널 — 감지된 XABCD 패턴 + PRZ + Entry/SL/TP 시각화
 */
import { useMemo } from 'react';
import { Sparkles, Target, ShieldAlert, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { analyzeHarmonic } from '@/utils/theories/harmonic';
import type { Candle } from '@/utils/indicators';

interface Props {
  candles: Candle[];
  currentPrice: number;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 6 : 2 });
}

export function HarmonicPatternPanel({ candles, currentPrice }: Props) {
  const result = useMemo(() => {
    if (!candles.length) return null;
    return analyzeHarmonic(candles, currentPrice);
  }, [candles, currentPrice]);

  if (!result || !result.detected) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-bold text-amber-300">Harmonic Patterns</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {result?.reason ?? '하모닉 패턴 미감지 — 스윙 데이터 부족'}
        </div>
      </div>
    );
  }

  const p = result.detected;
  const inPrz = currentPrice >= p.prz.low && currentPrice <= p.prz.high;
  const dirIcon = p.bias === 'bullish'
    ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
    : <TrendingDown className="h-3.5 w-3.5 text-red-400" />;

  const tone = p.bias === 'bullish'
    ? 'border-emerald-500/30 bg-emerald-500/5'
    : 'border-red-500/30 bg-red-500/5';

  return (
    <div className={`rounded-xl border-2 ${tone} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-bold text-foreground">Harmonic · {p.name}</span>
          {dirIcon}
        </div>
        <div className="flex items-center gap-2">
          {inPrz && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
              PRZ 내부
            </span>
          )}
          <span className="text-[10px] font-mono text-muted-foreground">
            품질 {p.quality} · 신뢰 {result.confidence}
          </span>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground">{p.description}</div>

      {/* XABCD 비율 */}
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        <RatioChip label="XAB" v={p.ratios.xab} />
        <RatioChip label="ABC" v={p.ratios.abc} />
        <RatioChip label="BCD" v={p.ratios.bcd} />
        <RatioChip label="XAD" v={p.ratios.xad} highlight />
      </div>

      {/* PRZ */}
      <div className="rounded-lg bg-background/60 px-2 py-1.5">
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Target className="h-3 w-3" /> 잠재 반전 구간 (PRZ)
        </div>
        <div className="font-mono text-xs font-bold">
          ${fmt(p.prz.low)} ~ ${fmt(p.prz.high)}
        </div>
      </div>

      {/* Entry / SL / TP */}
      <div className="grid grid-cols-2 gap-1 text-[10px]">
        <Cell label="Entry" v={p.entry} />
        <Cell label="SL" v={p.sl} icon={<ShieldAlert className="h-3 w-3" />} tone="red" />
        <Cell label="TP1" v={p.tp1} tone="emerald" />
        <Cell label="TP2" v={p.tp2} tone="emerald" />
      </div>

      {/* XABCD 점들 */}
      <div className="border-t border-border pt-2">
        <div className="text-[10px] text-muted-foreground mb-1">패턴 포인트</div>
        <div className="grid grid-cols-5 gap-1 text-[10px]">
          {p.points.slice(0, 5).map((pt, i) => (
            <div key={i} className="text-center rounded bg-muted/40 px-1 py-1">
              <div className="font-bold text-foreground">{pt.label}</div>
              <div className="font-mono text-[9px] text-muted-foreground">${fmt(pt.price)}</div>
            </div>
          ))}
        </div>
      </div>

      {result.signal !== 'WATCH' && (
        <div className={`rounded-lg p-2 text-center text-xs font-bold ${
          result.signal === 'LONG' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
        }`}>
          {result.signal === 'LONG' ? '🟢 매수 신호' : '🔴 매도 신호'} · 신뢰도 {result.confidence}%
        </div>
      )}
    </div>
  );
}

function RatioChip({ label, v, highlight }: { label: string; v: number; highlight?: boolean }) {
  return (
    <div className={`text-center rounded px-1 py-1 ${
      highlight ? 'bg-amber-500/10 text-amber-300' : 'bg-muted text-muted-foreground'
    }`}>
      <div className="font-bold">{label}</div>
      <div className="font-mono">{(v * 100).toFixed(0)}%</div>
    </div>
  );
}

function Cell({ label, v, icon, tone }: { label: string; v: number; icon?: React.ReactNode; tone?: 'red' | 'emerald' }) {
  const cls = tone === 'red' ? 'text-red-400' : tone === 'emerald' ? 'text-emerald-400' : 'text-foreground';
  return (
    <div className="rounded bg-background/60 px-2 py-1">
      <div className="text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className={`font-mono font-bold ${cls}`}>${fmt(v)}</div>
    </div>
  );
}
