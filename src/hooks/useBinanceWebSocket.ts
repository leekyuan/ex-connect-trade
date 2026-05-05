import { useEffect, useRef, useState, useCallback } from "react";

interface TickerData {
  price: number;
  priceChange: number;
  priceChangePercent: number;
  high: number;
  low: number;
  volume: number;
}

export function useBinanceWebSocket(symbol: string = "btcusdt") {
  const [ticker, setTicker] = useState<TickerData | null>(null);
  const [priceDirection, setPriceDirection] = useState<"up" | "down" | "neutral">("neutral");
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const prevPriceRef = useRef<number>(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@ticker`);

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const currentPrice = parseFloat(data.c);

      if (prevPriceRef.current > 0) {
        setPriceDirection(
          currentPrice > prevPriceRef.current ? "up" :
          currentPrice < prevPriceRef.current ? "down" : "neutral"
        );
      }
      prevPriceRef.current = currentPrice;

      setTicker({
        price: currentPrice,
        priceChange: parseFloat(data.p),
        priceChangePercent: parseFloat(data.P),
        high: parseFloat(data.h),
        low: parseFloat(data.l),
        volume: parseFloat(data.v),
      });
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();

    wsRef.current = ws;
  }, [symbol]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { ticker, priceDirection, connected };
}
