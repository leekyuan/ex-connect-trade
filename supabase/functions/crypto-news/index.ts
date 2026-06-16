import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

interface NewsItem {
  title: string;
  url: string;
  source: string;
  published_on: number;
  body: string;
}

interface CatalystResult {
  symbol: string;
  bullish: string[];
  bearish: string[];
  neutral: string[];
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sources: { title: string; url: string; source: string; time: string }[];
  fetchedAt: string;
}

function emptyResult(symbol: string, summary: string): CatalystResult {
  return {
    symbol,
    bullish: [],
    bearish: [],
    neutral: [],
    summary,
    sentiment: 'neutral',
    sources: [],
    fetchedAt: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    let isAuthenticated = false;
    if (authHeader?.startsWith('Bearer ')) {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: claimsData, error: claimsErr } = await supabaseAuth.auth.getUser();
      isAuthenticated = !claimsErr && !!claimsData?.user?.id;
    }

    const { symbol } = await req.json().catch(() => ({ symbol: 'BTC' }));
    const sym = (symbol || 'BTC').toUpperCase().replace('USDT', '');

    // CryptoCompare free news endpoint (no key required for basic use)
    const newsUrl = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${encodeURIComponent(sym)}`;
    let newsJson: any = {};
    try {
      const newsRes = await fetch(newsUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LovableNewsBot/1.0)' },
      });
      if (!newsRes.ok) {
        console.error(`news upstream ${newsRes.status}`);
        return Response.json(
          emptyResult(sym, `${sym} 관련 뉴스 피드를 일시적으로 불러올 수 없습니다. 잠시 후 다시 시도하세요.`),
          { headers: corsHeaders },
        );
      }
      newsJson = await newsRes.json();
    } catch (fetchErr) {
      console.error('news fetch failed', fetchErr);
      return Response.json(
        emptyResult(sym, `${sym} 관련 뉴스 피드에 접근할 수 없습니다.`),
        { headers: corsHeaders },
      );
    }
    const raw: NewsItem[] = Array.isArray(newsJson?.Data) ? newsJson.Data : [];

    if (!raw.length) {
      const upstreamMessage = typeof newsJson?.Message === 'string'
        ? newsJson.Message
        : `${sym} 관련 24시간 내 주요 뉴스가 감지되지 않았습니다.`;

      return Response.json(emptyResult(sym, upstreamMessage), { headers: corsHeaders });
    }

    // 24h filter
    const dayAgo = Date.now() / 1000 - 24 * 3600;
    const recent = raw.filter((n) => n.published_on >= dayAgo).slice(0, 12);

    if (!recent.length) {
      return Response.json(
        emptyResult(sym, `${sym} 관련 24시간 내 주요 뉴스가 감지되지 않았습니다.`),
        { headers: corsHeaders },
      );
    }

    if (!isAuthenticated) {
      return Response.json({
        symbol: sym,
        bullish: [],
        bearish: [],
        neutral: [],
        summary: `${sym} 관련 최근 뉴스 ${recent.length}건을 불러왔습니다. 로그인하면 AI 분류 요약까지 함께 볼 수 있습니다.`,
        sentiment: 'neutral',
        sources: recent.slice(0, 8).map((n) => ({
          title: n.title,
          url: n.url,
          source: n.source,
          time: new Date(n.published_on * 1000).toISOString(),
        })),
        fetchedAt: new Date().toISOString(),
      } satisfies CatalystResult, { headers: corsHeaders });
    }

    const headlines = recent.map((n, i) => `${i + 1}. [${n.source}] ${n.title}`).join('\n');

    // Only signed-in users get AI summarization/classification to protect quota usage.
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY missing');

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `암호화폐 ${sym} 관련 24시간 뉴스 헤드라인을 분석해 호재/악재/중립으로 분류하고 한국어로 간결히 요약합니다. 반드시 JSON으로만 답하세요.`,
          },
          {
            role: 'user',
            content: `다음 ${sym} 관련 헤드라인:\n${headlines}\n\nJSON 스키마: {"bullish":string[],"bearish":string[],"neutral":string[],"summary":string,"sentiment":"bullish"|"bearish"|"neutral"}\n각 항목은 헤드라인을 한 줄 한국어 요약으로 (최대 5개씩). summary는 2~3문장. sentiment는 전반적 톤.`,
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      throw new Error(`Lovable AI ${aiRes.status}: ${text.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const out: CatalystResult = {
      symbol: sym,
      bullish: Array.isArray(parsed.bullish) ? parsed.bullish.slice(0, 5) : [],
      bearish: Array.isArray(parsed.bearish) ? parsed.bearish.slice(0, 5) : [],
      neutral: Array.isArray(parsed.neutral) ? parsed.neutral.slice(0, 5) : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      sentiment: ['bullish', 'bearish', 'neutral'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral',
      sources: recent.slice(0, 8).map((n) => ({
        title: n.title,
        url: n.url,
        source: n.source,
        time: new Date(n.published_on * 1000).toISOString(),
      })),
      fetchedAt: new Date().toISOString(),
    };

    return Response.json(out, { headers: corsHeaders });
  } catch (e: any) {
    return Response.json(
      { error: e?.message ?? 'unknown error' },
      { status: 500, headers: corsHeaders },
    );
  }
});
