// AI Market Summary via Lovable AI Gateway (google/gemini-2.5-flash)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } =
      await supabase.auth.getUser();
    if (claimsErr || !claims?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { coins } = await req.json().catch(() => ({ coins: [] }));
    if (!Array.isArray(coins) || coins.length === 0) {
      return new Response(JSON.stringify({ error: "coins required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const top15 = coins
      .slice(0, 15)
      .map(
        (c: any) =>
          `${c.symbol}: $${Number(c.price ?? 0).toFixed(2)}, 1h:${Number(c.percent_change_1h ?? 0).toFixed(1)}%, 24h:${Number(c.percent_change_24h ?? 0).toFixed(1)}%, 7d:${Number(c.percent_change_7d ?? 0).toFixed(1)}%`,
      )
      .join("\n");

    const systemPrompt =
      "당신은 한국어로 답변하는 암호화폐 퀀트 트레이더입니다. 간결하고 실용적으로 작성하세요.";
    const userPrompt = `아래는 현재 시총 상위 코인들의 실시간 가격 데이터입니다:

${top15}

다음 형식으로 한국어 시황 분석을 작성해주세요 (마크다운 사용):

1. **전체 시장 요약** (2문장)
2. **오늘의 주목 코인 TOP 3** (각 코인명 + 한 줄 이유)
3. **단타 매매 관점** (2문장)
4. **스윙 매매 관점** (2문장)
5. **리스크 경고** (있다면 1문장)`;

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      },
    );

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({
            error: "AI 호출 한도 초과 — 잠시 후 다시 시도해주세요.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "AI 크레딧이 부족합니다. 워크스페이스 설정에서 크레딧을 충전해주세요.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const txt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, txt);
      return new Response(
        JSON.stringify({ error: "AI 게이트웨이 오류" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await aiRes.json();
    const summary =
      data?.choices?.[0]?.message?.content ?? "시황 분석을 불러올 수 없습니다.";

    return new Response(
      JSON.stringify({ summary, generated_at: new Date().toISOString() }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("ai-market-summary fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
