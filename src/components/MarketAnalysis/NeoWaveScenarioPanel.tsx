/**
 * Neo-Wave 시나리오 패널 — 3가지 시나리오 + Neely 룰 검증
 */
import { Activity, Target, ShieldAlert, TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle } from 'lucide-react';
import type { NeoWaveResult, NeoWaveScenario } from '@/utils/theories/neely';

interface Props {
  result: NeoWaveResult | null;
  currentPrice: number;
  selectedId: NeoWaveScenario['id'];
  onSelect: (id: NeoWaveScenario['id']) => void;
  live?: boolean;
  lastUpdate?: number;
}

function fmt(n: number, p: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: p < 1 ? 6 : 2 });
}

const dirIcon = (d: NeoWaveScenario['direction']) =>
  d === 'LONG' ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
  : d === 'SHORT' ? <TrendingDown className="h-3.5 w-3.5 text-red-400" />
  : <Minus className="h-3.5 w-3.5 text-muted-foreground" />;

export function NeoWaveScenarioPanel({ result, currentPrice, selectedId, onSelect, live, lastUpdate }: Props) {
  if (!result) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Neo-Wave 분석 로딩 중...
      </div>
    );
  }

  const { structure, scenarios, signal, confidence, reason } = result;

  return (
    <div className="space-y-3">
      {/* ── 진행 단계 ── */}
      <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-bold text-purple-300">Glenn Neely · Neo-Wave</span>
          </div>
          <div className="flex items-center gap-2">
            {live && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            )}
            <span className="text-[10px] font-mono text-muted-foreground">
              신뢰도 {confidence}
            </span>
          </div>
        </div>
        <div className="text-base font-bold text-foreground">{structure.stage}</div>
        <div className="text-[11px] text-muted-foreground mt-1">{reason}</div>

        {/* 진행률 바 */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>임펄스 진행도</span>
            <span className="font-mono">{Math.round(structure.progress * 100)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 transition-all"
              style={{ width: `${structure.progress * 100}%` }}
            />
          </div>
        </div>

        {/* 룰 체크 */}
        <div className="grid grid-cols-2 gap-1 mt-3 text-[10px]">
          <RuleChip label="W3 ≥ W1·W5" ok={structure.rules.w3NotShortest} />
          <RuleChip label="W3 = 1.618×W1" ok={structure.rules.w3GoldenExt} />
          <RuleChip label="시간 균형 W2/W4" ok={structure.rules.timeBalance} />
          <RuleChip label="평행 채널 1·3 / 2·4" ok={structure.rules.channelValid} />
        </div>
      </div>

      {/* ── 3가지 시나리오 ── */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold mb-1">
          <span className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-primary" />
            앞으로 가능한 시나리오 3가지
          </span>
          <span className="text-[10px] text-muted-foreground font-normal">
            현재가 ${fmt(currentPrice, currentPrice)}
          </span>
        </div>

        {scenarios.map((sc) => {
          const sel = selectedId === sc.id;
          const distPct = ((sc.target - currentPrice) / currentPrice) * 100;
          const invPct = ((sc.invalidation - currentPrice) / currentPrice) * 100;
          // 유효성: LONG 시나리오는 가격 > invalidation, SHORT는 가격 < invalidation
          const valid =
            sc.direction === 'LONG' ? currentPrice > sc.invalidation
            : sc.direction === 'SHORT' ? currentPrice < sc.invalidation
            : true;
          return (
            <button
              key={sc.id}
              onClick={() => onSelect(sc.id)}
              className={`w-full text-left rounded-lg border-2 p-3 transition ${
                sel ? 'border-primary bg-primary/5 shadow' : 'border-border bg-muted/30 hover:bg-muted/50'
              } ${valid ? '' : 'opacity-60'}`}
              style={sel ? { borderColor: sc.color, boxShadow: `0 0 0 1px ${sc.color}33` } : {}}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: sc.color }}
                  />
                  <span className="text-sm font-bold">{sc.label}</span>
                  {dirIcon(sc.direction)}
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    valid ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
                  }`}>
                    {valid ? '유효' : '무효'}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold" style={{ color: sc.color }}>
                  {sc.probability}%
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mb-2">{sc.description}</div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <div className="rounded bg-background/60 px-2 py-1">
                  <div className="text-muted-foreground">🎯 목표</div>
                  <div className="font-mono font-bold text-foreground">
                    ${fmt(sc.target, sc.target)}
                    <span className={`ml-1 ${distPct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ({distPct > 0 ? '+' : ''}{distPct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <div className="rounded bg-background/60 px-2 py-1">
                  <div className="text-muted-foreground flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" /> 무효
                  </div>
                  <div className="font-mono font-bold text-foreground">
                    ${fmt(sc.invalidation, sc.invalidation)}
                    <span className={`ml-1 ${invPct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ({invPct > 0 ? '+' : ''}{invPct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {lastUpdate ? (
          <div className="text-[9px] text-muted-foreground text-right pt-1">
            마지막 갱신 {new Date(lastUpdate).toLocaleTimeString('ko-KR')}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RuleChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded ${
      ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-muted text-muted-foreground'
    }`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      <span>{label}</span>
    </div>
  );
}
