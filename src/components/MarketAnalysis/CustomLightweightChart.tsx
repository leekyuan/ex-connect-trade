import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart, CrosshairMode, LineStyle,
  type IChartApi, type ISeriesApi, type IPriceLine,
  type SeriesMarker, type Time,
} from 'lightweight-charts';
import { fetchKlinesFallback } from '@/lib/multiExchangeKlines';
import {
  calcEMA, calcBB, calcRSI, calcMACD, calcStoch, calcSupertrend,
  findSwingPoints, findFVGs, findOrderBlocks, calcPivotPoints, calcFibLevels,
  type Candle,
} from '@/utils/indicators';
import { Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface Props {
  symbol: string;
  interval: string;
  height?: number;
}

interface Toggles {
  ema5: boolean; ema10: boolean; ema20: boolean; ema50: boolean; ema200: boolean;
  bb: boolean; supertrend: boolean;
  rsi: boolean; macd: boolean; stoch: boolean;
  fractal: boolean; pivot: boolean; fvg: boolean; ob: boolean; fib: boolean;
}

const DEFAULT_TOGGLES: Toggles = {
  ema5: false, ema10: false, ema20: true, ema50: true, ema200: true,
  bb: true, supertrend: false,
  rsi: true, macd: true, stoch: false,
  fractal: false, pivot: false, fvg: false, ob: false, fib: false,
};

const STORAGE_KEY = 'cryptoedge-custom-chart-toggles-v1';

function loadToggles(): Toggles {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_TOGGLES, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_TOGGLES;
}

const EMA_COLORS: Record<string, string> = {
  ema5: '#f59e0b', ema10: '#06b6d4', ema20: '#a78bfa', ema50: '#10b981', ema200: '#ef4444',
};

export function CustomLightweightChart({ symbol, interval, height = 560 }: Props) {
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const stochRef = useRef<HTMLDivElement>(null);

  const mainChart = useRef<IChartApi | null>(null);
  const rsiChart = useRef<IChartApi | null>(null);
  const macdChart = useRef<IChartApi | null>(null);
  const stochChart = useRef<IChartApi | null>(null);

  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volSeries = useRef<ISeriesApi<'Histogram'> | null>(null);
  const overlays = useRef<ISeriesApi<'Line'>[]>([]);
  const subSeries = useRef<ISeriesApi<any>[]>([]);
  const priceLines = useRef<IPriceLine[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [meta, setMeta] = useState<{ exchange: string; fallback: boolean } | null>(null);
  const [toggles, setToggles] = useState<Toggles>(() => loadToggles());

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(toggles)); } catch { /* ignore */ }
  }, [toggles]);

  const showRsi = toggles.rsi;
  const showMacd = toggles.macd;
  const showStoch = toggles.stoch;
  const subPanels = (showRsi ? 1 : 0) + (showMacd ? 1 : 0) + (showStoch ? 1 : 0);
  const subPanelHeight = 110;
  const mainHeight = Math.max(220, height - subPanels * subPanelHeight - 8);

  // ── 차트 생성 ──
  useEffect(() => {
    if (!mainRef.current) return;
    const base = {
      layout: { background: { color: 'transparent' as const }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(55,65,81,0.18)' }, horzLines: { color: 'rgba(55,65,81,0.18)' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(55,65,81,0.4)' },
      timeScale: { borderColor: 'rgba(55,65,81,0.4)', timeVisible: true, secondsVisible: false },
    };
    const main = createChart(mainRef.current, { ...base, width: mainRef.current.clientWidth, height: mainHeight });
    mainChart.current = main;
    candleSeries.current = main.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444',
      borderUpColor: '#10b981', borderDownColor: '#ef4444',
      wickUpColor: '#10b981', wickDownColor: '#ef4444',
    });
    volSeries.current = main.addHistogramSeries({
      priceFormat: { type: 'volume' }, priceScaleId: '', color: 'rgba(99,102,241,0.4)',
    });
    volSeries.current.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const charts: IChartApi[] = [main];
    if (showRsi && rsiRef.current) {
      rsiChart.current = createChart(rsiRef.current, { ...base, width: rsiRef.current.clientWidth, height: subPanelHeight });
      charts.push(rsiChart.current);
    }
    if (showMacd && macdRef.current) {
      macdChart.current = createChart(macdRef.current, { ...base, width: macdRef.current.clientWidth, height: subPanelHeight });
      charts.push(macdChart.current);
    }
    if (showStoch && stochRef.current) {
      stochChart.current = createChart(stochRef.current, { ...base, width: stochRef.current.clientWidth, height: subPanelHeight });
      charts.push(stochChart.current);
    }

    // 시간 축 동기화
    const syncFrom = (src: IChartApi) => {
      src.timeScale().subscribeVisibleLogicalRangeChange(r => {
        if (!r) return;
        charts.forEach(c => { if (c !== src) c.timeScale().setVisibleLogicalRange(r); });
      });
    };
    charts.forEach(syncFrom);

    const ro = new ResizeObserver(() => {
      if (mainRef.current && mainChart.current) {
        mainChart.current.applyOptions({ width: mainRef.current.clientWidth });
      }
      if (rsiRef.current && rsiChart.current) rsiChart.current.applyOptions({ width: rsiRef.current.clientWidth });
      if (macdRef.current && macdChart.current) macdChart.current.applyOptions({ width: macdRef.current.clientWidth });
      if (stochRef.current && stochChart.current) stochChart.current.applyOptions({ width: stochRef.current.clientWidth });
    });
    ro.observe(mainRef.current);

    return () => {
      ro.disconnect();
      charts.forEach(c => c.remove());
      mainChart.current = null; rsiChart.current = null; macdChart.current = null; stochChart.current = null;
      candleSeries.current = null; volSeries.current = null;
      overlays.current = []; subSeries.current = []; priceLines.current = [];
    };
  }, [mainHeight, showRsi, showMacd, showStoch]);

  // ── 데이터 로드 ──
  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    fetchKlinesFallback(symbol, interval, 500)
      .then(res => {
        if (!alive) return;
        setCandles(res.candles);
        setMeta({ exchange: res.exchange, fallback: res.fallback });
      })
      .catch(e => alive && setErr(e?.message ?? '데이터 로드 실패'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [symbol, interval]);

  // ── 캔들/볼륨 ──
  useEffect(() => {
    if (!candles.length || !candleSeries.current || !volSeries.current) return;
    candleSeries.current.setData(candles.map(c => ({
      time: Math.floor(c.time / 1000) as Time,
      open: c.open, high: c.high, low: c.low, close: c.close,
    })));
    volSeries.current.setData(candles.map(c => ({
      time: Math.floor(c.time / 1000) as Time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)',
    })));
    mainChart.current?.timeScale().fitContent();
  }, [candles]);

  // ── 오버레이 (EMA/BB/Supertrend/Fractal/Pivot/FVG/OB/Fib) ──
  useEffect(() => {
    const main = mainChart.current;
    const cs = candleSeries.current;
    if (!main || !cs || !candles.length) return;

    // 기존 라인/마커/프라이스라인 제거
    overlays.current.forEach(s => main.removeSeries(s));
    overlays.current = [];
    priceLines.current.forEach(pl => cs.removePriceLine(pl));
    priceLines.current = [];
    cs.setMarkers([]);

    const closes = candles.map(c => c.close);
    const times: Time[] = candles.map(c => Math.floor(c.time / 1000) as Time);

    const addLine = (vals: number[], color: string, width: 1 | 2 = 1, dashed = false) => {
      const s = main.addLineSeries({
        color, lineWidth: width,
        lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      });
      s.setData(vals.map((v, i) => isNaN(v) ? null : { time: times[i], value: v }).filter(Boolean) as any);
      overlays.current.push(s);
    };

    // EMA
    const emas: Array<[keyof Toggles, number]> = [
      ['ema5', 5], ['ema10', 10], ['ema20', 20], ['ema50', 50], ['ema200', 200],
    ];
    emas.forEach(([key, p]) => {
      if (toggles[key]) addLine(calcEMA(closes, p), EMA_COLORS[key]);
    });

    // BB
    if (toggles.bb) {
      const bb = calcBB(closes, 20, 2);
      addLine(bb.upper, '#94a3b8', 1, true);
      addLine(bb.middle, '#94a3b8', 1);
      addLine(bb.lower, '#94a3b8', 1, true);
    }

    // Supertrend
    if (toggles.supertrend) {
      const st = calcSupertrend(candles, 10, 2);
      const up = st.value.map((v, i) => st.trend[i] === 'up' ? v : NaN);
      const dn = st.value.map((v, i) => st.trend[i] === 'down' ? v : NaN);
      addLine(up, '#10b981', 2);
      addLine(dn, '#ef4444', 2);
    }

    // Pivot (전체 캔들 직전 50봉을 prev session 으로 사용)
    if (toggles.pivot && candles.length >= 30) {
      const session = candles.slice(-50, -1);
      const h = Math.max(...session.map(c => c.high));
      const l = Math.min(...session.map(c => c.low));
      const cl = session[session.length - 1].close;
      const piv = calcPivotPoints(h, l, cl);
      const draw = (price: number, title: string, color: string, dashed = false) => {
        priceLines.current.push(cs.createPriceLine({
          price, color, lineWidth: 1,
          lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
          axisLabelVisible: true, title,
        }));
      };
      draw(piv.pp, 'PP', '#f59e0b');
      draw(piv.r1, 'R1', '#10b981', true); draw(piv.s1, 'S1', '#ef4444', true);
      draw(piv.r2, 'R2', '#10b981', true); draw(piv.s2, 'S2', '#ef4444', true);
    }

    // Fib (마지막 두 스윙 포인트 기반)
    if (toggles.fib) {
      const swings = findSwingPoints(candles, 0.03);
      if (swings.length >= 2) {
        const lastHigh = [...swings].reverse().find(s => s.type === 'high');
        const lastLow = [...swings].reverse().find(s => s.type === 'low');
        if (lastHigh && lastLow) {
          const fib = calcFibLevels(lastHigh.price, lastLow.price);
          fib.levels.forEach(l => {
            priceLines.current.push(cs.createPriceLine({
              price: l.price,
              color: l.ratio === 0.618 || l.ratio === 0.5 ? '#a78bfa' : 'rgba(167,139,250,0.5)',
              lineWidth: 1, lineStyle: LineStyle.Dotted,
              axisLabelVisible: true, title: `Fib ${(l.ratio * 100).toFixed(1)}%`,
            }));
          });
        }
      }
    }

    // Fractal swing markers
    if (toggles.fractal) {
      const swings = findSwingPoints(candles, 0.025);
      const markers: SeriesMarker<Time>[] = swings.map(p => ({
        time: times[p.index],
        position: p.type === 'high' ? 'aboveBar' : 'belowBar',
        color: p.type === 'high' ? '#ef4444' : '#10b981',
        shape: p.type === 'high' ? 'arrowDown' : 'arrowUp',
        text: p.type === 'high' ? 'H' : 'L',
      }));
      cs.setMarkers(markers);
    }

    // FVG (price-line band 근사 — 최근 5개)
    if (toggles.fvg) {
      const fvgs = findFVGs(candles, 100).slice(-5);
      fvgs.forEach(g => {
        const color = g.type === 'bullish' ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)';
        priceLines.current.push(cs.createPriceLine({
          price: g.top, color, lineWidth: 1, lineStyle: LineStyle.Dashed,
          axisLabelVisible: false, title: `FVG ${g.type === 'bullish' ? '↑' : '↓'}`,
        }));
        priceLines.current.push(cs.createPriceLine({
          price: g.bottom, color, lineWidth: 1, lineStyle: LineStyle.Dashed,
          axisLabelVisible: false, title: '',
        }));
      });
    }

    // OB (최근 3개)
    if (toggles.ob) {
      const obs = findOrderBlocks(candles, 120, 1.5).slice(-3);
      obs.forEach(o => {
        const color = o.type === 'bullish' ? 'rgba(34,197,94,0.9)' : 'rgba(244,63,94,0.9)';
        priceLines.current.push(cs.createPriceLine({
          price: o.top, color, lineWidth: 2, lineStyle: LineStyle.Solid,
          axisLabelVisible: true, title: `OB ${o.type === 'bullish' ? 'B' : 'S'}`,
        }));
        priceLines.current.push(cs.createPriceLine({
          price: o.bottom, color, lineWidth: 2, lineStyle: LineStyle.Solid,
          axisLabelVisible: false, title: '',
        }));
      });
    }
  }, [candles, toggles]);

  // ── 서브 패널 (RSI / MACD / Stoch) ──
  useEffect(() => {
    subSeries.current.forEach(s => { try { (s as any).chart?.()?.removeSeries(s); } catch { /* ignore */ } });
    subSeries.current = [];
    if (!candles.length) return;

    const times: Time[] = candles.map(c => Math.floor(c.time / 1000) as Time);
    const closes = candles.map(c => c.close);

    if (showRsi && rsiChart.current) {
      const rsi = calcRSI(closes, 14);
      const s = rsiChart.current.addLineSeries({
        color: '#a78bfa', lineWidth: 2, priceLineVisible: false, lastValueVisible: true,
      });
      s.setData(rsi.map((v, i) => isNaN(v) ? null : { time: times[i], value: v }).filter(Boolean) as any);
      [30, 50, 70].forEach(lv => {
        s.createPriceLine({
          price: lv, color: lv === 50 ? '#64748b' : 'rgba(167,139,250,0.5)',
          lineWidth: 1, lineStyle: LineStyle.Dashed,
          axisLabelVisible: true, title: `${lv}`,
        });
      });
      subSeries.current.push(s);
    }

    if (showMacd && macdChart.current) {
      const m = calcMACD(closes, 12, 26, 9);
      const macdLine = macdChart.current.addLineSeries({ color: '#06b6d4', lineWidth: 2 });
      const signalLine = macdChart.current.addLineSeries({ color: '#f59e0b', lineWidth: 2 });
      const hist = macdChart.current.addHistogramSeries({ color: 'rgba(99,102,241,0.5)' });
      macdLine.setData(m.macd.map((v, i) => isNaN(v) ? null : { time: times[i], value: v }).filter(Boolean) as any);
      signalLine.setData(m.signal.map((v, i) => isNaN(v) ? null : { time: times[i], value: v }).filter(Boolean) as any);
      hist.setData(m.histogram.map((v, i) => isNaN(v) ? null : {
        time: times[i], value: v,
        color: v >= 0 ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)',
      }).filter(Boolean) as any);
      subSeries.current.push(macdLine, signalLine, hist);
    }

    if (showStoch && stochChart.current) {
      const st = calcStoch(candles, 14, 3, 3);
      const kS = stochChart.current.addLineSeries({ color: '#10b981', lineWidth: 2 });
      const dS = stochChart.current.addLineSeries({ color: '#ef4444', lineWidth: 2 });
      kS.setData(st.k.map((v, i) => isNaN(v) ? null : { time: times[i], value: v }).filter(Boolean) as any);
      dS.setData(st.d.map((v, i) => isNaN(v) ? null : { time: times[i], value: v }).filter(Boolean) as any);
      [20, 80].forEach(lv => {
        kS.createPriceLine({
          price: lv, color: 'rgba(148,163,184,0.5)',
          lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `${lv}`,
        });
      });
      subSeries.current.push(kS, dS);
    }
  }, [candles, showRsi, showMacd, showStoch]);

  const groups = useMemo(() => ([
    { title: '이동평균', keys: ['ema5', 'ema10', 'ema20', 'ema50', 'ema200'] as Array<keyof Toggles> },
    { title: '오버레이', keys: ['bb', 'supertrend', 'pivot', 'fib'] as Array<keyof Toggles> },
    { title: '스마트머니/구조', keys: ['fractal', 'fvg', 'ob'] as Array<keyof Toggles> },
    { title: '오실레이터', keys: ['rsi', 'macd', 'stoch'] as Array<keyof Toggles> },
  ]), []);

  const labelMap: Record<keyof Toggles, string> = {
    ema5: 'EMA 5', ema10: 'EMA 10', ema20: 'EMA 20', ema50: 'EMA 50', ema200: 'EMA 200',
    bb: 'Bollinger Bands', supertrend: 'Supertrend',
    rsi: 'RSI (14)', macd: 'MACD (12·26·9)', stoch: 'Stoch (14·3·3)',
    fractal: '프랙탈 스윙', pivot: 'Pivot Points', fvg: 'FVG (3봉 갭)', ob: 'Order Block', fib: 'Fibonacci',
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* 토글 패널 */}
      <div className="border-b border-border bg-muted/30 p-2 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded bg-background border border-border font-mono font-bold">
            {symbol}/USDT · {interval}
          </span>
          {meta && (
            <span className={`px-2 py-0.5 rounded border ${meta.fallback ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'}`}>
              {meta.exchange}{meta.fallback ? ' (폴백)' : ''}
            </span>
          )}
          <button
            onClick={() => setToggles(DEFAULT_TOGGLES)}
            className="ml-auto text-[10px] px-2 py-0.5 rounded border border-border bg-background hover:bg-muted"
          >
            기본값
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1">
          {groups.map(g => (
            <div key={g.title} className="space-y-1">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase">{g.title}</div>
              {g.keys.map(k => (
                <label key={k} className="flex items-center justify-between gap-2 text-[11px] cursor-pointer">
                  <span className="flex items-center gap-1.5">
                    {EMA_COLORS[k as string] && (
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: EMA_COLORS[k as string] }} />
                    )}
                    {labelMap[k]}
                  </span>
                  <Switch
                    checked={toggles[k]}
                    onCheckedChange={(v) => setToggles(t => ({ ...t, [k]: v }))}
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="relative" style={{ height }}>
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
        <div ref={mainRef} style={{ height: mainHeight }} />
        {showRsi && (
          <div className="border-t border-border">
            <div className="text-[9px] px-2 pt-1 text-muted-foreground">RSI (14)</div>
            <div ref={rsiRef} style={{ height: subPanelHeight }} />
          </div>
        )}
        {showMacd && (
          <div className="border-t border-border">
            <div className="text-[9px] px-2 pt-1 text-muted-foreground">MACD (12·26·9)</div>
            <div ref={macdRef} style={{ height: subPanelHeight }} />
          </div>
        )}
        {showStoch && (
          <div className="border-t border-border">
            <div className="text-[9px] px-2 pt-1 text-muted-foreground">Stochastic (14·3·3)</div>
            <div ref={stochRef} style={{ height: subPanelHeight }} />
          </div>
        )}
      </div>
    </div>
  );
}
