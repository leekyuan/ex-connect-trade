import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DisclaimerBar } from "@/components/today/DisclaimerBar";
import { VerificationCard } from "@/components/verification/VerificationCard";
import { useSearchParams } from "react-router-dom";
import { useMemo } from "react";

export default function VerificationPage() {
  const [sp] = useSearchParams();
  const symbol = sp.get("symbol");
  const symbols = useMemo(() => symbol ? [symbol] : ["BTCUSDT", "ETHUSDT"], [symbol]);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <DisclaimerBar />
        <div>
          <h1 className="text-xl font-bold tracking-tight">전략 검증</h1>
          <p className="text-xs text-muted-foreground">백테스트 기반 신호 검증 · 7대 품질 기준 통과 시에만 실거래 권장</p>
        </div>
        <div className="space-y-4">
          {symbols.map(s => <VerificationCard key={s} symbol={s} />)}
        </div>
      </div>
    </DashboardLayout>
  );
}
