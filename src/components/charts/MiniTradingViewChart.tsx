import { useEffect, useRef, memo } from 'react';

interface Props {
  tvSymbol: string;
  interval?: string; // '60' = 1H
  height?: number;
}

/** 경량 미니 차트 (TradingView mini widget) */
export const MiniTradingViewChart = memo(function MiniTradingViewChart({
  tvSymbol, interval = '60', height = 220,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval,
      timezone: 'Asia/Seoul',
      theme: 'dark',
      style: '1',
      locale: 'kr',
      toolbar_bg: 'transparent',
      enable_publishing: false,
      hide_top_toolbar: true,
      hide_legend: true,
      hide_side_toolbar: true,
      save_image: false,
      calendar: false,
      withdateranges: false,
      allow_symbol_change: false,
      details: false,
    });
    const c = document.createElement('div');
    c.className = 'tradingview-widget-container__widget';
    c.style.height = '100%';
    c.style.width = '100%';
    ref.current.appendChild(c);
    ref.current.appendChild(script);
    return () => { if (ref.current) ref.current.innerHTML = ''; };
  }, [tvSymbol, interval]);

  return (
    <div
      ref={ref}
      className="tradingview-widget-container w-full rounded-lg overflow-hidden border border-border"
      style={{ height: `${height}px` }}
    />
  );
});
