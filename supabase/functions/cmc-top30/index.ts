import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const CMC_API_KEY = Deno.env.get('CMC_API_KEY') ?? '';
const CMC_URL = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Require a Supabase-issued token (project anon key or a user session JWT).
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const projectRef = (Deno.env.get('SUPABASE_URL') ?? '').replace('https://', '').split('.')[0];
  function tokenLooksLikeProjectToken(t: string): boolean {
    if (t === anonKey) return true;
    try {
      const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload?.ref === projectRef || String(payload?.iss ?? '').includes(projectRef);
    } catch { return false; }
  }
  if (!token || !tokenLooksLikeProjectToken(token)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!CMC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'CMC_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const res = await fetch(
      `${CMC_URL}?start=1&limit=60&convert=USD&sort=market_cap`,
      { headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY } }
    );
    const json = await res.json();

    return new Response(JSON.stringify(json), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
