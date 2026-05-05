import { useEffect, useRef, memo } from 'react';

interface Props {
  tvSymbol: string;
  interval?: string;
  height?: number;
}

/** 사이드 패널 등에 들어가는 미니 차트 (TradingView mini-symbol-overview) */
export const MiniSymbolChart = memo(function MiniSymbolChart({
  tvSymbol, interval = '60', height = 220,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: tvSymbol,
      width: '100%',
      height,
      locale: 'kr',
      dateRange: interval === '60' ? '1D' : '5D',
      colorTheme: 'dark',
      isTransparent: true,
      autosize: false,
      largeChartUrl: '',
      noTimeScale: false,
    });
    ref.current.appendChild(script);
    return () => { if (ref.current) ref.current.innerHTML = ''; };
  }, [tvSymbol, interval, height]);

  return <div ref={ref} className="w-full rounded-lg overflow-hidden" style={{ height }} />;
});
