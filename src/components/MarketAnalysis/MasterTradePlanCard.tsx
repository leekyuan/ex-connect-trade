import { Target, TrendingUp, TrendingDown, Minus, Shield, AlertTriangle } from 'lucide-react';
import type { MasterPlan } from '@/utils/masterPlan';

interface Props {
  plan: MasterPlan | null;
  symbol: string;
  currentPrice: number;
}

const SIDE_META = {
  LONG:  { ko: '롱 (매수)',  cls: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', Icon: TrendingUp },
  SHORT: { ko: '숏 (매도)',  cls: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/40',     Icon: TrendingDown },
  WAIT:  { ko: '관망',       cls: 'text-muted-foreground', bg: 'bg-muted',     border: 'border-border',         Icon: Minus },
};

function fmtPrice(n: number, ref: number): string {
  if (!isFinite(n)) return '-';
  return ref < 1 ? n.toFixed(6) : ref < 100 ? n.toFixed(4) : n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function pctFromPrice(target: number, current: number): string {
  if (!isFinite(target) || !current) return '';
  const p = ((target - current) / current) * 100;
  return `${p >= 0 ? '+' : ''}${p.toFixed(2)}%`;
}

export function MasterTradePlanCard({ plan, symbol, currentPrice }: Props) {
  if (!plan) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
        통합 매매 플랜 계산 중...
      </div>
    );
  }

  const meta = SIDE_META[plan.side];
  const Icon = meta.Icon;

  return (
    <div className={`rounded-xl border-2 ${meta.border} ${meta.bg} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">최종 매매 플랜</h3>
          <span className="text-[10px] text-muted-foreground">{symbol}/USDT</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md ${meta.bg} border ${meta.border}`}>
          <Icon className={`h-3.5 w-3.5 ${meta.cls}`} />
          <span className={`text-xs font-bold ${meta.cls}`}>{meta.ko}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{plan.confidence}%</span>
        </div>
      </div>

      {plan.side === 'WAIT' ? (
        <div className="text-center py-4 text-sm text-muted-foreground">
          현재 진입 권장 신호 없음 — 추세 명확화 대기
        </div>
      ) : (
        <>
          {/* Entry / TP / SL grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* 진입 */}
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-2.5 space-y-1.5">
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">진입 (Entry)</div>
              <Row label="1차 진입" value={plan.entry1} sub={`${plan.positionPlan.entry1Pct}% 비중`} refPrice={currentPrice} pct={pctFromPrice(plan.entry1, currentPrice)} />
              <Row label="2차 진입" value={plan.entry2} sub={`${plan.positionPlan.entry2Pct}% 비중`} refPrice={currentPrice} pct={pctFromPrice(plan.entry2, currentPrice)} />
            </div>

            {/* 익절 */}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 space-y-1.5">
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                익절 (Take Profit) <span className="text-muted-foreground font-normal normal-case">R:R {plan.rrTp1}/{plan.rrTp2}</span>
              </div>
              <Row label="1차 익절" value={plan.tp1} sub={`${plan.positionPlan.tp1ClosePct}% 청산`} refPrice={currentPrice} pct={pctFromPrice(plan.tp1, currentPrice)} accent="text-emerald-400" />
              <Row label="2차 익절" value={plan.tp2} sub={`${plan.positionPlan.tp2ClosePct}% 청산`} refPrice={currentPrice} pct={pctFromPrice(plan.tp2, currentPrice)} accent="text-emerald-400" />
            </div>

            {/* 손절 */}
            <div className="col-span-2 rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 space-y-1.5">
              <div className="text-[10px] font-bold text-red-400 uppercase tracking-wide flex items-center gap-1">
                <Shield className="h-3 w-3" /> 손절 (Stop Loss) — 단계적
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Row label="1차 손절" value={plan.sl1} sub={`${plan.positionPlan.sl1ClosePct}% 컷 · 시나리오 재평가`} refPrice={currentPrice} pct={pctFromPrice(plan.sl1, currentPrice)} accent="text-red-400" />
                <Row label="2차 손절" value={plan.sl2} sub={`${plan.positionPlan.sl2ClosePct}% 전량 청산`} refPrice={currentPrice} pct={pctFromPrice(plan.sl2, currentPrice)} accent="text-red-400" />
              </div>
            </div>
          </div>

          {/* notes */}
          <ul className="space-y-1 pt-1 border-t border-border/50">
            {plan.notes.map((n, i) => (
              <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-primary/70" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Row({ label, value, sub, ref, pct, accent }: { label: string; value: number; sub: string; ref: number; pct?: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="text-[9px] text-muted-foreground/70">{sub}</div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-mono font-bold ${accent ?? 'text-foreground'}`}>{fmtPrice(value, ref)}</div>
        {pct && <div className="text-[9px] font-mono text-muted-foreground">{pct}</div>}
      </div>
    </div>
  );
}
