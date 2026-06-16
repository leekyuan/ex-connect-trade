import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { computeUnifiedSignal, type UnifiedSignal } from "@/utils/unifiedSignal";
import { fetchKlines } from "@/utils/backtest";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, AlertTriangle } from "lucide-react";

type SignalState = "LONG_READY" | "SHORT_READY" | "WAIT" | "NO_TRADE";

const STATE_META: Record<SignalState, { label: string; tone: string; bg: string; ring: string }> = {
  LONG_READY:  { label: "LONG READY",  tone: "text-emerald-300", bg: "bg-emerald-500/15", ring: "ring-emerald-500/40" },
  SHORT_READY: { label: "SHORT READY", tone: "text-red-300",     bg: "bg-red-500/15",     ring: "ring-red-500/40" },
  WAIT:        { label: "WAIT",        tone: "text-amber-300",   bg: "bg-amber-500/15",   ring: "ring-amber-500/30" },
  NO_TRADE:    { label: "NO TRADE",    tone: "text-muted-foreground", bg: "bg-muted/40",  ring: "ring-border" },
};

interface Props {
  symbol: "BTC" | "ETH";
}

function fmt(n: number, sym: "BTC" | "ETH") {
  return n.toLocaleString("en-US", { maximumFractionDigits: sym === "BTC" ? 1 : 2 });
}

export function TodaySignalCard({ symbol }: Props) {
  const [sig, setSig] = useState<UnifiedSignal | null>(null);
  const [price, setPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const end = Date.now();
        const start = end - 30 * 86400_000;
        const candles = await fetchKlines(symbol, "1h", start, end);
        if (!alive || candles.length < 60) throw new Error("데이터 부족");
        const last = candles[candles.length - 1].close;
        const s = computeUnifiedSignal(candles, last);
        if (!alive) return;
        setSig(s);
        setPrice(last);

        // 진입 금지 사유 (간단 휴리스틱)
        const b: string[] = [];
        if (s) {
          if (s.details.adx < 18) b.push("ADX 18 미만 — 횡보장 (추세 약함)");
          if (s.label === "WATCH") b.push("통합 점수 중립 — 방향성 미확정");
          if (s.score >= 25 && s.score < 40) b.push("최근 백테스트 기준 미달 — 모의검증 필요");
        }
        setBlockers(b);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "데이터 로드 실패");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [symbol]);

  let state: SignalState = "NO_TRADE";
  if (sig) {
    if (sig.label === "STRONG_BUY" || sig.label === "BUY") state = "LONG_READY";
    else if (sig.label === "STRONG_SELL" || sig.label === "SELL") state = "SHORT_READY";
    else state = blockers.length > 1 ? "NO_TRADE" : "WAIT";
  }
  // 블로커가 있으면 강제로 WAIT/NO_TRADE
  if (blockers.length >= 2 && (state === "LONG_READY" || state === "SHORT_READY")) {
    state = "WAIT";
  }
  const meta = STATE_META[state];

  const isLong = state === "LONG_READY";
  const isShort = state === "SHORT_READY";

  // EP1/EP2 — entry 기준으로 살짝 분산
  const ep1 = sig?.entry ?? price;
  const ep2 = sig ? (isLong ? sig.entry * 0.997 : isShort ? sig.entry * 1.003 : sig.entry) : price;
  const tp1 = sig?.tp1 ?? 0;
  const tp2 = sig?.tp2 ?? 0;
  const tp3 = sig ? (isLong ? sig.tp2 * 1.01 : isShort ? sig.tp2 * 0.99 : 0) : 0;
  const sl = sig?.sl ?? 0;
  const risk = sig ? Math.abs(ep1 - sl) : 0;
  const reward = sig ? Math.abs(tp1 - ep1) : 0;
  const rr = risk > 0 ? reward / risk : 0;

  // TP1 확률(휴리스틱 — score 기반)
  const tp1Prob = sig ? Math.min(82, Math.max(35, Math.round(sig.score * 0.85))) : 0;

  return (
    <Card className={`p-4 border ring-1 ${meta.ring} ${meta.bg} relative overflow-hidden`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-lg font-bold tracking-tight">{symbol}/USDT</h3>
          <span className="text-xs text-muted-foreground font-mono">선물 · 1h</span>
        </div>
        <Badge variant="outline" className={`${meta.tone} border-current font-bold tracking-wider text-[11px]`}>
          {meta.label}
        </Badge>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin" /> 신호 계산 중...
        </div>
      )}

      {err && !loading && (
        <div className="text-sm text-muted-foreground py-6">잠시 후 다시 시도해주세요.</div>
      )}

      {sig && !loading && !err && (
        <>
          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-2xl font-bold font-mono tabular-nums">${fmt(price, symbol)}</span>
            <span className="text-xs text-muted-foreground font-mono">통합점수 {sig.score}/100</span>
          </div>

          {/* Levels grid */}
          <div className="grid grid-cols-2 gap-2 mb-3 text-xs font-mono">
            <div className="rounded border border-border/60 bg-background/40 p-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Entry</div>
              <div className="flex justify-between"><span className="text-muted-foreground">EP1</span><span className="tabular-nums">${fmt(ep1, symbol)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">EP2</span><span className="tabular-nums">${fmt(ep2, symbol)}</span></div>
            </div>
            <div className="rounded border border-red-500/30 bg-red-500/5 p-2">
              <div className="text-[10px] text-red-300/80 uppercase tracking-wider mb-1">Stop</div>
              <div className="flex justify-between"><span className="text-muted-foreground">SL</span><span className="tabular-nums text-red-300">${fmt(sl, symbol)}</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Risk</span><span className="tabular-nums">${fmt(risk, symbol)}</span></div>
            </div>
            <div className="col-span-2 rounded border border-emerald-500/30 bg-emerald-500/5 p-2 grid grid-cols-3 gap-2">
              <div>
                <div className="text-[10px] text-emerald-300/80 uppercase tracking-wider">TP1</div>
                <div className="tabular-nums text-emerald-300">${fmt(tp1, symbol)}</div>
              </div>
              <div>
                <div className="text-[10px] text-emerald-300/80 uppercase tracking-wider">TP2</div>
                <div className="tabular-nums text-emerald-300">${fmt(tp2, symbol)}</div>
              </div>
              <div>
                <div className="text-[10px] text-emerald-300/80 uppercase tracking-wider">TP3</div>
                <div className="tabular-nums text-emerald-300/80">${fmt(tp3, symbol)}</div>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-4 gap-2 text-[11px] font-mono mb-3">
            <Metric label="R:R" value={rr.toFixed(2)} />
            <Metric label="TP1 확률" value={`${tp1Prob}%`} />
            <Metric label="ADX" value={sig.details.adx.toFixed(0)} />
            <Metric label="RSI" value={sig.details.rsi?.toFixed(0) ?? "—"} />
          </div>

          {/* Blockers */}
          {blockers.length > 0 && (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-200/90 mb-3 space-y-1">
              {blockers.map((b, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              ※ 진입 전 <Link to="/verification" className="underline">전략 검증</Link> 결과 확인
            </span>
            <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
              <Link to={`/verification?symbol=${symbol}USDT`}>
                전략 검증 보기 <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-background/30 border border-border/50 px-2 py-1.5">
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="tabular-nums font-semibold">{value}</div>
    </div>
  );
}
