import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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
    const { symbol } = await req.json().catch(() => ({ symbol: 'BTC' }));
    const sym = (symbol || 'BTC').toUpperCase().replace('USDT', '');

    // CryptoCompare free news endpoint (no key required for basic use)
    const newsUrl = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${encodeURIComponent(sym)}`;
    const newsRes = await fetch(newsUrl);
    if (!newsRes.ok) throw new Error(`news upstream ${newsRes.status}`);
    const newsJson = await newsRes.json();
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

    const headlines = recent.map((n, i) => `${i + 1}. [${n.source}] ${n.title}`).join('\n');

    // Lovable AI summarize + classify
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
