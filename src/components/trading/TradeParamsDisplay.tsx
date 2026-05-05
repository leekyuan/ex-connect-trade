import type { TradeParams } from "@/types/trading";

interface TradeParamsDisplayProps {
  params: TradeParams;
}

export function TradeParamsDisplay({ params }: TradeParamsDisplayProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">매매 파라미터</label>
      <div className="bg-input rounded-md p-3 space-y-2 text-sm">
        <Row label="심볼" value={params.symbol} />
        <Row label="진입가 (Entry)" value={`$${params.entry.toLocaleString()}`} />
        <Row label="TP1" value={`$${params.tp1.toLocaleString()}`} variant="success" />
        <Row label="TP2" value={`$${params.tp2.toLocaleString()}`} variant="success" />
        <Row label="손절가 (SL)" value={`$${params.sl.toLocaleString()}`} variant="destructive" />
        <Row label="레버리지" value={`${params.leverage}x`} />
        <Row label="포지션 크기" value={`$${params.positionSize.toLocaleString()}`} />
      </div>
    </div>
  );
}

function Row({ label, value, variant }: { label: string; value: string; variant?: "success" | "destructive" }) {
  const colorClass = variant === "success"
    ? "text-success"
    : variant === "destructive"
    ? "text-destructive"
    : "text-foreground";

  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium ${colorClass}`}>{value}</span>
    </div>
  );
}
