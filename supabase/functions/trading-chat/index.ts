// AI 트레이딩 어시스턴트 (스트리밍)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `당신은 한국어로 답변하는 친절한 암호화폐 트레이딩 코치입니다.
- 사용자는 6대 이론(엘리어트·다우·와이코프·갠·피보나치·ICT)과 기본적 분석을 사용하는 트레이딩 터미널을 운용합니다.
- 신호, 진입가, 손절(SL), 익절(TP), 리스크 관리, 레버리지, 포지션 사이즈, 백테스트 해석, 차트 패턴, 시장 심리에 대한 질문에 답하세요.
- 투자 자문이 아닌 교육 목적임을 적절히 안내하되, 실용적이고 구체적인 조언을 제공합니다.
- 답변은 마크다운으로 작성하고, 핵심 포인트는 굵게 표시하세요. 장황하지 않게 간결하게.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const sysContent = context
      ? `${SYSTEM_PROMPT}\n\n[현재 시장 컨텍스트]\n${context}`
      : SYSTEM_PROMPT;

    const upstream = await fetch(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: sysContent },
            ...(messages ?? []),
          ],
          stream: true,
        }),
      }
    );

    if (!upstream.ok) {
      const status = upstream.status;
      let msg = 'AI gateway error';
      if (status === 429) msg = '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
      else if (status === 402) msg = 'AI 크레딧이 부족합니다. Workspace Usage에서 충전해 주세요.';
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (e) {
    console.error('trading-chat error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
