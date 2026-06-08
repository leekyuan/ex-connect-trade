import { Top30Heatmap } from "@/components/dashboard/Top30Heatmap";
import { TopSignalsCard } from "@/components/dashboard/TopSignalsCard";
import { FundingRateWidget } from "@/components/dashboard/FundingRateWidget";
import { FearGreedCard } from "@/components/dashboard/FearGreedCard";
import { FearGreedHistoryChart } from "@/components/dashboard/FearGreedHistoryChart";
import { PaperTradingPanel } from "@/components/dashboard/PaperTradingPanel";
import { LivePositionsPanel } from "@/components/dashboard/LivePositionsPanel";
import { AITradingAssistant } from "@/components/dashboard/AITradingAssistant";
import { FeatureLabel } from "@/components/common/FeatureLabel";
import { TrendingUp } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <FeatureLabel
        title="📊 사용자 대시보드"
        desc="시총 TOP30 실시간 히트맵 · 신호 카드 · 페이퍼 트레이딩 · AI 어시스턴트를 한눈에 볼 수 있는 메인 작업공간입니다."
        tip="히트맵의 코인을 클릭하면 '시장 분석' 페이지로 이동해 6대 이론 합의 신호를 확인할 수 있습니다."
      />
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" /> 시총 TOP 30 실시간 히트맵
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          CoinMarketCap + Binance 실시간 · 스테이블 자동 제외 · 클릭 시 시장 분석
        </p>
      </header>

      <Top30Heatmap />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <TopSignalsCard />
        <FundingRateWidget />
        <FearGreedCard />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <PaperTradingPanel />
        <LivePositionsPanel />
      </div>

      <FearGreedHistoryChart />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AITradingAssistant />
      </div>
    </div>
  );
}
