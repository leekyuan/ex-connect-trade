import { Card } from '@/components/ui/card';
import { ShieldCheck, ShieldAlert, AlertOctagon, Info } from 'lucide-react';
import { SAFETY_META, type GlobalSafety } from '@/hooks/useGlobalSafety';

const ICONS = {
  BLOCKED: AlertOctagon,
  WATCH: ShieldAlert,
  PAPER_READY: Info,
  LIVE_READY: ShieldCheck,
} as const;

interface Props {
  safety: GlobalSafety;
  extraReasons?: string[]; // 전략 검증 실패 사유 등
  compact?: boolean;
}

export function SafetyStatusCard({ safety, extraReasons = [], compact }: Props) {
  const meta = SAFETY_META[safety.state];
  const Icon = ICONS[safety.state];
  const allReasons = [
    ...safety.reasons.map(r => r.label),
    ...extraReasons,
  ];

  return (
    <Card className={`p-3 border ${meta.ring} ${meta.bg}`}>
      <div className={`flex items-center gap-2 font-bold ${meta.tone}`}>
        <Icon className="h-4 w-4" />
        <span className="text-sm">Current Safety Status</span>
        <span className={`ml-auto text-[11px] font-mono px-2 py-0.5 rounded border ${meta.tone} border-current`}>
          {meta.short}
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">{meta.label}</div>

      {!compact && allReasons.length > 0 && (
        <ul className="mt-2 pt-2 border-t border-border/40 space-y-0.5 text-[11px] font-mono">
          {allReasons.slice(0, 6).map((r, i) => (
            <li key={i} className="flex items-start gap-1.5 text-foreground/85">
              <span className="text-muted-foreground shrink-0">·</span><span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      {safety.state === 'BLOCKED' && (
        <div className="mt-2 pt-2 border-t border-border/40 text-[10px] text-red-300/90">
          모든 실행 버튼이 비활성화됩니다. 전략을 개선하거나 Paper Mode에서 재검증하세요.
        </div>
      )}
    </Card>
  );
}
