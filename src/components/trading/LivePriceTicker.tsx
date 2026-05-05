import { useBinanceWebSocket } from "@/hooks/useBinanceWebSocket";
import { Wifi, WifiOff } from "lucide-react";

export function LivePriceTicker() {
  const { ticker, priceDirection, connected } = useBinanceWebSocket("btcusdt");

  const priceColorClass =
    priceDirection === "up" ? "text-success" :
    priceDirection === "down" ? "text-destructive" :
    "text-foreground";

  const flashClass =
    priceDirection === "up" ? "animate-flash-green" :
    priceDirection === "down" ? "animate-flash-red" : "";

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        {connected ? (
          <Wifi className="h-3 w-3 text-success" />
        ) : (
          <WifiOff className="h-3 w-3 text-destructive" />
        )}
        <span className="text-xs text-muted-foreground font-medium">BTC/USDT</span>
        <span className={`font-mono text-sm font-bold transition-colors duration-150 ${priceColorClass} ${flashClass}`}>
          ${ticker?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "---"}
        </span>
      </div>

      {ticker && (
        <div className="hidden md:flex items-center gap-3 text-[11px] font-mono">
          <span className={ticker.priceChangePercent >= 0 ? "text-success" : "text-destructive"}>
            {ticker.priceChangePercent >= 0 ? "+" : ""}{ticker.priceChangePercent.toFixed(2)}%
          </span>
          <span className="text-muted-foreground">
            H <span className="text-foreground">${ticker.high.toLocaleString()}</span>
          </span>
          <span className="text-muted-foreground">
            L <span className="text-foreground">${ticker.low.toLocaleString()}</span>
          </span>
          <span className="text-muted-foreground">
            Vol <span className="text-foreground">{(ticker.volume / 1000).toFixed(1)}K</span>
          </span>
        </div>
      )}
    </div>
  );
}
