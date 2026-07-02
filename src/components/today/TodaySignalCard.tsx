import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { computeUnifiedSignal, type UnifiedSignal } from "@/utils/unifiedSignal";
import { fetchKlines } from "@/utils/backtest";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, ChevronDown, ChevronUp, AlertTriangle, Ban } from "lucide-react";
import { BlockedReasonPanel } from "@/components/common/BlockedReasonPanel";
import { SafetyStatusBadge } from "@/components/common/SafetyStatusBadge";
import type { EligibilityResult } from "@/utils/tradeEligibility";
import { useGlobalSafety, SAFETY_META, type SafetyState } from "@/hooks/useGlobalSafety";

interface Props {
  symbol: "BTC" | "ETH";
  timeframe?: "1h" | "4h";
  variant?: "primary" | "secondary" | "experimental";
  eligibility?: EligibilityResult;
}

function fmt(n: number, sym: "BTC" | "ETH") {
  return n.toLocaleString("en-US", { maximumFractionDigits: sym === "BTC" ? 1 : 2 });
}

/** BTC/ETH 4H 데모 기본값: 현재 검증 미달 → BLOCKED. */
function defaultEligibility(symbol: "BTC" | "ETH"): EligibilityResult {
  const isBTC = symbol === "BTC";
  return {
    state: "BLOCKED",
    hardBlock: true,
    passCount: 0,
    totalGates: 7,
    reasons: isBTC
      ? [
          "Profit Factor 0.56 < 최소 기준 1.30",
          "Avg R -0.19 < 최소 기준 +0.07",
          "OOS PF 0.64 < 최소 기준 1.20",
          "Rolling30 PF 0.38 < 최소 기준 1.10",
          "Max DD 761R > 허용 기준 10R",
        ]
      : [
          "Profit Factor 0.82 < 최소 기준 1.30",
          "Avg R -0.06 < 최소 기준 +0.07",
          "OOS PF 0.76 < 최소 기준 1.20",
          "Rolling30 PF 0.26 < 최소 기준 1.10",
        ],
  };
}

export function TodaySignalCard({ symbol, timeframe = "1h", variant = "primary", eligibility }: Props) {
  const [sig, setSig] = useState<UnifiedSignal | null>(null);
  const [price, setPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [showLevels, setShowLevels] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const end = Date.now();
        const days = timeframe === "4h" ? 90 : 30;
        const start = end - days * 86400_000;
        const candles = await fetchKlines(symbol, timeframe, start, end);
        if (!alive || candles.length < 60) throw new Error("데이터 부족");
        const last = candles[candles.length - 1].close;
        const s = computeUnifiedSignal(candles, last);
        if (!alive) return;
        setSig(s);
        setPrice(last);

        const b: string[] = [];
        if (s) {
          if (s.details.adx < 18) b.push("ADX 18 미만 — 횡보장 (추세 약함)");
          if (s.label === "WATCH") b.push("통합 점수 중립 — 방향성 미확정");
        }
        setBlockers(b);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "데이터 로드 실패");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [symbol, timeframe]);

  const eff = eligibility ?? defaultEligibility(symbol);
  const safety = useGlobalSafety(eff);
  const safetyMeta = SAFETY_META[safety.state];
  const isBlocked = safety.state === "BLOCKED";

  // 방향성 참고 (BLOCKED여도 표시하되 "참고용"으로만)
  let directionBias: "LONG" | "SHORT" | "NEUTRAL" = "NEUTRAL";
  if (sig?.label === "STRONG_BUY" || sig?.label === "BUY") directionBias = "LONG";
  else if (sig?.label === "STRONG_SELL" || sig?.label === "SELL") directionBias = "SHORT";

  // 4단계 상태 라벨 (BLOCKED가 항상 우선)
  const stateLabel: SafetyState = safety.state;
  const stateLabelText = isBlocked ? "BLOCKED" : safetyMeta.short;

  const tfLabel = timeframe.toUpperCase();

  const ep1 = sig?.entry ?? price;
  const ep2 = sig ? (directionBias === "LONG" ? sig.entry * 0.997 : directionBias === "SHORT" ? sig.entry * 1.003 : sig.entry) : price;
  const tp1 = sig?.tp1 ?? 0;
  const tp2 = sig?.tp2 ?? 0;
  const tp3 = sig ? (directionBias === "LONG" ? sig.tp2 * 1.01 : directionBias === "SHORT" ? sig.tp2 * 0.99 : 0) : 0;
  const sl = sig?.sl ?? 0;
  const risk = sig ? Math.abs(ep1 - sl) : 0;
  const reward = sig ? Math.abs(tp1 - ep1) : 0;
  const rr = risk > 0 ? reward / risk : 0;
  const tp1Prob = sig ? Math.min(82, Math.max(35, Math.round(sig.score * 0.85))) : 0;

  return (
    <Card className={`p-4 border ring-1 ${safetyMeta.ring} ${safetyMeta.bg} relative overflow-hidden`}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="text-lg font-bold tracking-tight">{symbol}USDT</h3>
          <span className="text-[11px] text-muted-foreground font-mono">
            선물 · {tfLabel} · ALERT_ONLY
          </span>
          {variant === "secondary" && (
            <Badge variant="outline" className="text-[10px] border-border/60">보조 관찰</Badge>
          )}
          {variant === "experimental" && (
            <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-300">실험/고급 전략</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <SafetyStatusBadge state={stateLabel} />
          {directionBias !== "NEUTRAL" && (
            <Badge
              variant="outline"
              className={`text-[9px] border-border/60 ${
                isBlocked ? 'text-muted-foreground line-through decoration-1' :
                directionBias === "LONG" ? 'text-emerald-300' : 'text-red-300'
              }`}
              title={isBlocked ? "방향성 참고용 — 전략 검증 실패로 진입 차단" : ""}
            >
              {directionBias} {isBlocked && "(참고용)"}
            </Badge>
          )}
        </div>
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
          {isBlocked && (
            <div className="mb-3">
              <BlockedReasonPanel result={eff} />
            </div>
          )}

          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-2xl font-bold font-mono tabular-nums">${fmt(price, symbol)}</span>
            <span className="text-xs text-muted-foreground font-mono">통합점수 {sig.score}/100</span>
          </div>

          {isBlocked ? (
            <button
              onClick={() => setShowLevels(v => !v)}
              className="w-full text-left rounded border border-border/50 bg-background/40 p-2 mb-3 text-[11px] text-muted-foreground flex items-center justify-between hover:bg-background/60 transition"
            >
              <span>진입 가격 (EP/SL/TP) 보기 — <span className="text-red-300">실행 불가 · 참고용</span></span>
              {showLevels ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          ) : null}

          {(!isBlocked || showLevels) && (
            <div className={`grid grid-cols-2 gap-2 mb-3 text-xs font-mono ${isBlocked ? 'opacity-50 blur-[1.5px] hover:blur-0 transition' : ''}`}>
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
                <div><div className="text-[10px] text-emerald-300/80 uppercase tracking-wider">TP1</div><div className="tabular-nums text-emerald-300">${fmt(tp1, symbol)}</div></div>
                <div><div className="text-[10px] text-emerald-300/80 uppercase tracking-wider">TP2</div><div className="tabular-nums text-emerald-300">${fmt(tp2, symbol)}</div></div>
                <div><div className="text-[10px] text-emerald-300/80 uppercase tracking-wider">TP3</div><div className="tabular-nums text-emerald-300/80">${fmt(tp3, symbol)}</div></div>
              </div>
            </div>
          )}

          {!isBlocked && (
            <div className="grid grid-cols-4 gap-2 text-[11px] font-mono mb-3">
              <Metric label="R:R" value={rr.toFixed(2)} />
              <Metric label="TP1 확률" value={`${tp1Prob}%`} />
              <Metric label="ADX" value={sig.details.adx.toFixed(0)} />
              <Metric label="RSI" value={sig.details.rsi?.toFixed(0) ?? "—"} />
            </div>
          )}

          {!isBlocked && blockers.length > 0 && (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-200/90 mb-3 space-y-1">
              <div className="text-[10px] text-amber-300/80 font-semibold uppercase tracking-wider">진입 대기 사유 (WATCH)</div>
              {blockers.map((b, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          )}

          {/* 실행 버튼 — BLOCKED 시 비활성화 */}
          <div className="flex items-center justify-between gap-2">
            {isBlocked ? (
              <Button
                size="sm"
                variant="outline"
                disabled
                className="h-8 text-[11px] flex-1 border-red-500/40 text-red-300/70 bg-red-500/5 cursor-not-allowed"
                title="전략 검증 실패로 차단됨"
              >
                <Ban className="h-3 w-3 mr-1" />
                전략 검증 실패로 차단됨
              </Button>
            ) : safety.state === 'PAPER_READY' ? (
              <Button size="sm" variant="outline" disabled className="h-8 text-[11px] flex-1 border-sky-500/40 text-sky-300/80 bg-sky-500/5">
                Paper Mode에서 추가 검증 필요
              </Button>
            ) : (
              <span className="text-[10px] text-muted-foreground">
                ※ 진입 전 <Link to="/verification" className="underline">전략 검증</Link> 확인
              </span>
            )}
            <Button asChild size="sm" variant="ghost" className="h-8 text-[11px] shrink-0">
              <Link to={`/verification?symbol=${symbol}USDT`}>
                검증 상세 <ArrowRight className="ml-1 h-3 w-3" />
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
