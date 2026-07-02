import { Badge } from '@/components/ui/badge';
import { SAFETY_META, type SafetyState } from '@/hooks/useGlobalSafety';

export function SafetyStatusBadge({ state, className = '' }: { state: SafetyState; className?: string }) {
  const m = SAFETY_META[state];
  return (
    <Badge
      variant="outline"
      className={`${m.tone} ${m.bg} border-current font-bold tracking-wider text-[11px] ${className}`}
    >
      {m.short}
    </Badge>
  );
}
