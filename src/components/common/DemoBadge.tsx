import { FlaskConical } from "lucide-react";

/** Inline "DEMO ONLY" badge. */
export function DemoBadge({ label = "DEMO ONLY" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
      <FlaskConical className="h-3 w-3" /> {label}
    </span>
  );
}
