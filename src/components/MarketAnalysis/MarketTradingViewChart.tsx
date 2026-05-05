import { useEffect, useRef, memo } from 'react';

interface Props {
  tvSymbol: string;
  /** TradingView interval — '5','15','30','60','240','720','D','3D','W' 등 */
  tvInterval: string;
  height?: number;
}

/**
 * 풀-기능 TradingView Advanced Chart 위젯.
 * - 사용자가 자유롭게 지표 추가/삭제 가능 (상단 툴바 + 좌측 그리기 툴바 노출)
 * - 심볼 변경, 타임프레임 변경, 날짜 범위, 디테일 패널 모두 활성화
 * - 사전 적용 지표는 최소화하여 사용자 선택권을 최대 보장
 */
export const MarketTradingViewChart = memo(function MarketTradingViewChart({
  tvSymbol, tvInterval, height = 560,
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
      interval: tvInterval,
      timezone: 'Asia/Seoul',
      theme: 'dark',
      style: '1',
      locale: 'kr',

      // ── 사용자 친화 옵션 (지표 자유 추가 가능) ──
      hide_top_toolbar: false,        // 상단 메뉴 (지표/비교/설정)
      hide_legend: false,
      hide_side_toolbar: false,       // 좌측 그리기 도구
      allow_symbol_change: true,
      withdateranges: true,           // 1D/1M/3M/1Y/All 빠른 선택
      details: true,                  // 우측 디테일 패널
      hotlist: true,
      calendar: false,
      save_image: true,
      backgroundColor: 'rgba(15, 23, 42, 1)',
      gridColor: 'rgba(55, 65, 81, 0.25)',

      // 기본 적용 지표는 최소 — 사용자가 추가하도록
      studies: ['STD;Volume'],

      support_host: 'https://www.tradingview.com',
    });

    const container = document.createElement('div');
    container.className = 'tradingview-widget-container__widget';
    container.style.height = '100%';
    container.style.width = '100%';
    ref.current.appendChild(container);
    ref.current.appendChild(script);

    return () => {
      if (ref.current) ref.current.innerHTML = '';
    };
  }, [tvSymbol, tvInterval]);

  return (
    <div
      ref={ref}
      className="tradingview-widget-container w-full rounded-lg overflow-hidden border border-border"
      style={{ height: `${height}px` }}
    />
  );
});
