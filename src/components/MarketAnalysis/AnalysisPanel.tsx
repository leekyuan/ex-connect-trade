import { TrendingUp, TrendingDown, Target, Shield, AlertTriangle, ChevronRight, BarChart2 } from 'lucide-react';
import type { CoinAnalysis, TradingMode } from '@/hooks/useMarketAnalysis';
import { MODE_CONFIG } from '@/hooks/useMarketAnalysis';

interface Props {
  analysis: CoinAnalysis | null;
  mode: TradingMode;
}

function fmt(n: number | null | undefined, d = 2) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function dec(price: number) { return price < 1 ? 6 : price < 100 ? 4 : 2; }

const SIGNAL_COLORS = {
  LONG: { bg: 'from-emerald-500/20', border: 'border-emerald-500/40', badge: 'bg-emerald-500', text: 'text-emerald-400' },
  SHORT: { bg: 'from-red-500/20', border: 'border-red-500/40', badge: 'bg-red-500', text: 'text-red-400' },
  WATCH: { bg: 'from-gray-500/20', border: 'border-gray-500/40', badge: 'bg-gray-500', text: 'text-gray-400' },
};

export function AnalysisPanel({ analysis, mode }: Props) {
  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        코인을 선택하면 분석 결과를 볼 수 있습니다
      </div>
    );
  }

  const { coin, signal, confidence, longEntry, shortEntry, stopLoss, tp1, tp2, riskReward, reasoning, strategy, indicators } = analysis;
  const sc = SIGNAL_COLORS[signal];
  const cfg = MODE_CONFIG[mode];
  const signalLabel = signal === 'LONG' ? '🟢 롱 진입 적정' : signal === 'SHORT' ? '🔴 숏 진입 적정' : '⚪ 관망';

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      {/* Signal banner */}
      <div className={`rounded-xl p-4 bg-gradient-to-br ${sc.bg} to-transparent border ${sc.border}`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-foreground">{coin.symbol}</span>
              <span className="text-sm text-muted-foreground">{coin.name}</span>
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">#{coin.cmc_rank}</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">
              ${fmt(coin.price, dec(coin.price))}
            </p>
          </div>
          <div className="text-right">
            <div className={`${sc.badge} text-white text-sm font-bold px-3 py-1.5 rounded-lg`}>{signalLabel}</div>
            <div className="flex items-center gap-1 mt-2 justify-end">
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${sc.badge}`} style={{ width: `${confidence}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">신뢰도 {confidence}%</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '1시간', val: coin.percent_change_1h },
            { label: '24시간', val: coin.percent_change_24h },
            { label: '7일', val: coin.percent_change_7d },
          ].map(item => (
            <div key={item.label} className="bg-background/50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
              <p className={`text-sm font-bold ${item.val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {item.val >= 0 ? '+' : ''}{item.val.toFixed(2)}%
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Entry / SL / TP */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          {cfg.label} 모드 — 진입 전략
        </h3>
        <div className="space-y-2">
          {longEntry !== null && (
            <Row icon={<TrendingUp className="h-4 w-4 text-emerald-400" />} label="롱 진입가" value={longEntry} recommended={signal === 'LONG'} color="emerald" />
          )}
          {shortEntry !== null && (
            <Row icon={<TrendingDown className="h-4 w-4 text-red-400" />} label="숏 진입가" value={shortEntry} recommended={signal === 'SHORT'} color="red" />
          )}
          <div className="grid grid-cols-2 gap-2">
            <PriceBox icon={<Shield className="h-3 w-3 text-red-400" />} label="손절가 (SL)" value={stopLoss} color="red" />
            <PriceBox icon={<Target className="h-3 w-3 text-emerald-400" />} label="TP1 (1차 익절)" value={tp1} color="emerald" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <PriceBox icon={<Target className="h-3 w-3 text-emerald-400" />} label="TP2 (최종 목표)" value={tp2} color="emerald" />
            <div className="p-2.5 bg-muted/50 rounded-lg flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">리스크/리워드</span>
              <span className="text-sm font-mono font-semibold text-foreground">1 : {riskReward.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reasoning */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          분석 근거
        </h3>
        <div className="space-y-2">
          {reasoning.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
              <span>{r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Indicators */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <h3 className="text-xs font-semibold text-muted-foreground mb-2">지표 요약</h3>
        <div className="space-y-2">
          {[
            { label: '추세', val: indicators.trend },
            { label: '모멘텀', val: indicators.momentum },
            { label: '거래량', val: indicators.volume },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="text-foreground font-medium">{item.val}</span>
            </div>
          ))}
          <div className="pt-1">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">추세 강도</span>
              <span className="text-foreground font-mono">{indicators.strength}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${indicators.strength}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Strategy */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-start gap-3">
          <BarChart2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-1">{cfg.label} 전략 제안</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">{strategy}</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 opacity-60">
          * 투자 판단의 참고 자료입니다. 손실에 대한 책임은 본인에게 있습니다.
        </p>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function Row({ icon, label, value, recommended, color }: { icon: React.ReactNode; label: string; value: number; recommended: boolean; color: 'emerald' | 'red' }) {
  const bg = color === 'emerald' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20';
  const txt = color === 'emerald' ? 'text-emerald-400' : 'text-red-400';
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg border ${bg}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-muted-foreground">
          {label}
          {recommended && <span className={`${txt} ml-1 text-[10px]`}>← 권장</span>}
        </span>
      </div>
      <span className={`text-sm font-mono font-semibold ${txt}`}>${fmt(value, dec(value))}</span>
    </div>
  );
}

function PriceBox({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: 'emerald' | 'red' }) {
  const txt = color === 'emerald' ? 'text-emerald-400' : 'text-red-400';
  return (
    <div className="p-2.5 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <span className={`text-sm font-mono font-semibold ${txt}`}>${fmt(value, dec(value))}</span>
    </div>
  );
}
