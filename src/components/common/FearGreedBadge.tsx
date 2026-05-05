import { useFearGreed, classifyColor } from '@/hooks/useFearGreed';
import { Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function FearGreedBadge() {
  const { data, loading } = useFearGreed();

  if (loading) return <Skeleton className="h-7 w-32 rounded-full" />;
  if (!data) return null;

  const c = classifyColor(data.value);
  return (
    <div
      className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1"
      title={`비트코인 공포·탐욕 지수 (alternative.me · ${new Date(data.ts).toLocaleDateString('ko-KR')})`}
    >
      <Activity className={`h-3.5 w-3.5 ${c.cls}`} />
      <span className="text-[11px] text-muted-foreground hidden sm:inline">F&G</span>
      <span className={`text-sm font-bold ${c.cls}`}>{data.value}</span>
      <span className={`text-[11px] ${c.cls} hidden md:inline`}>{c.label}</span>
    </div>
  );
}
