import { AlertOctagon, ShieldAlert, Info } from 'lucide-react';
import type { EligibilityResult } from '@/utils/tradeEligibility';
import { ELIGIBILITY_META } from '@/utils/tradeEligibility';

interface Props {
  result: EligibilityResult;
  title?: string;
  compact?: boolean;
}

/**
 * BLOCKED / WATCH_ONLY / PAPER_ONLY 사유를 EP/SL/TP보다 먼저 보여주기 위한 패널.
 * 사용자가 진입 가격에 먼저 시선이 가지 않도록 상단 배치용.
 */
export function BlockedReasonPanel({ result, title, compact }: Props) {
  const { state, reasons } = result;
  if (state === 'LIVE_ELIGIBLE' || state === 'NO_SIGNAL') return null;

  const meta = ELIGIBILITY_META[state];
  const Icon = state === 'BLOCKED' ? AlertOctagon : state === 'PAPER_ONLY' ? Info : ShieldAlert;

  const heading =
    title ??
    (state === 'BLOCKED' ? '실거래 차단됨'
      : state === 'PAPER_ONLY' ? 'Paper 검증 필요'
      : '관찰만 가능');

  return (
    <div className={`rounded border ${state === 'BLOCKED' ? 'border-red-500/40 bg-red-500/10' : state === 'PAPER_ONLY' ? 'border-sky-500/30 bg-sky-500/5' : 'border-amber-500/30 bg-amber-500/5'} p-3 space-y-2`}>
      <div className={`flex items-center gap-2 font-semibold text-sm ${meta.tone}`}>
        <Icon className="h-4 w-4" />
        <span>{heading}</span>
      </div>
      {!compact && (
        <>
          <div className="text-[11px] text-muted-foreground">사유</div>
          <ul className="space-y-0.5 text-[11px] font-mono text-foreground/90">
            {reasons.slice(0, 6).map((r, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-muted-foreground shrink-0">·</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground leading-relaxed pt-1 border-t border-border/40">
            {state === 'BLOCKED'
              ? '현재 이 전략은 실거래/페이퍼 진입 대상이 아닙니다. Paper Mode에서 추가 검증 후 사용하세요.'
              : state === 'PAPER_ONLY'
                ? '백테스트 최소 기준은 통과했지만, 실거래 전 Paper Mode 검증이 필요합니다.'
                : '조건 일부만 충족되어 관찰용으로만 사용하세요. 실거래 진입은 권장되지 않습니다.'}
          </p>
        </>
      )}
    </div>
  );
}
