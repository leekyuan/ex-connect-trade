/**
 * Binance Futures live trading client (browser-side).
 * All requests are signed by the binance-proxy edge function — the secret
 * never leaves the user's machine in plaintext over public CORS endpoints.
 */
import { supabase } from '@/integrations/supabase/client';

interface Creds { apiKey: string; apiSecret: string; }

export function loadCreds(): Creds | null {
  try {
    const raw = localStorage.getItem('binance_creds');
    if (!raw) return null;
    const obj = JSON.parse(raw) as Creds;
    if (!obj.apiKey || !obj.apiSecret) return null;
    return obj;
  } catch { return null; }
}

export function saveCreds(c: Creds): void {
  localStorage.setItem('binance_creds', JSON.stringify(c));
}

export function clearCreds(): void {
  localStorage.removeItem('binance_creds');
}

async function call<T>(method: 'GET' | 'POST' | 'DELETE', endpoint: string, params: Record<string, any> = {}, creds?: Creds): Promise<T> {
  const c = creds ?? loadCreds();
  if (!c) throw new Error('NO_API_KEY');
  const { data, error } = await supabase.functions.invoke('binance-proxy', {
    body: { method, endpoint, params, apiKey: c.apiKey, apiSecret: c.apiSecret },
  });
  if (error) throw error;
  if (data?.code && data?.code < 0) throw new Error(data.msg || 'binance_error');
  return data as T;
}

// ───── Public helpers ─────────────────────────────────────────
export async function getFuturesBalance(creds?: Creds): Promise<string> {
  const data = await call<any[]>('GET', '/fapi/v2/balance', {}, creds);
  const usdt = Array.isArray(data) ? data.find((d: any) => d.asset === 'USDT') : null;
  return usdt?.availableBalance || '0';
}

export async function setLeverage(symbol: string, leverage: number, creds?: Creds) {
  return call('POST', '/fapi/v1/leverage', { symbol, leverage }, creds);
}

export async function placeMarketOrder(symbol: string, side: 'BUY' | 'SELL', quantity: number, creds?: Creds) {
  return call('POST', '/fapi/v1/order', { symbol, side, type: 'MARKET', quantity }, creds);
}

export async function placeSLTP(
  symbol: string, side: 'BUY' | 'SELL',
  slPrice: number, tpPrice: number, creds?: Creds,
) {
  const closeSide = side === 'BUY' ? 'SELL' : 'BUY';
  await call('POST', '/fapi/v1/order', {
    symbol, side: closeSide, type: 'STOP_MARKET',
    stopPrice: slPrice.toFixed(2), closePosition: 'true',
    timeInForce: 'GTE_GTC', workingType: 'MARK_PRICE',
  }, creds);
  await call('POST', '/fapi/v1/order', {
    symbol, side: closeSide, type: 'TAKE_PROFIT_MARKET',
    stopPrice: tpPrice.toFixed(2), closePosition: 'true',
    timeInForce: 'GTE_GTC', workingType: 'MARK_PRICE',
  }, creds);
}

export interface FuturesPosition {
  symbol: string;
  positionAmt: number;
  entryPrice: number;
  markPrice: number;
  unRealizedProfit: number;
  leverage: number;
  side: 'LONG' | 'SHORT';
}

export async function getOpenPositions(creds?: Creds): Promise<FuturesPosition[]> {
  const raw = await call<any[]>('GET', '/fapi/v2/positionRisk', {}, creds);
  return (Array.isArray(raw) ? raw : [])
    .filter((p: any) => parseFloat(p.positionAmt) !== 0)
    .map((p: any): FuturesPosition => {
      const amt = parseFloat(p.positionAmt);
      return {
        symbol: p.symbol,
        positionAmt: amt,
        entryPrice: parseFloat(p.entryPrice),
        markPrice: parseFloat(p.markPrice),
        unRealizedProfit: parseFloat(p.unRealizedProfit),
        leverage: parseInt(p.leverage, 10) || 1,
        side: amt > 0 ? 'LONG' : 'SHORT',
      };
    });
}

export async function closePosition(symbol: string, positionAmt: number, creds?: Creds) {
  const side: 'BUY' | 'SELL' = positionAmt > 0 ? 'SELL' : 'BUY';
  return placeMarketOrder(symbol, side, Math.abs(positionAmt), creds);
}
