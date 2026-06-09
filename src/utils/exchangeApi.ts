/**
 * Binance Futures live trading client (browser-side).
 *
 * SECURITY: API secrets are NEVER stored in localStorage and NEVER sent in the
 * request body. They are persisted in the `exchange_api_keys` table (RLS-protected),
 * and the `binance-proxy` edge function looks them up server-side using the
 * caller's verified JWT. localStorage only tracks a non-secret "configured" flag
 * so the UI can render without an extra round-trip.
 */
import { supabase } from '@/integrations/supabase/client';

export interface Creds { configured: true }

const FLAG_KEY = 'binance_configured';

export function loadCreds(): Creds | null {
  try {
    return localStorage.getItem(FLAG_KEY) === '1' ? { configured: true } : null;
  } catch { return null; }
}

export async function saveCreds(c: { apiKey: string; apiSecret: string }): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('NOT_AUTHENTICATED');
  const { error } = await (supabase as any)
    .from('exchange_api_keys')
    .upsert(
      { user_id: user.id, exchange: 'binance', api_key: c.apiKey, api_secret: c.apiSecret },
      { onConflict: 'user_id,exchange' },
    );
  if (error) throw error;
  try { localStorage.setItem(FLAG_KEY, '1'); } catch {}
}

export async function clearCreds(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await (supabase as any)
      .from('exchange_api_keys')
      .delete()
      .eq('user_id', user.id)
      .eq('exchange', 'binance');
  }
  try { localStorage.removeItem(FLAG_KEY); } catch {}
}

/** Refresh the local "configured" flag from the DB (call once at app start). */
export async function syncCredsFlag(): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from('exchange_api_keys')
    .select('id')
    .eq('exchange', 'binance')
    .maybeSingle();
  const has = !!data && !error;
  try {
    if (has) localStorage.setItem(FLAG_KEY, '1');
    else localStorage.removeItem(FLAG_KEY);
  } catch {}
  return has;
}

async function call<T>(method: 'GET' | 'POST' | 'DELETE', endpoint: string, params: Record<string, any> = {}, _creds?: Creds): Promise<T> {
  // Credentials are resolved server-side from the authenticated user's JWT.
  const { data, error } = await supabase.functions.invoke('binance-proxy', {
    body: { method, endpoint, params },
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
