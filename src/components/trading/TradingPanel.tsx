import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExchangeSelector } from "./ExchangeSelector";
import { ApiKeyForm } from "./ApiKeyForm";
import { TradeParamsDisplay } from "./TradeParamsDisplay";
import { TpSplitControl } from "./TpSplitControl";
import { supabase } from "@/integrations/supabase/client";
import type { Exchange, TradeParams } from "@/types/trading";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { isDemoMode } from "@/contexts/DemoModeContext";
import { useGlobalSafety } from "@/hooks/useGlobalSafety";

interface TradingPanelProps {
  tradeParams: TradeParams;
}

function makeIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function TradingPanel({ tradeParams }: TradingPanelProps) {
  const [exchange, setExchange] = useState<Exchange>("binance");
  const [tpSplit, setTpSplit] = useState(50);
  const [executing, setExecuting] = useState(false);
  const safety = useGlobalSafety();
  const liveBlocked = isDemoMode() || safety.paperMode || safety.state !== "LIVE_READY";

  const params = { ...tradeParams, tpSplitRatio: tpSplit };

  const handleExecute = async () => {
    if (liveBlocked) {
      toast.error("실거래 차단됨 — Demo/Paper Mode 또는 Safety Gate 미통과 상태입니다");
      return;
    }
    setExecuting(true);
    try {
      const { data, error } = await supabase.functions.invoke("execute-trade", {
        body: {
          exchange,
          ...params,
          idempotencyKey: makeIdempotencyKey(),
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("자동 매매 주문이 실행되었습니다!", {
          description: `${exchange.toUpperCase()} - ${params.symbol}`,
        });
      } else {
        throw new Error(data?.error || "주문 실행 실패");
      }
    } catch (err: any) {
      toast.error("주문 실행에 실패했습니다", {
        description: err.message,
      });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="w-full max-w-sm bg-card border border-border rounded-lg p-5 space-y-5">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Zap className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">자동 매매 실행</h2>
      </div>

      <ExchangeSelector value={exchange} onChange={setExchange} />
      <ApiKeyForm exchange={exchange} />
      <TradeParamsDisplay params={params} />
      <TpSplitControl value={tpSplit} onChange={setTpSplit} />

      <Button
        variant="execute"
        size="lg"
        className="w-full"
        onClick={handleExecute}
        disabled={executing}
      >
        {executing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            주문 실행 중...
          </>
        ) : (
          <>
            <Zap className="h-5 w-5" />
            자동 매매 실행
          </>
        )}
      </Button>
    </div>
  );
}
