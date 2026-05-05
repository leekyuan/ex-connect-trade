import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, Activity, Target, Sliders, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { AdvancedAnalysisResult, TheoryAnalysis } from '@/hooks/useAdvancedAnalysis';
import { useTheoryWeights, THEORY_LABELS } from '@/hooks/useTheoryWeights';

interface Props {
  result: AdvancedAnalysisResult | null;
  symbol?: string;
}

const SIGNAL_STYLE = {
  LONG:    { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: TrendingUp,  label: 'LONG' },
  SHORT:   { bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-400',     icon: TrendingDown, label: 'SHORT' },
  NEUTRAL: { bg: 'bg-muted',          border: 'border-border',         text: 'text-muted-foreground', icon: Minus, label: '관망' },
};

function fmt(n: number | undefined | null) {
  if (n === undefined || n === null || !isFinite(n)) return '-';
  return n < 1 ? n.toFixed(6) : n < 100 ? n.toFixed(4) : n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function TheoryCard({ theory }: { theory: TheoryAnalysis }) {
  const [open, setOpen] = useState(false);
  const st = SIGNAL_STYLE[theory.signal];
  const Icon = st.icon;

  return (
    <div className={`rounded-lg border ${st.border} ${st.bg} overflow-hidden`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-3 text-left">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`h-4 w-4 shrink-0 ${st.text}`} />
          <span className="text-sm font-semibold text-foreground truncate">{theory.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${st.text} ${st.bg}`}>{st.label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-mono ${theory.score > 0 ? 'text-emerald-400' : theory.score < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
            {theory.score > 0 ? '+' : ''}{theory.score}
          </span>
          <span className="text-xs text-muted-foreground">{theory.confidence}%</span>
          {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/50">
          <p className="text-xs font-medium text-foreground pt-2">{theory.description}</p>
          <div className="space-y-1">
            {theory.details.map((d, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                <span>{d}</span>
              </div>
            ))}
          </div>
          {theory.signal !== 'NEUTRAL' && theory.entry && (
            <div className="grid grid-cols-3 gap-1 text-[10px] mt-1">
              <div className="bg-background/50 rounded p-1 text-center">
                <div className="text-muted-foreground">진입</div>
                <div className="font-mono text-foreground">{fmt(theory.entry)}</div>
              </div>
              <div className="bg-background/50 rounded p-1 text-center">
                <div className="text-red-400">SL</div>
                <div className="font-mono text-foreground">{fmt(theory.sl)}</div>
              </div>
              <div className="bg-background/50 rounded p-1 text-center">
                <div className="text-emerald-400">TP</div>
                <div className="font-mono text-foreground">{fmt(theory.tp)}</div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${theory.signal === 'LONG' ? 'bg-emerald-500' : theory.signal === 'SHORT' ? 'bg-red-500' : 'bg-gray-500'}`}
                style={{ width: `${theory.confidence}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">신뢰도</span>
          </div>
        </div>
      )}
    </div>
  );
}

function WeightsPanel() {
  const { weights, set, reset } = useTheoryWeights();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-2.5">
        <div className="flex items-center gap-1.5">
          <Sliders className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">이론별 가중치</span>
        </div>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
          {(Object.keys(THEORY_LABELS) as Array<keyof typeof THEORY_LABELS>).map(k => (
            <div key={k} className="flex items-center gap-2">
              <span className="text-[11px] text-foreground w-20 shrink-0">{THEORY_LABELS[k]}</span>
              <input
                type="range" min={0} max={3} step={0.1}
                value={weights[k]}
                onChange={e => set(k, Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-[10px] font-mono w-8 text-right text-muted-foreground">{weights[k].toFixed(1)}</span>
            </div>
          ))}
          <button
            onClick={reset}
            className="w-full flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground py-1"
          >
            <RotateCcw className="h-2.5 w-2.5" /> 균등(1.0)으로 초기화
          </button>
          <p className="text-[10px] text-muted-foreground opacity-70">
            가중치는 브라우저에 자동 저장됩니다. 0이면 해당 이론은 통합 신호에서 제외.
          </p>
        </div>
      )}
    </div>
  );
}

function IntegratedSignalCard({ result }: { result: AdvancedAnalysisResult }) {
  const ig = result.integrated;
  const st = SIGNAL_STYLE[ig.signal];
  const Icon = st.icon;
  // score bar: -100..100 mapped to 0..100% with 50% center
  const barPct = 50 + Math.max(-50, Math.min(50, ig.score / 2));

  return (
    <div className={`rounded-xl border-2 ${st.border} ${st.bg} p-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className={`h-5 w-5 ${st.text}`} />
          <span className="text-sm font-bold text-foreground">통합 추천</span>
        </div>
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${st.text}`} />
          <span className={`text-base font-bold ${st.text}`}>{st.label} {ig.confidence}%</span>
        </div>
      </div>

      {/* spectrum bar SHORT ↔ LONG */}
      <div>
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
          <div
            className={`absolute top-0 h-full ${ig.score >= 0 ? 'left-1/2 bg-emerald-500' : 'right-1/2 bg-red-500'}`}
            style={{ width: `${Math.abs(ig.score) / 2}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-3 bg-foreground rounded"
            style={{ left: `${barPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>← SHORT</span>
          <span className="font-mono">{ig.score > 0 ? '+' : ''}{ig.score}</span>
          <span>LONG →</span>
        </div>
      </div>

      {/* confirmations */}
      <div className="text-[11px] text-muted-foreground">
        컨펌 <span className="text-foreground font-semibold">{ig.confirmCount}</span>개 이론
        {ig.contributingTheories.length > 0 && (
          <span className="ml-1">· {ig.contributingTheories.join(', ')}</span>
        )}
      </div>

      {/* entry/sl/tp */}
      {ig.signal !== 'NEUTRAL' && ig.sl && ig.tp1 ? (
        <div className="grid grid-cols-4 gap-1 text-[10px] pt-1">
          <div className="bg-background/60 rounded p-1.5 text-center">
            <div className="text-muted-foreground">진입</div>
            <div className="font-mono text-foreground font-semibold">{fmt(ig.entry)}</div>
          </div>
          <div className="bg-background/60 rounded p-1.5 text-center">
            <div className="text-red-400">SL</div>
            <div className="font-mono text-foreground">{fmt(ig.sl)}</div>
          </div>
          <div className="bg-background/60 rounded p-1.5 text-center">
            <div className="text-emerald-400">TP1</div>
            <div className="font-mono text-foreground">{fmt(ig.tp1)}</div>
          </div>
          <div className="bg-background/60 rounded p-1.5 text-center">
            <div className="text-emerald-400">TP2</div>
            <div className="font-mono text-foreground">{fmt(ig.tp2)}</div>
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground bg-background/40 rounded px-2 py-1.5">
          {ig.signal === 'NEUTRAL'
            ? '컨펌 부족 또는 점수 약함 — 진입 보류'
            : 'SL/TP 산출 데이터 부족'}
        </div>
      )}

      {ig.signal !== 'NEUTRAL' && ig.riskReward > 0 && (
        <div className="text-[11px] text-primary font-semibold">
          R:R 1:{ig.riskReward.toFixed(2)}
        </div>
      )}
    </div>
  );
}

export function AdvancedAnalysisPanel({ result, symbol }: Props) {
  if (!result || result.theories.length === 0) {
    return (
      <div className="space-y-3">
        <WeightsPanel />
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          코인을 선택하면 6대 이론 분석을 볼 수 있습니다
        </div>
      </div>
    );
  }

  const ind = result.indicators;

  return (
    <div className="space-y-3">
      {/* Integrated banner FIRST */}
      <IntegratedSignalCard result={result} />

      {/* Weights panel */}
      <WeightsPanel />

      {/* Indicator summary */}
      <div className="rounded-lg border border-border bg-muted/30 p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">기술적 지표</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-[10px]">
          <div className="text-center">
            <div className="text-muted-foreground">RSI(14)</div>
            <div className={`font-mono font-bold ${ind.rsi !== null ? (ind.rsi > 70 ? 'text-red-400' : ind.rsi < 30 ? 'text-emerald-400' : 'text-foreground') : 'text-muted-foreground'}`}>
              {ind.rsi !== null ? ind.rsi.toFixed(1) : '-'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">MACD</div>
            <div className={`font-bold ${ind.macdSignal === 'bullish' ? 'text-emerald-400' : ind.macdSignal === 'bearish' ? 'text-red-400' : 'text-muted-foreground'}`}>
              {ind.macdSignal === 'bullish' ? '↑상승' : ind.macdSignal === 'bearish' ? '↓하락' : '중립'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">BB</div>
            <div className={`font-bold ${ind.bbPosition === 'lower' ? 'text-emerald-400' : ind.bbPosition === 'upper' ? 'text-red-400' : 'text-foreground'}`}>
              {ind.bbPosition === 'upper' ? '상단' : ind.bbPosition === 'lower' ? '하단' : '중간'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">Supertrend</div>
            <div className={`font-bold ${ind.supertrend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
              {ind.supertrend === 'up' ? '↑상승' : '↓하락'}
            </div>
          </div>
        </div>
      </div>

      {/* Theory tally */}
      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        <span>LONG {result.theories.filter(t => t.signal === 'LONG').length}개</span>
        <span>중립 {result.theories.filter(t => t.signal === 'NEUTRAL').length}개</span>
        <span>SHORT {result.theories.filter(t => t.signal === 'SHORT').length}개</span>
      </div>

      {/* Individual theories */}
      {result.theories.map(theory => (
        <TheoryCard key={theory.key} theory={theory} />
      ))}

      <p className="text-[10px] text-muted-foreground opacity-60 px-1">
        * 통합 신호: 이론별 가중치를 적용한 -100~+100 점수, 컨펌 ≥2개 이론일 때만 방향 신호 발생.
        펀더멘털: Funding · OI · L/S Ratio · Fear&Greed (Binance Futures + Alternative.me 무료 API).
      </p>
    </div>
  );
}
