import { Info } from "lucide-react";

interface Props {
  title: string;
  desc: string;
  tip?: string;
}

/** Top-of-page label so reviewers instantly know the page's purpose. */
export function FeatureLabel({ title, desc, tip }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 mb-4 flex items-start gap-3">
      <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-bold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
        {tip && <div className="text-[11px] text-amber-400 mt-1">💡 {tip}</div>}
      </div>
    </div>
  );
}
