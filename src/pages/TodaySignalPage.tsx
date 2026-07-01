import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DisclaimerBar } from "@/components/today/DisclaimerBar";
import { TodaySignalCard } from "@/components/today/TodaySignalCard";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { LineChart, ShieldCheck, ChevronDown, ChevronUp, FlaskConical } from "lucide-react";

export default function TodaySignalPage() {
  const [showExperimental, setShowExperimental] = useState(false);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <DisclaimerBar />

        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">오늘의 신호</h1>
            <p className="text-xs text-muted-foreground">
              검증된 신호만 통과시키는 안전 시스템 · BTC 4H 메인 · ETH 4H 보조 · 매매 의사결정 보조 도구
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="default" size="sm">
              <Link to="/verification"><LineChart className="h-3.5 w-3.5 mr-1" /> 전략 검증 보기</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/security"><ShieldCheck className="h-3.5 w-3.5 mr-1" /> API 보안</Link>
            </Button>
          </div>
        </div>

        {/* 메인 — BTC 4H */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            메인 신호 · BTC 4H
          </div>
          <TodaySignalCard symbol="BTC" timeframe="4h" variant="primary" />
        </section>

        {/* 보조 관찰 — ETH 4H */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            보조 관찰 · ETH 4H
          </div>
          <TodaySignalCard symbol="ETH" timeframe="4h" variant="secondary" />
        </section>

        {/* 실험/고급 — 1H (기본 숨김) */}
        <section className="space-y-2">
          <button
            onClick={() => setShowExperimental(v => !v)}
            className="w-full flex items-center justify-between rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200 hover:bg-amber-500/10 transition"
          >
            <span className="flex items-center gap-2 font-semibold uppercase tracking-wider">
              <FlaskConical className="h-3.5 w-3.5" />
              실험/고급 전략 · 1H 신호 (기본 숨김)
            </span>
            {showExperimental ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showExperimental && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TodaySignalCard symbol="BTC" timeframe="1h" variant="experimental" />
              <TodaySignalCard symbol="ETH" timeframe="1h" variant="experimental" />
            </div>
          )}
        </section>

        <div className="text-[11px] text-muted-foreground leading-relaxed pt-2 border-t border-border/40">
          신호 상태는 통합 매매 신호 엔진과 전략 검증 게이트(PF/OOS/AvgR 등)를 결합해 산출됩니다.
          <strong className="text-foreground/90"> 사용자가 가장 먼저 봐야 하는 것은 EP/TP/SL이 아니라 “거래 가능 여부” 입니다.</strong>
          {" "}본 서비스는 수익 보장 도구가 아니라 매매 의사결정 보조/검증 도구이며,
          {" "}<Link to="/legal/risk" className="underline">투자 유의사항</Link>을 사전에 확인한 사용자에게만 제공됩니다.
        </div>
      </div>
    </DashboardLayout>
  );
}
