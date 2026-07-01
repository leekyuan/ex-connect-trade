import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DisclaimerBar } from "@/components/today/DisclaimerBar";
import { ApiSafetyModal } from "@/components/security/ApiSafetyModal";
import { RiskLimitsForm } from "@/components/security/RiskLimitsForm";
import { BotSafetyStatus, useBotSafetyChecks } from "@/components/security/BotSafetyStatus";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { KeyRound, ShieldCheck, ShieldAlert, Lock } from "lucide-react";

export default function SecurityPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const checks = useBotSafetyChecks();
  const isBlocked = checks.some(c => !c.ok && c.critical);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <DisclaimerBar />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Risk & API Safety</h1>
          <p className="text-xs text-muted-foreground">Bot Safety Status · API 보안 · 리스크 한도 · 모의매매/실거래 분리</p>
        </div>

        {/* Bot Safety Status — 최상단 */}
        <BotSafetyStatus checks={checks} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" /> 거래소 API 연결
              </h2>
              <p className="text-[11px] text-muted-foreground">
                출금 권한 금지 · 거래 권한만 · IP Whitelist 권장 · Secret 재표시 불가
              </p>
            </div>

            <div className="rounded border border-sky-500/30 bg-sky-500/5 p-2.5 text-[11px] text-sky-200 leading-relaxed">
              실거래 API 연결은 <strong>Paper Mode 100거래 검증 통과 후</strong> 활성화하는 것을 권장합니다.
              현재 Bot Safety Status가 <strong>{isBlocked ? "BLOCKED" : "안전"}</strong>{isBlocked ? " — Live 연결 비활성화됨" : ""}.
            </div>

            <ul className="text-xs space-y-1.5 text-muted-foreground list-disc pl-4">
              <li>출금(Withdraw) 권한이 있는 API 키는 절대 입력하지 마세요.</li>
              <li>거래(Read + Trade) 권한만 허용된 키를 사용하세요.</li>
              <li>가능하다면 거래소에서 IP Whitelist를 설정하세요.</li>
              <li>저장된 Secret은 화면에 다시 표시되지 않습니다.</li>
            </ul>

            <Button
              onClick={() => setModalOpen(true)}
              disabled={isBlocked}
              variant={isBlocked ? "outline" : "secondary"}
              className="w-full"
            >
              {isBlocked ? <Lock className="h-4 w-4 mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
              {isBlocked ? "Live API 연결 잠금 (Bot Safety BLOCKED)" : "API 키 연결 (보안 안내 후 진행)"}
            </Button>

            <Link to="/legal/api-policy" className="text-[11px] text-muted-foreground underline block text-center">
              API 보안 정책 자세히 보기
            </Link>
          </Card>

          <RiskLimitsForm />
        </div>

        <Card className="p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex gap-3 items-start">
            <ShieldAlert className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <strong>실거래 전 필수 확인</strong> · 본 서비스는 매매 의사결정 보조 도구이며, 수익을 보장하지 않습니다.
              자세한 내용은
              {" "}<Link to="/legal/risk" className="underline">투자 유의사항</Link>,
              {" "}<Link to="/legal/terms" className="underline">이용약관</Link>,
              {" "}<Link to="/legal/privacy" className="underline">개인정보처리방침</Link>을 확인하세요.
            </div>
          </div>
        </Card>

        <ApiSafetyModal open={modalOpen} onOpenChange={setModalOpen} />
      </div>
    </DashboardLayout>
  );
}
