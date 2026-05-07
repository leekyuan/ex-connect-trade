/**
 * Binance → Binance Futures → OKX → Bybit → MEXC 폴백 OHLCV 페처
 * 모든 거래소를 정규 Candle 형식으로 통일.
 */
import type { Candle } from '@/utils/indicators';

export type ExchangeId = 'BINANCE' | 'BINANCE_FUT' | 'OKX' | 'BYBIT' | 'MEXC';

export interface KlineFetchResult {
  candles: Candle[];
  exchange: ExchangeId;
  fallback: boolean;
}

const DEFAULT_PRIORITY: ExchangeId[] = ['BINANCE', 'BINANCE_FUT', 'OKX', 'BYBIT', 'MEXC'];

/** 우리 표준 interval → 각 거래소 interval */
function mapInterval(ex: ExchangeId, tf: string): string {
  // tf: 1m,3m,5m,15m,30m,1h,2h,4h,6h,12h,1d,3d,1w
  if (ex === 'BINANCE' || ex === 'BINANCE_FUT' || ex === 'MEXC') return tf;
  if (ex === 'OKX') {
    const map: Record<string,string> = {
      '1m':'1m','3m':'3m','5m':'5m','15m':'15m','30m':'30m',
      '1h':'1H','2h':'2H','4h':'4H','6h':'6H','12h':'12H',
      '1d':'1D','3d':'3D','1w':'1W',
    };
    return map[tf] ?? '1H';
  }
  if (ex === 'BYBIT') {
    const map: Record<string,string> = {
      '1m':'1','3m':'3','5m':'5','15m':'15','30m':'30',
      '1h':'60','2h':'120','4h':'240','6h':'360','12h':'720',
      '1d':'D','1w':'W',
    };
    return map[tf] ?? '60';
  }
  return tf;
}

async function tryBinance(sym: string, tf: string, limit: number, futures = false): Promise<Candle[]> {
  const base = futures ? 'https://fapi.binance.com/fapi/v1/klines' : 'https://api.binance.com/api/v3/klines';
  const r = await fetch(`${base}?symbol=${sym}USDT&interval=${tf}&limit=${limit}`);
  if (!r.ok) throw new Error(`binance ${r.status}`);
  const raw: any[] = await r.json();
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('empty');
  return raw.map(k => ({ time:+k[0], open:+k[1], high:+k[2], low:+k[3], close:+k[4], volume:+k[5] }));
}

async function tryOKX(sym: string, tf: string, limit: number): Promise<Candle[]> {
  const inst = `${sym}-USDT-SWAP`;
  const bar = mapInterval('OKX', tf);
  const r = await fetch(`https://www.okx.com/api/v5/market/candles?instId=${inst}&bar=${bar}&limit=${limit}`);
  if (!r.ok) throw new Error(`okx ${r.status}`);
  const j = await r.json();
  if (!j?.data?.length) throw new Error('empty');
  // OKX 응답은 최신순 → 오래된순으로 reverse
  return j.data.slice().reverse().map((k: any[]) => ({
    time:+k[0], open:+k[1], high:+k[2], low:+k[3], close:+k[4], volume:+k[5],
  }));
}

async function tryBybit(sym: string, tf: string, limit: number): Promise<Candle[]> {
  const interval = mapInterval('BYBIT', tf);
  const r = await fetch(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${sym}USDT&interval=${interval}&limit=${limit}`);
  if (!r.ok) throw new Error(`bybit ${r.status}`);
  const j = await r.json();
  const list = j?.result?.list;
  if (!Array.isArray(list) || list.length === 0) throw new Error('empty');
  return list.slice().reverse().map((k: any[]) => ({
    time:+k[0], open:+k[1], high:+k[2], low:+k[3], close:+k[4], volume:+k[5],
  }));
}

async function tryMEXC(sym: string, tf: string, limit: number): Promise<Candle[]> {
  const r = await fetch(`https://api.mexc.com/api/v3/klines?symbol=${sym}USDT&interval=${tf}&limit=${limit}`);
  if (!r.ok) throw new Error(`mexc ${r.status}`);
  const raw: any[] = await r.json();
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('empty');
  return raw.map(k => ({ time:+k[0], open:+k[1], high:+k[2], low:+k[3], close:+k[4], volume:+k[5] }));
}

const cache = new Map<string, { ts: number; result: KlineFetchResult }>();
const TTL = 60_000;

/**
 * 자동 폴백 OHLCV 페치
 * 캐시 60s. 실패 시 다음 거래소로 자동 재시도.
 */
export async function fetchKlinesFallback(
  baseSymbol: string,
  tf: string,
  limit = 200,
  priority: ExchangeId[] = DEFAULT_PRIORITY,
): Promise<KlineFetchResult> {
  const sym = baseSymbol.toUpperCase();
  const cacheKey = `${sym}-${tf}-${limit}`;
  const c = cache.get(cacheKey);
  if (c && Date.now() - c.ts < TTL) return c.result;

  let lastErr: any = null;
  for (let i = 0; i < priority.length; i++) {
    const ex = priority[i];
    try {
      let candles: Candle[];
      if (ex === 'BINANCE') candles = await tryBinance(sym, tf, limit, false);
      else if (ex === 'BINANCE_FUT') candles = await tryBinance(sym, tf, limit, true);
      else if (ex === 'OKX') candles = await tryOKX(sym, tf, limit);
      else if (ex === 'BYBIT') candles = await tryBybit(sym, tf, limit);
      else candles = await tryMEXC(sym, tf, limit);
      const result: KlineFetchResult = { candles, exchange: ex, fallback: i > 0 };
      cache.set(cacheKey, { ts: Date.now(), result });
      return result;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`모든 거래소 폴백 실패: ${baseSymbol} ${tf} (${lastErr?.message ?? ''})`);
}
