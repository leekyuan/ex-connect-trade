import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ShieldAlert } from "lucide-react";

export default function DisclaimerPage() {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-amber-400" />
          <h1 className="text-2xl font-bold">투자 위험 고지 (Risk Disclosure)</h1>
        </div>

        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 text-sm flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>본 서비스는 <b>투자 자문이 아니며</b>, 모든 매매 결정과 그 결과에 대한 책임은 전적으로 이용자 본인에게 있습니다.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">1. 원금 손실 가능성</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>암호화폐는 24시간 거래되며 변동성이 매우 높습니다. 짧은 시간 안에 투자금 100%를 손실할 수 있고, 레버리지 거래의 경우 <b>강제 청산으로 증거금 전체가 소실</b>될 수 있습니다.</p>
            <p>본 서비스가 생성하는 신호는 과거 데이터 기반 통계이며, 미래 수익을 보장하지 않습니다.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">2. 레버리지 위험</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>선물 거래의 레버리지는 수익뿐 아니라 손실도 같은 배율로 확대합니다.</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>10x 레버리지: -10% 가격 변동 시 증거금 100% 손실</li>
              <li>20x 레버리지: -5% 가격 변동 시 증거금 100% 손실</li>
              <li>본 서비스 권장 최대 레버리지: <b>10x</b></li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">3. 법적 / 규제 안내</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>본 서비스는 <b>대한민국 금융위원회 등록 투자자문업/일임업 사업자가 아닙니다.</b></p>
            <p>특정 국가(미국 등)에서는 거주자에 대해 일부 선물/마진 거래가 제한될 수 있으니 본인 거주국 법규를 반드시 확인하시기 바랍니다.</p>
            <p>이용자는 본인의 세금 신고 의무를 스스로 이행해야 합니다.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">4. 자동매매(AI) 한계</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>네트워크 지연, 거래소 점검, API 오류, 비정상 시장(플래시 크래시) 상황에서 자동매매가 예상과 다르게 동작할 수 있습니다.</p>
            <p>주문 실패·이중 진입·SL 미체결 등의 위험을 인지하고 사용해야 합니다.</p>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center pt-4">
          위 내용을 충분히 숙지하고 본인의 책임 하에 본 서비스를 이용하시기 바랍니다.
        </p>
      </div>
    </DashboardLayout>
  );
}
