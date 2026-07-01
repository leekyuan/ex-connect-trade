import { AlertOctagon, CheckCircle2, XCircle, Info, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { StrategyVerdict } from '@/utils/strategyVerdict';
import { VERDICT_META } from '@/utils/strategyVerdict';
import { EligibilityBadge } from '@/components/common/EligibilityBadge';

interface Props {
  verdict: StrategyVerdict;
  symbol?: string;
}

export function StrategyVerdictCard({ verdict, symbol }: Props) {
  const meta = VERDICT_META[verdict.state];
  const Icon =
    verdict.state === 'PASS' ? CheckCircle2
    : verdict.state === 'BLOCKED' ? AlertOctagon
    : verdict.state === 'FAIL' ? XCircle
    : verdict.state === 'NEEDS_MORE_DATA' ? Info
    : ShieldAlert;

  return (
    <div className={`rounded-lg border ${meta.ring} ${meta.bg} p-4 space-y-3`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className={`flex items-center gap-2 font-bold ${meta.tone}`}>
          <Icon className="h-5 w-5" />
          <span className="text-base">
            {symbol ? `${symbol} · ` : ''}{verdict.headline}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${meta.tone} border-current font-bold tracking-wider text-[11px]`}>
            {meta.short}
          </Badge>
          <EligibilityBadge state={verdict.eligibility.state} />
        </div>
      </div>

      {verdict.reasons.length > 0 && (
        <div className="border-t border-border/40 pt-2">
          <div className="text-[11px] text-muted-foreground mb-1">사유</div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] font-mono">
            {verdict.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-red-400 shrink-0">·</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground leading-relaxed border-t border-border/40 pt-2">
        {verdict.state === 'PASS'
          ? '모든 검증 기준 통과. Paper Mode 100거래 이상 안정 시 실거래 고려 가능.'
          : verdict.state === 'BLOCKED'
            ? '현재 이 전략은 실거래/페이퍼 진입 대상이 아닙니다. 파라미터/시장 변경 후 재검증하세요.'
            : verdict.state === 'NEEDS_MORE_DATA'
              ? '거래 표본이 100건 미만 — 통계적 유의성 부족. Sharpe/승률이 높아도 신뢰도 낮음.'
              : '백테스트 참고 가능 / 실거래 금지 / Paper Mode 검증 필요.'}
      </div>
    </div>
  );
}
