import { supabase } from "@/integrations/supabase/client";

export interface TelegramSendOptions {
  chat_id: string;
  message: string;
}

/** Send a Telegram message via the send-telegram edge function. */
export async function sendTelegram({
  chat_id,
  message,
}: TelegramSendOptions): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("send-telegram", {
      body: { chat_id, message },
    });
    if (error) return { ok: false, error: error.message };
    if (data?.error) return { ok: false, error: data.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function buildSignalMessage(args: {
  symbol: string;
  signal: "LONG" | "SHORT";
  modeLabel: string;
  price: number;
  entry: number | null;
  tp1: number;
  tp2: number;
  stopLoss: number;
  confidence: number;
  riskReward: number;
  reasoning: string;
}): string {
  const fmt = (n: number | null) =>
    n == null ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  const arrow = args.signal === "LONG" ? "🟢 LONG" : "🔴 SHORT";
  return `<b>${arrow} 신호 — ${args.symbol}/USDT</b>

📊 모드: ${args.modeLabel}
💰 현재가: ${fmt(args.price)}
🎯 진입가: ${fmt(args.entry)}
✅ TP1: ${fmt(args.tp1)}
🚀 TP2: ${fmt(args.tp2)}
🛡️ SL: ${fmt(args.stopLoss)}
📈 신뢰도: ${args.confidence}%
⚖️ RR: 1:${args.riskReward}

📝 ${args.reasoning}

<i>CryptoEdge AI • autobottrading.lovable.app</i>`;
}
