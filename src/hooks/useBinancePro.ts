/**
 * Binance Futures public-data aggregator (no API key required).
 * Fetches funding rate, OI history, long/short ratios, taker volume,
 * recent liquidations (estimate), CVD, RSI.
 */
import { useEffect, useState } from 'react';
import { calcRSI } from '@/utils/indicators';

export interface ProSeries {
  time: number;
  value: number;
}

export interface LiquidationLevel {
  price: number;
  side: 'long' | 'short';
  size: number;    // 0..1 intensity
  leverage: number;
}

export interface ProData {
  loading: boolean;
  error: string | null;
  fundingRate: number | null;        // %
  predictedFunding: number | null;   // next funding %
  markPrice: number | null;
  openInterest: number | null;       // contracts (USDT-notional)
  oiHistory: ProSeries[];            // last 24 1h points
  oiChange24hPct: number | null;
  topAccountLs: number | null;       // long/short ratio of top traders (accounts)
  topPositionLs: number | null;      // long/short ratio of top traders (positions)
  globalAccountLs: number | null;    // global account L/S
  takerBuySellRatio: number | null;  // last 5m buy/sell ratio
  takerHistory: ProSeries[];         // ratio over time
  rsi: number | null;
  cvd: ProSeries[];                  // cumulative volume delta (aggTrades aprox)
  liquidationLevels: LiquidationLevel[];
  lastUpdate: number | null;
}

const FUT = 'https://fapi.binance.com';

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json() as Promise<T>;
}

/** Estimate liquidation clusters around current price based on common leverages. */
function estimateLiquidations(price: number, longLs: number): LiquidationLevel[] {
  const levels: LiquidationLevel[] = [];
  const leverages = [10, 25, 50, 75, 100];
  // intensity from L/S ratio: more longs → more long-liq fuel below
  const longBias = Math.min(1, Math.max(0.2, longLs / (1 + longLs)));
  leverages.forEach((lev) => {
    const dist = 1 / lev; // simplified maintenance margin ~0
    // Long liquidations below current
    levels.push({
      price: price * (1 - dist),
      side: 'long',
      size: longBias * (lev / 100) * (lev <= 25 ? 1.0 : 0.6),
      leverage: lev,
    });
    // Short liquidations above current
    levels.push({
      price: price * (1 + dist),
      side: 'short',
      size: (1 - longBias) * (lev / 100) * (lev <= 25 ? 1.0 : 0.6),
      leverage: lev,
    });
  });
  return levels.sort((a, b) => a.price - b.price);
}

export function useBinancePro(symbol: string, intervalMs = 30_000): ProData {
  const [data, setData] = useState<ProData>({
    loading: true,
    error: null,
    fundingRate: null,
    predictedFunding: null,
    markPrice: null,
    openInterest: null,
    oiHistory: [],
    oiChange24hPct: null,
    topAccountLs: null,
    topPositionLs: null,
    globalAccountLs: null,
    takerBuySellRatio: null,
    takerHistory: [],
    rsi: null,
    cvd: [],
    liquidationLevels: [],
    lastUpdate: null,
  });

  useEffect(() => {
    let alive = true;
    const sym = `${symbol.toUpperCase()}USDT`;

    async function fetchAll() {
      try {
        const [
          premium,
          oi,
          oiHist,
          topAcc,
          topPos,
          globalAcc,
          takerHist,
          klines,
          aggTrades,
        ] = await Promise.all([
          jget<any>(`${FUT}/fapi/v1/premiumIndex?symbol=${sym}`),
          jget<any>(`${FUT}/fapi/v1/openInterest?symbol=${sym}`),
          jget<any[]>(`${FUT}/futures/data/openInterestHist?symbol=${sym}&period=1h&limit=24`),
          jget<any[]>(`${FUT}/futures/data/topLongShortAccountRatio?symbol=${sym}&period=1h&limit=24`),
          jget<any[]>(`${FUT}/futures/data/topLongShortPositionRatio?symbol=${sym}&period=1h&limit=24`),
          jget<any[]>(`${FUT}/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=1h&limit=24`),
          jget<any[]>(`${FUT}/futures/data/takerlongshortRatio?symbol=${sym}&period=5m&limit=48`),
          jget<any[]>(`${FUT}/fapi/v1/klines?symbol=${sym}&interval=15m&limit=100`),
          jget<any[]>(`${FUT}/fapi/v1/aggTrades?symbol=${sym}&limit=1000`),
        ]);
        if (!alive) return;

        const fundingRate = parseFloat(premium.lastFundingRate) * 100;
        const predictedFunding = parseFloat(premium.lastFundingRate) * 100; // approximation
        const markPrice = parseFloat(premium.markPrice);
        const openInterest = parseFloat(oi.openInterest);

        const oiHistory: ProSeries[] = oiHist.map((d: any) => ({
          time: d.timestamp,
          value: parseFloat(d.sumOpenInterest),
        }));
        const oiFirst = oiHistory[0]?.value ?? 0;
        const oiLast = oiHistory[oiHistory.length - 1]?.value ?? 0;
        const oiChange24hPct = oiFirst > 0 ? ((oiLast - oiFirst) / oiFirst) * 100 : null;

        const topAccountLs = topAcc.length ? parseFloat(topAcc[topAcc.length - 1].longShortRatio) : null;
        const topPositionLs = topPos.length ? parseFloat(topPos[topPos.length - 1].longShortRatio) : null;
        const globalAccountLs = globalAcc.length ? parseFloat(globalAcc[globalAcc.length - 1].longShortRatio) : null;

        const takerHistory: ProSeries[] = takerHist.map((d: any) => ({
          time: d.timestamp,
          value: parseFloat(d.buySellRatio),
        }));
        const takerBuySellRatio = takerHistory.length ? takerHistory[takerHistory.length - 1].value : null;

        const closes = klines.map((k: any[]) => parseFloat(k[4]));
        const rsiArr = calcRSI(closes, 14);
        const rsi = rsiArr[rsiArr.length - 1] || null;

        // CVD from aggTrades (m=true means buyer is market maker → sell aggressor)
        let cum = 0;
        const cvdRaw: ProSeries[] = aggTrades.map((t: any) => {
          const qty = parseFloat(t.q);
          cum += t.m ? -qty : qty;
          return { time: t.T, value: cum };
        });
        // downsample to 60 points
        const step = Math.max(1, Math.floor(cvdRaw.length / 60));
        const cvd = cvdRaw.filter((_, i) => i % step === 0);

        const liquidationLevels = estimateLiquidations(markPrice, topPositionLs ?? 1);

        setData({
          loading: false,
          error: null,
          fundingRate,
          predictedFunding,
          markPrice,
          openInterest,
          oiHistory,
          oiChange24hPct,
          topAccountLs,
          topPositionLs,
          globalAccountLs,
          takerBuySellRatio,
          takerHistory,
          rsi,
          cvd,
          liquidationLevels,
          lastUpdate: Date.now(),
        });
      } catch (e: any) {
        if (!alive) return;
        setData((p) => ({ ...p, loading: false, error: e.message ?? 'pro data load failed' }));
      }
    }

    fetchAll();
    const id = setInterval(fetchAll, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [symbol, intervalMs]);

  return data;
}
