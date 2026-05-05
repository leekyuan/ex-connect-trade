// Binance Futures (fapi) proxy — signs and forwards client requests.
// Avoids browser CORS limits and keeps API secret usage controlled.
// Client passes apiKey + apiSecret in JSON body (kept in localStorage on client side).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FAPI_BASE = 'https://fapi.binance.com';

async function hmacSha256Hex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface ProxyReq {
  method: 'GET' | 'POST' | 'DELETE';
  endpoint: string; // e.g. /fapi/v2/balance
  params?: Record<string, string | number>;
  apiKey: string;
  apiSecret: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as ProxyReq;
    const { method, endpoint, params = {}, apiKey, apiSecret } = body;

    if (!apiKey || !apiSecret || !endpoint?.startsWith('/fapi/')) {
      return new Response(JSON.stringify({ error: 'invalid_request' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const all: Record<string, string> = {};
    Object.entries(params).forEach(([k, v]) => { all[k] = String(v); });
    all.timestamp = String(Date.now());
    all.recvWindow = '10000';

    const qs = new URLSearchParams(all).toString();
    const sig = await hmacSha256Hex(apiSecret, qs);
    const url = `${FAPI_BASE}${endpoint}?${qs}&signature=${sig}`;

    const res = await fetch(url, {
      method,
      headers: { 'X-MBX-APIKEY': apiKey },
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
