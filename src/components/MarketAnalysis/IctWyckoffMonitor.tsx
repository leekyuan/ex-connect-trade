import { useMemo } from 'react';
import { Activity, TrendingUp, TrendingDown, Eye } from 'lucide-react';
import type { Candle } from '@/utils/indicators';
import { analyzeICT } from '@/utils/theories/ict';
import { analyzeWyckoff } from '@/utils/theories/wyckoff';

interface Props {
  candles: Candle[];
  currentPrice: number;
  live?: boolean;
  lastUpdate?: number;
}

const SIG_META = {
  LONG:  { ko: '롱',   cls: 'text-emerald-400', bg: 'bg-emerald-500/10', Icon: TrendingUp },
  SHORT: { ko: '숏',   cls: 'text-red-400',     bg: 'bg-red-500/10',     Icon: TrendingDown },
  WATCH: { ko: '관망', cls: 'text-muted-foreground', bg: 'bg-muted',     Icon: Eye },
};

export function IctWyckoffMonitor({ candles, currentPrice, live, lastUpdate }: Props) {
  const { ict, wyckoff } = useMemo(() => {
    if (!candles || candles.length < 30 || !currentPrice) {
      return { ict: null, wyckoff: null };
    }
    return {
      ict: analyzeICT(candles, currentPrice),
      wyckoff: analyzeWyckoff(candles, currentPrice),
    };
  }, [candles, currentPrice]);

  if (!ict || !wyckoff) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-center text-xs text-muted-foreground">
        ICT/와이코프 분석 중... (캔들 데이터 부족)
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">스마트머니 실시간 모니터</h3>
        </div>
        {live && (
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            실시간
            {lastUpdate && <span className="text-muted-foreground">· {new Date(lastUpdate).toLocaleTimeString('ko-KR')}</span>}
          </span>
        )}
      </div>

      <TheoryRow name="ICT (스마트머니)" sig={ict} priceRef={currentPrice} desc="Order Block · FVG · 유동성 스윕" />
      <TheoryRow name="와이코프" sig={wyckoff} priceRef={currentPrice} desc="축적/분배 · Spring/UTAD" />
    </div>
  );
}

function TheoryRow({ name, sig, desc, priceRef }: { name: string; sig: { signal: 'LONG' | 'SHORT' | 'WATCH'; confidence: number; reason: string; entry: number; sl: number; tp: number }; desc: string; priceRef: number }) {
  const meta = SIG_META[sig.signal];
  const Icon = meta.Icon;
  const fmt = (n: number) => isFinite(n) ? (priceRef < 1 ? n.toFixed(6) : priceRef < 100 ? n.toFixed(4) : n.toLocaleString('en-US', { maximumFractionDigits: 2 })) : '-';

  return (
    <div className={`rounded-lg border border-border ${meta.bg} p-2.5 space-y-1.5`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Icon className={`h-3.5 w-3.5 ${meta.cls}`} />
            {name}
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${meta.cls} ${meta.bg}`}>{meta.ko}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{desc}</div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-mono font-bold ${meta.cls}`}>{sig.confidence}%</div>
          <div className="text-[9px] text-muted-foreground">신뢰도</div>
        </div>
      </div>
      <p className="text-[11px] text-foreground">{sig.reason}</p>
      {sig.signal !== 'WATCH' && (
        <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-border/40">
          <Mini label="진입" value={fmt(sig.entry)} />
          <Mini label="익절" value={fmt(sig.tp)} accent="text-emerald-400" />
          <Mini label="손절" value={fmt(sig.sl)} accent="text-red-400" />
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
      <div className={`text-xs font-mono font-bold ${accent ?? 'text-foreground'}`}>{value}</div>
    </div>
  );
}
