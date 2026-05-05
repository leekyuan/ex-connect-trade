import { Slider } from "@/components/ui/slider";

interface TpSplitControlProps {
  value: number;
  onChange: (value: number) => void;
}

export function TpSplitControl({ value, onChange }: TpSplitControlProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-muted-foreground">분할 익절 비율</label>
      <div className="bg-input rounded-md p-3 space-y-3">
        <Slider
          value={[value]}
          onValueChange={(v) => onChange(v[0])}
          min={10}
          max={90}
          step={5}
          className="w-full"
        />
        <div className="flex justify-between text-sm font-mono">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-success" />
            <span className="text-muted-foreground">TP1:</span>
            <span className="text-foreground font-medium">{value}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-success/60" />
            <span className="text-muted-foreground">TP2:</span>
            <span className="text-foreground font-medium">{100 - value}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
