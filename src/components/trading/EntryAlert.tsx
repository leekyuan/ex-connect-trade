import { useBinanceWebSocket } from "@/hooks/useBinanceWebSocket";
import type { TradeParams } from "@/types/trading";
import { AlertTriangle, Target } from "lucide-react";

interface EntryAlertProps {
  entryPrice: number;
}

export function EntryAlert({ entryPrice }: EntryAlertProps) {
  const { ticker } = useBinanceWebSocket("btcusdt");

  if (!ticker) return null;

  const diff = Math.abs(ticker.price - entryPrice);
  const diffPercent = (diff / entryPrice) * 100;
  const isNearEntry = diffPercent < 0.5;
  const isAtEntry = diffPercent < 0.1;

  if (!isNearEntry) return null;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
        isAtEntry
          ? "bg-success/10 text-success border border-success/30 animate-pulse"
          : "bg-warning/10 text-warning border border-warning/30"
      }`}
    >
      {isAtEntry ? (
        <>
          <Target className="h-4 w-4" />
          진입 가격에 도달했습니다! (${ticker.price.toLocaleString()})
        </>
      ) : (
        <>
          <AlertTriangle className="h-4 w-4" />
          진입 가격에 근접 중 ({diffPercent.toFixed(2)}% 차이)
        </>
      )}
    </div>
  );
}
