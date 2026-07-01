import { Badge } from '@/components/ui/badge';
import { ELIGIBILITY_META, type EligibilityState } from '@/utils/tradeEligibility';

interface Props {
  state: EligibilityState;
  className?: string;
}

export function EligibilityBadge({ state, className = '' }: Props) {
  const m = ELIGIBILITY_META[state];
  return (
    <Badge
      variant="outline"
      className={`${m.tone} ${m.bg} border-current font-bold tracking-wider text-[11px] ${className}`}
    >
      {m.short}
    </Badge>
  );
}
