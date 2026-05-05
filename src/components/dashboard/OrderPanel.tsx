import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Zap, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import type { Exchange } from "@/types/trading";

interface OrderPanelProps {
  exchange: Exchange;
}

const ACCOUNT_USDT = 10000; // mock account balance for risk calc

export function OrderPanel({ exchange }: OrderPanelProps) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [leverage, setLeverage] = useState(10);
  const [orderSize, setOrderSize] = useState("1000");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [executing, setExecuting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ATR-based auto SL/TP preview (mock ATR = 1% of entry price)
  const autoPreview = useMemo(() => {
    const ep = parseFloat(entryPrice);
    if (!ep) return null;
    const atr = ep * 0.01;
    const sl = side === "buy" ? ep - atr * 1.5 : ep + atr * 1.5;
    const tp = side === "buy" ? ep + atr * 1.5 * 2 : ep - atr * 1.5 * 2;
    return { sl, tp };
  }, [entryPrice, side]);

  // Estimated loss calculation
  const lossEstimate = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const sl = stopLoss ? parseFloat(stopLoss) : autoPreview?.sl ?? 0;
    const size = parseFloat(orderSize);
    if (!ep || !sl || !size) return null;
    const lossPct = side === "buy" ? (sl / ep - 1) : (ep / sl - 1);
    const lossUsdt = size * lossPct * leverage;
    const accountPct = (lossUsdt / ACCOUNT_USDT) * 100;
    return { lossUsdt, accountPct };
  }, [entryPrice, stopLoss, orderSize, leverage, side, autoPreview]);

  const handleExecute = async () => {
    setConfirmOpen(false);
    setExecuting(true);
    try {
      const entry = parseFloat(entryPrice);
      const size = parseFloat(orderSize);
      const sl = stopLoss ? parseFloat(stopLoss) : autoPreview?.sl ?? entry * (side === "buy" ? 0.97 : 1.03);
      const tp = takeProfit ? parseFloat(takeProfit) : autoPreview?.tp ?? entry * (side === "buy" ? 1.05 : 0.95);

      const { data, error } = await supabase.functions.invoke("execute-trade", {
        body: {
          exchange,
          symbol: "BTCUSDT",
          entry,
          tp1: tp,
          tp2: tp * (side === "buy" ? 1.02 : 0.98),
          sl,
          tpSplitRatio: 50,
          leverage,
          positionSize: size,
        },
      });

      if (error) throw error;
      if (data?.success) {
        toast.success(`${side === "buy" ? "매수" : "매도"} 주문이 실행되었습니다!`);
      } else {
        throw new Error(data?.error || "주문 실패");
      }
    } catch (err: any) {
      toast.error("주문 실행 실패: " + err.message);
    } finally {
      setExecuting(false);
    }
  };

  const onSubmit = () => {
    if (!entryPrice || !orderSize) {
      toast.error("주문 가격과 수량을 입력해주세요.");
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        주문
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={side === "buy" ? "default" : "outline"}
          className={side === "buy" ? "bg-success hover:bg-success/90 text-success-foreground" : ""}
          onClick={() => setSide("buy")}
        >
          <TrendingUp className="h-4 w-4 mr-1" />
          매수 (Long)
        </Button>
        <Button
          variant={side === "sell" ? "default" : "outline"}
          className={side === "sell" ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}
          onClick={() => setSide("sell")}
        >
          <TrendingDown className="h-4 w-4 mr-1" />
          매도 (Short)
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">레버리지</span>
          <span className="text-foreground font-mono font-bold">{leverage}x</span>
        </div>
        <Slider
          value={[leverage]}
          onValueChange={(v) => setLeverage(v[0])}
          min={1}
          max={125}
          step={1}
        />
        <div className="flex gap-1">
          {[1, 5, 10, 25, 50, 100].map((v) => (
            <button
              key={v}
              onClick={() => setLeverage(v)}
              className={`flex-1 text-[10px] py-1 rounded font-mono ${
                leverage === v ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}x
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">주문 금액 (USDT)</label>
        <Input
          type="number"
          value={orderSize}
          onChange={(e) => setOrderSize(e.target.value)}
          className="bg-input border-border font-mono text-sm"
          placeholder="1000"
        />
        <div className="flex gap-1">
          {[10, 25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => setOrderSize((10000 * pct / 100).toString())}
              className="flex-1 text-[10px] py-1 rounded bg-accent text-muted-foreground hover:text-foreground font-mono"
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">진입 가격</label>
        <Input
          type="number"
          value={entryPrice}
          onChange={(e) => setEntryPrice(e.target.value)}
          className="bg-input border-border font-mono text-sm"
          placeholder="104,250"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">손절 (SL)</label>
          <Input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            className="bg-input border-border font-mono text-sm"
            placeholder={autoPreview ? `자동 ${autoPreview.sl.toFixed(2)}` : "자동"}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">익절 (TP)</label>
          <Input
            type="number"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            className="bg-input border-border font-mono text-sm"
            placeholder={autoPreview ? `자동 ${autoPreview.tp.toFixed(2)}` : "자동"}
          />
        </div>
      </div>

      {autoPreview && (
        <p className="text-[10px] text-muted-foreground">
          ATR 기반 자동값 — SL: <span className="text-destructive font-mono">{autoPreview.sl.toFixed(2)}</span> · TP: <span className="text-success font-mono">{autoPreview.tp.toFixed(2)}</span>
        </p>
      )}

      {lossEstimate && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
          <span className="text-muted-foreground">예상 손실: </span>
          <span className="font-mono font-bold text-destructive">
            -${Math.abs(lossEstimate.lossUsdt).toFixed(2)}
          </span>
          <span className="text-muted-foreground"> (계좌의 </span>
          <span className="font-mono font-bold text-destructive">
            {Math.abs(lossEstimate.accountPct).toFixed(2)}%
          </span>
          <span className="text-muted-foreground">)</span>
        </div>
      )}

      <Button
        className={`w-full ${
          side === "buy"
            ? "bg-success hover:bg-success/90 text-success-foreground"
            : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        }`}
        size="lg"
        onClick={onSubmit}
        disabled={executing}
      >
        {executing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Zap className="h-4 w-4" />
            {side === "buy" ? "매수 실행" : "매도 실행"}
          </>
        )}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>주문 실행 확인</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 pt-2 text-sm">
                <p>
                  <b>BTC ${parseFloat(orderSize || "0").toLocaleString()}</b>{" "}
                  <span className={side === "buy" ? "text-success" : "text-destructive"}>
                    {side === "buy" ? "Long" : "Short"} {leverage}x
                  </span>{" "}
                  진입하시겠습니까?
                </p>
                <div className="rounded-md bg-muted p-2 text-xs space-y-1">
                  <div>진입가: ${parseFloat(entryPrice || "0").toLocaleString()}</div>
                  <div>SL: ${parseFloat(stopLoss || (autoPreview?.sl?.toFixed(2) ?? "0")).toLocaleString()}</div>
                  <div>TP: ${parseFloat(takeProfit || (autoPreview?.tp?.toFixed(2) ?? "0")).toLocaleString()}</div>
                  {lossEstimate && (
                    <div className="text-destructive font-bold">
                      예상 손실: -${Math.abs(lossEstimate.lossUsdt).toFixed(2)} ({Math.abs(lossEstimate.accountPct).toFixed(2)}%)
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleExecute}>확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
