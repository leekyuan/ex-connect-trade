import { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { fetchKlinesFallback } from '@/lib/multiExchangeKlines';
import { Loader2 } from 'lucide-react';

interface Props {
  symbol: string;
  interval: string;
  height?: number;
}

export function CustomLightweightChart({ symbol, interval, height = 560 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{ exchange: string; fallback: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: { background: { color: 'transparent' }, textColor: '#94a3b8' },
      grid: {
        vertLines: { color: 'rgba(55,65,81,0.25)' },
        horzLines: { color: 'rgba(55,65,81,0.25)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(55,65,81,0.4)' },
      timeScale: { borderColor: 'rgba(55,65,81,0.4)', timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;
    candleRef.current = chart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444',
      borderUpColor: '#10b981', borderDownColor: '#ef4444',
      wickUpColor: '#10b981', wickDownColor: '#ef4444',
    });
    volRef.current = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      color: 'rgba(99,102,241,0.4)',
    });
    volRef.current.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, [height]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    fetchKlinesFallback(symbol, interval, 500)
      .then(res => {
        if (!alive || !candleRef.current || !volRef.current) return;
        const data = res.candles.map(c => ({
          time: Math.floor(c.time / 1000) as any,
          open: c.open, high: c.high, low: c.low, close: c.close,
        }));
        const vol = res.candles.map(c => ({
          time: Math.floor(c.time / 1000) as any,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)',
        }));
        candleRef.current.setData(data);
        volRef.current.setData(vol);
        chartRef.current?.timeScale().fitContent();
        setMeta({ exchange: res.exchange, fallback: res.fallback });
      })
      .catch(e => alive && setErr(e?.message ?? '데이터 로드 실패'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [symbol, interval]);

  return (
    <div className="relative rounded-lg border border-border bg-card overflow-hidden" style={{ height }}>
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2 text-[11px]">
        <span className="px-2 py-0.5 rounded bg-background/80 border border-border font-mono">
          {symbol}/USDT · {interval}
        </span>
        {meta && (
          <span className={`px-2 py-0.5 rounded border ${meta.fallback ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'}`}>
            {meta.exchange}{meta.fallback ? ' (폴백)' : ''}
          </span>
        )}
      </div>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 z-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {err && (
        <div className="absolute inset-0 flex items-center justify-center text-destructive text-sm z-20">
          {err}
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
