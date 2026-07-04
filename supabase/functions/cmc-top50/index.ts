import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';



const CMC_API_KEY = Deno.env.get('CMC_API_KEY') ?? '';
const CMC_URL = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';

const STABLECOINS = new Set([
  // USD pegged
  'USDT','USDC','BUSD','DAI','TUSD','USDP','USDD','GUSD',
  'FRAX','LUSD','SUSD','FDUSD','PYUSD','USDE','CRVUSD',
  'MKUSD','GHO','USD1','USDX','CUSD','USDN','HUSD','MUSD',
  'USDJ','OUSD','ALUSD','DOLA','MAI','MIM','BEAN','USDS',
  'USDM','ZUSD','FLEXUSD',
  // EUR pegged
  'EURS','EURT','EUROC','STEUR',
  // Wrapped stables
  'WLFI','WUSDT','WUSDC',
  // LST (Liquid Staking Tokens)
  'STETH','RETH','CBETH','WBETH','BETH','FRXETH','SFRXETH',
  'WSTETH','SWETH','ANKRETH','OSETH',
  // BTC wrapped
  'WBTC','BTCB','HBTC','RENBTC',
]);

function isStable(c: any): boolean {
  if (STABLECOINS.has(c.symbol)) return true;
  const nameLower = (c.name || '').toLowerCase();
  if (nameLower.includes('usd') && !nameLower.includes('bittensor')) return true;
  if (nameLower.includes('stablecoin')) return true;
  if (nameLower.includes('pegged')) return true;
  if (nameLower.includes('wrapped') && !nameLower.includes('bnb')) return true;
  if (c.symbol.startsWith('USD') || c.symbol.endsWith('USD')) return true;
  return false;
}

async function fetchCMC(sort: 'market_cap' | 'volume_24h', limit = 80) {
  const res = await fetch(
    `${CMC_URL}?start=1&limit=${limit}&convert=USD&sort=${sort}`,
    { headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY } }
  );
  if (!res.ok) throw new Error(`CMC ${sort} HTTP ${res.status}`);
  const json = await res.json();
  return (json.data ?? []) as any[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Require authenticated user — prevents anonymous CMC quota drain
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const authSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await authSupabase.auth.getUser();
  if (userErr || !userData?.user?.id) {
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
    const [byCap, byVol] = await Promise.all([
      fetchCMC('market_cap', 80),
      fetchCMC('volume_24h', 80),
    ]);

    // Filter stablecoins first, then assign 1..N rank
    const capFiltered = byCap.filter(c => !isStable(c)).slice(0, 30);
    const volFiltered = byVol.filter(c => !isStable(c)).slice(0, 30);

    const capRank = new Map<number, number>();
    capFiltered.forEach((c, i) => capRank.set(c.id, i + 1));
    const volRank = new Map<number, number>();
    volFiltered.forEach((c, i) => volRank.set(c.id, i + 1));

    // Merge unique coins
    const merged = new Map<number, any>();
    [...capFiltered, ...volFiltered].forEach(c => {
      if (!merged.has(c.id)) merged.set(c.id, c);
    });

    const enriched = [...merged.values()].map(c => {
      const rc = capRank.get(c.id) ?? 999;
      const rv = volRank.get(c.id) ?? 999;
      return {
        ...c,
        rank_by_cap: rc,
        rank_by_volume: rv,
        is_top_cap: rc <= 30,
        is_top_volume: rv <= 30,
      };
    });

    enriched.sort((a, b) => {
      const aMin = Math.min(a.rank_by_cap, a.rank_by_volume);
      const bMin = Math.min(b.rank_by_cap, b.rank_by_volume);
      return aMin - bMin;
    });

    const limited = enriched.slice(0, 50);

    return new Response(JSON.stringify({ data: limited }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
