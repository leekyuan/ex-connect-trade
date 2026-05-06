/**
 * SmartTradingViewChart.tsx
 * Binance 미상장 코인을 OKX/Bybit/MEXC로 자동 폴백하는 TradingView 위젯
 */
import { useEffect, useRef, useState, useCallback } from "react";

type ExchangeId = 'BINANCE' | 'OKX' | 'BYBIT' | 'MEXC' | 'BITGET';

const EXCHANGE_PRIORITY: ExchangeId[] = ['BINANCE', 'OKX', 'BYBIT', 'MEXC', 'BITGET'];

const BINANCE_NOT_LISTED = new Set([
  'HYPE', 'JU', 'LEO', 'WETH', 'OPG', 'CC', 'PRL', 'QUQ',
  'DOGS', 'TON', 'PENGU', 'MEGA', 'TRUMP', 'SC', 'TAO', 'XMR',
]);

const OKX_LISTED = new Set([
  'HYPE', 'TON', 'PENGU', 'DOGS', 'MEGA', 'TRUMP', 'SC', 'TAO', 'XMR',
  'JU', 'LEO', 'CC', 'QUQ', 'M', 'WETH', 'BTC', 'ETH', 'SOL', 'BNB',
  'XRP', 'DOGE', 'ADA', 'LINK', 'AVAX', 'LTC', 'BCH', 'TRX', 'ZEC',
  'SUI', 'SHIB', 'UNI', 'DOT', 'PEPE', 'XLM', 'HBAR', 'AAVE',
]);

const BYBIT_LISTED = new Set([
  'TON', 'PENGU', 'DOGS', 'MEGA', 'TRUMP', 'SC', 'TAO', 'XMR', 'HYPE',
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA',
]);

function loadUserPriority(): ExchangeId[] | undefined {
  try {
    const raw = localStorage.getItem('exchange_priority');
    if (!raw) return undefined;
    const arr = JSON.parse(raw) as string[];
    return arr.map(x => x.toUpperCase() as ExchangeId).filter(x => EXCHANGE_PRIORITY.includes(x));
  } catch { return undefined; }
}

function resolveSymbolForTV(
  baseSymbol: string,
  isFutures = true,
  userPriority?: ExchangeId[]
): { tvSymbol: string; exchange: ExchangeId; fallback: boolean } {
  const upper = baseSymbol.toUpperCase();
  const priority = userPriority || loadUserPriority() || EXCHANGE_PRIORITY;

  for (const exchange of priority) {
    if (exchange === 'BINANCE' && !BINANCE_NOT_LISTED.has(upper)) {
      const sym = isFutures ? `BINANCE:${upper}USDTPERP` : `BINANCE:${upper}USDT`;
      return { tvSymbol: sym, exchange: 'BINANCE', fallback: false };
    }
    if (exchange === 'OKX' && (OKX_LISTED.has(upper) || BINANCE_NOT_LISTED.has(upper))) {
      const sym = isFutures ? `OKX:${upper}USDT.P` : `OKX:${upper}USDT`;
      return { tvSymbol: sym, exchange: 'OKX', fallback: BINANCE_NOT_LISTED.has(upper) };
    }
    if (exchange === 'BYBIT' && BYBIT_LISTED.has(upper)) {
      const sym = isFutures ? `BYBIT:${upper}USDT.P` : `BYBIT:${upper}USDT`;
      return { tvSymbol: sym, exchange: 'BYBIT', fallback: BINANCE_NOT_LISTED.has(upper) };
    }
    if (exchange === 'MEXC') {
      return { tvSymbol: `MEXC:${upper}USDT`, exchange: 'MEXC', fallback: true };
    }
  }
  return {
    tvSymbol: isFutures ? `OKX:${upper}USDT.P` : `OKX:${upper}USDT`,
    exchange: 'OKX',
    fallback: true,
  };
}

const EXCHANGE_COLORS: Record<ExchangeId, { bg: string; text: string; label: string }> = {
  BINANCE: { bg: 'rgba(240,185,11,0.15)', text: '#F0B90B', label: 'Binance' },
  OKX:     { bg: 'rgba(255,255,255,0.1)', text: '#FFFFFF', label: 'OKX' },
  BYBIT:   { bg: 'rgba(247,166,0,0.15)', text: '#F7A600', label: 'Bybit' },
  MEXC:    { bg: 'rgba(21,101,192,0.15)', text: '#42A5F5', label: 'MEXC' },
  BITGET:  { bg: 'rgba(0,96,100,0.15)', text: '#26C6DA', label: 'Bitget' },
};

interface SmartTradingViewChartProps {
  baseSymbol: string;
  interval?: string;
  isFutures?: boolean;
  height?: number;
  theme?: 'light' | 'dark';
  className?: string;
  onExchangeResolved?: (exchange: ExchangeId, fallback: boolean) => void;
}

export default function SmartTradingViewChart({
  baseSymbol,
  interval = '240',
  isFutures = true,
  height = 560,
  theme = 'dark',
  className,
  onExchangeResolved,
}: SmartTradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [resolution, setResolution] = useState(() => resolveSymbolForTV(baseSymbol, isFutures));

  const initWidget = useCallback((tvSymbol: string) => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = '100%';
    inner.style.width = '100%';
    containerRef.current.appendChild(inner);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval,
      timezone: 'Asia/Seoul',
      theme,
      style: '1',
      locale: 'kr',
      enable_publishing: false,
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      details: true,
      hotlist: true,
      calendar: false,
      studies: ['STD;Volume'],
      support_host: 'https://www.tradingview.com',
    });
    containerRef.current.appendChild(script);
  }, [interval, theme]);

  useEffect(() => {
    const resolved = resolveSymbolForTV(baseSymbol, isFutures);
    setResolution(resolved);
    onExchangeResolved?.(resolved.exchange, resolved.fallback);
    initWidget(resolved.tvSymbol);
  }, [baseSymbol, isFutures, initWidget, onExchangeResolved]);

  const exchInfo = EXCHANGE_COLORS[resolution.exchange];

  return (
    <div style={{ position: 'relative', width: '100%' }} className={className}>
      {resolution.fallback && (
        <div style={{
          position: 'absolute', top: '8px', left: '8px', zIndex: 10,
          display: 'flex', alignItems: 'center', gap: '6px',
          background: exchInfo.bg,
          border: `1px solid ${exchInfo.text}55`,
          borderRadius: '6px',
          padding: '4px 10px',
          fontSize: '11px',
          fontWeight: 500,
          color: exchInfo.text,
          pointerEvents: 'none',
          backdropFilter: 'blur(4px)',
        }}>
          <span>{exchInfo.label} 차트</span>
          <span style={{ opacity: 0.7 }}>· Binance 미상장 → 자동 폴백</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="tradingview-widget-container rounded-lg overflow-hidden border border-border"
        style={{ height: `${height}px`, width: '100%' }}
      />
    </div>
  );
}
