import { Trophy } from 'lucide-react';

interface Props {
  /** 0..100 */
  accuracy: number;
  windowDays?: number;
  className?: string;
}

export function AccuracyBadge({ accuracy, windowDays = 30, className = '' }: Props) {
  const cls =
    accuracy >= 70 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      : accuracy >= 55 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      : 'text-muted-foreground border-border bg-muted';
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${cls} ${className}`} title="과거 동일 점수대 신호의 평균 적중률">
      <Trophy className="h-3 w-3" />
      <span>최근 {windowDays}일 적중률 {Math.round(accuracy)}%</span>
    </div>
  );
}
