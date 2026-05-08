import { Top30Heatmap } from "@/components/dashboard/Top30Heatmap";
import { TopSignalsCard } from "@/components/dashboard/TopSignalsCard";
import { FundingRateWidget } from "@/components/dashboard/FundingRateWidget";
import { FearGreedCard } from "@/components/dashboard/FearGreedCard";
import { FearGreedHistoryChart } from "@/components/dashboard/FearGreedHistoryChart";
import { PaperTradingPanel } from "@/components/dashboard/PaperTradingPanel";
import { LivePositionsPanel } from "@/components/dashboard/LivePositionsPanel";
import { AITradingAssistant } from "@/components/dashboard/AITradingAssistant";
import { TrendingUp } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="space-y-6">
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
