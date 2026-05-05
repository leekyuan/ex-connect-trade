import { Sliders, RotateCcw, Info } from 'lucide-react';
import { useTheoryWeights, THEORY_LABELS } from '@/hooks/useTheoryWeights';

const DESCRIPTIONS: Record<string, string> = {
  elliott: '5파 임펄스 / ABC 조정 패턴 감지',
  dow: '고점·저점 구조 (HH/HL/LH/LL) 추세 판단',
  wyckoff: 'Accumulation/Distribution + Spring/UTAD',
  gann: '갠 1x1 앵글 + 갠 스퀘어 지지/저항',
  fibonacci: '23.6/38.2/50/61.8/78.6% 자동 산출',
  ict: 'Order Block · FVG · 유동성 스윕 (스마트머니)',
  fundamental: 'Funding · OI · L/S Ratio · F&G Index',
};

export function TheoryWeightsSettings() {
  const { weights, set, reset } = useTheoryWeights();

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold">6대 이론 가중치 (기본값)</h2>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" /> 균등(1.0)
        </button>
      </div>
      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        통합 신호 점수(-100~+100) 계산 시 적용됩니다. 0이면 해당 이론은 제외. 값은 브라우저에 자동 저장.
      </p>

      <div className="space-y-3">
        {(Object.keys(THEORY_LABELS) as Array<keyof typeof THEORY_LABELS>).map(k => (
          <div key={k} className="space-y-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground">{THEORY_LABELS[k]}</span>
                <span className="ml-2 text-[11px] text-muted-foreground">{DESCRIPTIONS[k]}</span>
              </div>
              <span className="text-sm font-mono font-bold text-primary w-12 text-right">
                {weights[k].toFixed(1)}
              </span>
            </div>
            <input
              type="range" min={0} max={3} step={0.1}
              value={weights[k]}
              onChange={e => set(k, Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
