import { useEffect, useRef } from "react";
import type { CoinAnalysis, TradingMode } from "./useMarketAnalysis";
import { useTelegramSettings } from "./useTelegramSettings";
import { sendTelegram, buildSignalMessage } from "@/lib/telegram";

const MODE_LABEL: Record<TradingMode, string> = {
  scalping: "스캘핑",
  daytrading: "단타",
  swing: "스윙",
};

/**
 * Detects WATCH → LONG/SHORT transitions and sends Telegram notifications
 * when the user has enabled telegram alerts for the given mode.
 */
export function useSignalTelegramAlerts(
  analyses: CoinAnalysis[],
  mode: TradingMode,
) {
  const { settings } = useTelegramSettings();
  const prevSignals = useRef<Map<string, "LONG" | "SHORT" | "WATCH">>(
    new Map(),
  );
  const sentKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!settings?.enabled || !settings.chat_id) {
      // Still update prev so we don't blast alerts when toggled on later
      const next = new Map<string, "LONG" | "SHORT" | "WATCH">();
      analyses.forEach((a) => next.set(a.coin.symbol, a.signal));
      prevSignals.current = next;
      return;
    }

    const modeAllowed =
      (mode === "scalping" && settings.notify_scalping) ||
      (mode === "daytrading" && settings.notify_daytrading) ||
      (mode === "swing" && settings.notify_swing);

    if (!modeAllowed) {
      const next = new Map<string, "LONG" | "SHORT" | "WATCH">();
      analyses.forEach((a) => next.set(a.coin.symbol, a.signal));
      prevSignals.current = next;
      return;
    }

    const next = new Map<string, "LONG" | "SHORT" | "WATCH">();
    analyses.forEach((a) => {
      const prev = prevSignals.current.get(a.coin.symbol) ?? "WATCH";
      next.set(a.coin.symbol, a.signal);

      const isNewDirection =
        (a.signal === "LONG" || a.signal === "SHORT") && prev !== a.signal;
      if (!isNewDirection) return;
      if (a.confidence < settings.min_confidence) return;

      // dedupe per (symbol+signal+mode) within this session
      const key = `${a.coin.symbol}-${mode}-${a.signal}-${Math.floor(Date.now() / (15 * 60 * 1000))}`;
      if (sentKeys.current.has(key)) return;
      sentKeys.current.add(key);

      const direction = a.signal as "LONG" | "SHORT";
      const msg = buildSignalMessage({
        symbol: a.coin.symbol,
        signal: direction,
        modeLabel: MODE_LABEL[mode],
        price: a.coin.price,
        entry: direction === "LONG" ? a.longEntry : a.shortEntry,
        tp1: a.tp1,
        tp2: a.tp2,
        stopLoss: a.stopLoss,
        confidence: a.confidence,
        riskReward: a.riskReward,
        reasoning: a.reasoning[0] ?? "",
      });
      sendTelegram({ chat_id: settings.chat_id, message: msg });
    });

    prevSignals.current = next;
  }, [analyses, mode, settings]);
}
