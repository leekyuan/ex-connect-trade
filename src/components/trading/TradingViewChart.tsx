import { useEffect, useRef } from "react";

interface TradingViewChartProps {
  symbol?: string;
}

export function TradingViewChart({ symbol = "BINANCE:BTCUSDT" }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Ensure symbol is always BINANCE:{X}USDT format; fallback to CRYPTOCAP if malformed
  const safeSymbol = /^BINANCE:[A-Z0-9]+USDT$/.test(symbol)
    ? symbol
    : symbol.includes(':') ? symbol : `CRYPTOCAP:${symbol}`;

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: safeSymbol,
      interval: "15",
      timezone: "Asia/Seoul",
      theme: "dark",
      style: "1",
      locale: "kr",
      backgroundColor: "rgba(30, 41, 59, 1)",
      gridColor: "rgba(55, 65, 81, 0.3)",
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
      hide_volume: false,
      studies: ["RSI@tv-basicstudies", "MASimple@tv-basicstudies"],
    });

    containerRef.current.appendChild(script);
  }, [safeSymbol]);

  return (
    <div className="w-full h-full min-h-[400px] rounded-lg overflow-hidden border border-border">
      <div
        ref={containerRef}
        className="tradingview-widget-container"
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}
