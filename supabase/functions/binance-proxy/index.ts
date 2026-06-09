// Binance Futures (fapi) proxy — signs and forwards authenticated requests.
// SECURITY: API credentials are NEVER accepted from the request body.
// They are loaded server-side from public.exchange_api_keys using the caller's
// verified JWT, so leaked or forged client-side credentials cannot be used.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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
  endpoint: string;
  params?: Record<string, string | number>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Require a valid Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Validate body
    const body = await req.json() as ProxyReq;
    const { method, endpoint, params = {} } = body;
    if (!method || !endpoint?.startsWith('/fapi/')) {
      return new Response(JSON.stringify({ error: 'invalid_request' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Look up credentials server-side using RLS (caller can only see their own row)
    const { data: keyRow, error: keyErr } = await supabase
      .from('exchange_api_keys')
      .select('api_key, api_secret')
      .eq('exchange', 'binance')
      .maybeSingle();

    if (keyErr || !keyRow?.api_key || !keyRow?.api_secret) {
      return new Response(JSON.stringify({ error: 'NO_API_KEY' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Sign and forward
    const all: Record<string, string> = {};
    Object.entries(params).forEach(([k, v]) => { all[k] = String(v); });
    all.timestamp = String(Date.now());
    all.recvWindow = '10000';

    const qs = new URLSearchParams(all).toString();
    const sig = await hmacSha256Hex(keyRow.api_secret, qs);
    const url = `${FAPI_BASE}${endpoint}?${qs}&signature=${sig}`;

    const res = await fetch(url, {
      method,
      headers: { 'X-MBX-APIKEY': keyRow.api_key },
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
