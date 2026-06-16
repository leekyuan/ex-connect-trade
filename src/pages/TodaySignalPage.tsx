import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DisclaimerBar } from "@/components/today/DisclaimerBar";
import { TodaySignalCard } from "@/components/today/TodaySignalCard";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { LineChart, ShieldCheck } from "lucide-react";

export default function TodaySignalPage() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <DisclaimerBar />

        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">오늘의 신호</h1>
            <p className="text-xs text-muted-foreground">
              AI 기반 매매 의사결정 보조 · 백테스트 기반 신호 검증 · BTC / ETH 선물
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TodaySignalCard symbol="BTC" />
          <TodaySignalCard symbol="ETH" />
        </div>

        <div className="text-[11px] text-muted-foreground leading-relaxed pt-2 border-t border-border/40">
          신호 상태는 통합 매매 신호 엔진(기술/패턴/추세 100점)과 최근 30일 H1 캔들 기준으로 산출됩니다.
          진입 금지 사유가 표시될 경우 실거래 진입을 권장하지 않습니다.
          모든 신호는 <Link to="/legal/risk" className="underline">투자 유의사항</Link>을 사전에 확인한 사용자에게만 제공됩니다.
        </div>
      </div>
    </DashboardLayout>
  );
}
