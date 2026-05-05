/**
 * Neo-Wave 분석 차트 (lightweight-charts)
 *
 * - 캔들스틱
 * - 라벨링된 스윙 마커 (0,1,2,3,4,5)
 * - 평행 채널 (1·3 / 2·4)
 * - 시나리오 3종 — 현재가 → target 점선
 * - invalidation 수평선
 */
import { useEffect, useRef } from 'react';
import { createChart, type IChartApi, type ISeriesApi, type Time, LineStyle, CrosshairMode } from 'lightweight-charts';
import type { Candle } from '@/utils/indicators';
import type { NeoWaveResult, NeoWaveScenario } from '@/utils/theories/neely';

interface Props {
  candles: Candle[];
  result: NeoWaveResult | null;
  /** 사용자가 선택한 시나리오 ID — 강조 표시용 */
  highlightedScenario?: NeoWaveScenario['id'];
  height?: number;
}

export function NeoWaveChart({ candles, result, highlightedScenario, height = 480 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const overlaySeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const priceLinesRef = useRef<any[]>([]);

  // ── 차트 초기화 ──
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: 'rgba(15,23,42,1)' },
        textColor: '#cbd5e1',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(55,65,81,0.25)' },
        horzLines: { color: 'rgba(55,65,81,0.25)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(71,85,105,0.5)' },
      timeScale: { borderColor: 'rgba(71,85,105,0.5)', timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    const series = chart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444',
      borderUpColor: '#10b981', borderDownColor: '#ef4444',
      wickUpColor: '#10b981', wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = series;

    return () => { chart.remove(); chartRef.current = null; candleSeriesRef.current = null; };
  }, []);

  // ── 캔들 데이터 갱신 ──
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;
    const data = candles.map(c => ({
      time: Math.floor(c.time / 1000) as Time,
      open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    candleSeriesRef.current.setData(data);
  }, [candles]);

  // ── 오버레이(채널·시나리오·마커) 재구성 ──
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;

    // 기존 오버레이 정리
    overlaySeriesRef.current.forEach(s => { try { chart.removeSeries(s); } catch {} });
    overlaySeriesRef.current = [];
    priceLinesRef.current.forEach(pl => { try { candleSeries.removePriceLine(pl); } catch {} });
    priceLinesRef.current = [];

    if (!result || candles.length === 0) {
      candleSeries.setMarkers([]);
      return;
    }

    const { structure, scenarios } = result;

    // ── 1) 라벨링된 스윙 마커 ──
    const markers = structure.labeledSwings.map(sw => {
      const c = candles[sw.index];
      if (!c) return null;
      return {
        time: Math.floor(c.time / 1000) as Time,
        position: sw.type === 'high' ? 'aboveBar' : 'belowBar',
        color: sw.type === 'high' ? '#f59e0b' : '#3b82f6',
        shape: 'circle',
        text: sw.label.toUpperCase(),
        size: 1.5,
      } as any;
    }).filter(Boolean);
    candleSeries.setMarkers(markers);

    // ── 2) 평행 채널 (1·3 / 2·4) ──
    if (structure.channel) {
      const ch = structure.channel;
      const upperLine = chart.addLineSeries({
        color: 'rgba(168, 85, 247, 0.7)', lineWidth: 2,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false, lastValueVisible: false,
      });
      upperLine.setData([
        { time: Math.floor(ch.upper.t1 / 1000) as Time, value: ch.upper.p1 },
        { time: Math.floor(ch.upper.t2 / 1000) as Time, value: ch.upper.p2 },
      ]);
      overlaySeriesRef.current.push(upperLine);

      const lowerLine = chart.addLineSeries({
        color: 'rgba(168, 85, 247, 0.7)', lineWidth: 2,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false, lastValueVisible: false,
      });
      lowerLine.setData([
        { time: Math.floor(ch.lower.t1 / 1000) as Time, value: ch.lower.p1 },
        { time: Math.floor(ch.lower.t2 / 1000) as Time, value: ch.lower.p2 },
      ]);
      overlaySeriesRef.current.push(lowerLine);
    }

    // ── 3) 5파 진행선 (라벨된 스윙들 잇기) ──
    if (structure.labeledSwings.length >= 2) {
      const waveLine = chart.addLineSeries({
        color: 'rgba(16, 185, 129, 0.5)', lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false, lastValueVisible: false,
      });
      waveLine.setData(structure.labeledSwings.map(sw => ({
        time: Math.floor(candles[sw.index].time / 1000) as Time,
        value: sw.price,
      })));
      overlaySeriesRef.current.push(waveLine);
    }

    // ── 4) 시나리오 — 현재가에서 target까지 점선 + invalidation 수평선 ──
    const lastCandle = candles[candles.length - 1];
    const lastTime = Math.floor(lastCandle.time / 1000) as Time;
    const futureBars = 30;
    const tfMs = candles.length >= 2 ? candles[1].time - candles[0].time : 60_000;
    const futureTime = Math.floor((lastCandle.time + tfMs * futureBars) / 1000) as Time;

    scenarios.forEach((sc) => {
      const isHi = highlightedScenario === sc.id;
      const opacity = highlightedScenario ? (isHi ? 1.0 : 0.3) : 0.85;
      const widthPx = isHi ? 3 : 2;

      const colorRgba = (hex: string, a: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${a})`;
      };

      // target까지 점선
      const targetLine = chart.addLineSeries({
        color: colorRgba(sc.color, opacity), lineWidth: widthPx as any,
        lineStyle: LineStyle.LargeDashed,
        priceLineVisible: false, lastValueVisible: false,
      });
      targetLine.setData([
        { time: lastTime, value: lastCandle.close },
        { time: futureTime, value: sc.target },
      ]);
      overlaySeriesRef.current.push(targetLine);

      // invalidation 수평선
      const pl = candleSeries.createPriceLine({
        price: sc.invalidation,
        color: colorRgba(sc.color, opacity * 0.7),
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: `${sc.id.toUpperCase()} ✕`,
      });
      priceLinesRef.current.push(pl);

      // target 수평 마커
      const tpLine = candleSeries.createPriceLine({
        price: sc.target,
        color: colorRgba(sc.color, opacity),
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${sc.id.toUpperCase()} 🎯 ${sc.probability}%`,
      });
      priceLinesRef.current.push(tpLine);
    });

    chart.timeScale().fitContent();
  }, [candles, result, highlightedScenario]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg overflow-hidden border border-border bg-card"
      style={{ height: `${height}px` }}
    />
  );
}
