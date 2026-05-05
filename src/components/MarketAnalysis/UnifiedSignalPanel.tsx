import { Target, TrendingUp, TrendingDown, ShieldAlert, Sparkles } from 'lucide-react';
import { LABEL_META, type UnifiedSignal } from '@/utils/unifiedSignal';
import { AccuracyBadge } from '@/components/common/AccuracyBadge';
import { estimateAccuracy } from '@/utils/unifiedSignal';

interface Props {
  symbol?: string;
  signal: UnifiedSignal | null;
  loading?: boolean;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 6 : 2 });
}

export function UnifiedSignalPanel({ symbol, signal, loading }: Props) {
  if (loading || !signal) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 space-y-4 animate-pulse">
        <div className="h-12 bg-muted rounded" />
        <div className="h-24 bg-muted rounded" />
        <div className="h-32 bg-muted rounded" />
      </div>
    );
  }

  const meta = LABEL_META[signal.label];

  return (
    <div className="space-y-4">
      {/* Hero label */}
      <div className={`rounded-2xl border-2 ${meta.border} ${meta.bg} p-5 flex flex-col items-center text-center`}>
        <div className="text-[11px] text-muted-foreground mb-1">{symbol ?? '코인'} 통합 신호</div>
        <div className={`text-4xl font-black ${meta.cls} flex items-center gap-2`}>
          <span>{meta.emoji}</span>
          <span>{meta.ko}</span>
        </div>
        <div className="text-sm font-mono text-muted-foreground mt-1">총점 {signal.score}/100</div>
        <div className="mt-2">
          <AccuracyBadge accuracy={estimateAccuracy(signal.score)} />
        </div>
      </div>

      {/* Score breakdown */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> 점수 구성
        </h3>
        <Bar label="기술 지표 (RSI · MACD · BB · EMA · 거래량)" value={signal.breakdown.technical} max={40} color="bg-blue-500" />
        <Bar label="패턴 분석 (엘리어트 · 하모닉 · 와이코프 · ICT)" value={signal.breakdown.pattern} max={35} color="bg-purple-500" />
        <Bar label="추세 강도 (Supertrend · ADX · 피보나치)" value={signal.breakdown.trend} max={25} color="bg-amber-500" />
      </div>

      {/* Trade plan */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> 추천 가격대
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Box icon={<Target className="h-3 w-3 text-primary" />} label="진입" value={signal.entry} cls="text-foreground" />
          <Box icon={<TrendingUp className="h-3 w-3 text-emerald-400" />} label="TP1" value={signal.tp1} cls="text-emerald-400" />
          <Box icon={<TrendingUp className="h-3 w-3 text-emerald-400" />} label="TP2" value={signal.tp2} cls="text-emerald-400" />
          <Box icon={<ShieldAlert className="h-3 w-3 text-red-400" />} label="손절" value={signal.sl} cls="text-red-400" />
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <ZoneRow label="저항 1" zone={signal.resistance1} color="text-orange-400" />
          <ZoneRow label="저항 2" zone={signal.resistance2} color="text-red-400" />
          <ZoneRow label="지지 1" zone={signal.support1} color="text-emerald-300" />
          <ZoneRow label="지지 2" zone={signal.support2} color="text-emerald-400" />
        </div>
      </div>

      {/* Comment */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="text-[11px] text-primary font-semibold mb-1">📝 한줄 요약</div>
        <p className="text-sm text-foreground leading-relaxed">{signal.comment}</p>
      </div>

      {/* Indicator chips */}
      <div className="flex flex-wrap gap-2 text-[10px]">
        <Chip>RSI {signal.details.rsi ?? '-'}</Chip>
        <Chip>MACD {signal.details.macdHist != null ? (signal.details.macdHist > 0 ? '↑' : '↓') : '-'}</Chip>
        <Chip>BB {signal.details.bbPosition}</Chip>
        <Chip>EMA {signal.details.emaTrend}</Chip>
        <Chip>거래량 {signal.details.volumeBoost > 0 ? '+' : ''}{(signal.details.volumeBoost * 100).toFixed(0)}%</Chip>
        <Chip>Supertrend {signal.details.supertrend}</Chip>
        <Chip>ADX {signal.details.adx}</Chip>
      </div>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-bold text-foreground">{value.toFixed(1)} / {max}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Box({ icon, label, value, cls }: { icon: React.ReactNode; label: string; value: number; cls: string }) {
  return (
    <div className="rounded-md bg-muted p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">{icon}{label}</div>
      <div className={`font-mono text-sm font-bold ${cls}`}>${fmt(value)}</div>
    </div>
  );
}

function ZoneRow({ label, zone, color }: { label: string; zone: { price: number; low: number; high: number }; color: string }) {
  return (
    <div className="flex items-center justify-between bg-muted/50 rounded px-2 py-1">
      <span className={`font-medium ${color}`}>{label}</span>
      <span className="font-mono text-muted-foreground">${fmt(zone.low)} – ${fmt(zone.high)}</span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border">{children}</span>;
}
