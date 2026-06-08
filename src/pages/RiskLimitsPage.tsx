import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge } from "lucide-react";

const LIMITS = [
  { name: "1회 거래당 최대 손실", value: "1.5%", desc: "총 자본 대비. Kelly 사이징과 결합", level: "필수" },
  { name: "일일 누적 최대 손실", value: "3.0%", desc: "도달 시 당일 자동매매 중단", level: "필수" },
  { name: "주간 최대 손실", value: "8.0%", desc: "도달 시 전략 재평가 필요", level: "권장" },
  { name: "최대 레버리지", value: "10x", desc: "초보자는 3x 이하 권장", level: "필수" },
  { name: "동시 보유 포지션", value: "3개", desc: "리스크 분산 + 집중도 관리", level: "권장" },
  { name: "연속 손실 시 사이징 축소", value: "3회 → 50%", desc: "Kelly + drawdown brake", level: "자동" },
  { name: "단일 종목 노출 상한", value: "총 자본 25%", desc: "한 코인 청산이 계좌 파괴 못 하게", level: "권장" },
];

const COLOR: Record<string, string> = {
  필수: "text-red-400",
  권장: "text-amber-400",
  자동: "text-primary",
};

export default function RiskLimitsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Gauge className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">리스크 제한 기본값</h1>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">기본 적용 규칙</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {LIMITS.map(l => (
                <div key={l.name} className="py-3 flex items-center gap-4 text-sm">
                  <div className="flex-1">
                    <div className="font-semibold">{l.name}</div>
                    <div className="text-xs text-muted-foreground">{l.desc}</div>
                  </div>
                  <div className="text-lg font-mono font-bold">{l.value}</div>
                  <div className={`text-xs font-bold w-12 text-right ${COLOR[l.level]}`}>{l.level}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-base">왜 이렇게 설정되어 있나요?</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><b>1.5%/3.0% 룰</b> — 통계적으로 트레이더 파산 확률을 1% 이하로 유지하는 보수적 값입니다. 연속 20회 손실해도 자본의 26%만 잃습니다.</p>
            <p><b>10x 상한</b> — Binance 권장 최대치(125x) 대비 매우 보수적입니다. 변동성 5%만 와도 50% 손실이므로 더 높이면 청산 위험 급증.</p>
            <p><b>연속 손실 50% 축소</b> — Drawdown 구간에서 베팅 크기를 줄여 시장 환경 변화에 적응하는 표준 자금관리 기법입니다.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">변경 방법</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            "설정 → 전략 가중치 / 리스크" 메뉴에서 본인 성향에 맞게 조정할 수 있습니다. 단, <b>일일 최대 손실 5% 초과 설정은 권장하지 않습니다.</b>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
