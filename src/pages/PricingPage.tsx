import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, type Plan } from "@/hooks/useSubscription";
import { toast } from "sonner";

const FEATURES: { label: string; free: boolean | string; pro: boolean | string }[] = [
  { label: "TOP 3 시가총액 코인 실시간 차트", free: true, pro: true },
  { label: "공포·탐욕 지수 표시", free: true, pro: true },
  { label: "모의 매매 ($10,000)", free: true, pro: true },
  { label: "전체 12개 코인 통합 분석", free: false, pro: true },
  { label: "타임프레임 자유 선택 (15m/1h/4h/1d)", free: "1h만", pro: "전체" },
  { label: "백테스트 (최대 1년)", free: false, pro: true },
  { label: "수익 곡선 vs Buy & Hold 비교", free: false, pro: true },
  { label: "매매 내역 CSV 다운로드", free: false, pro: true },
  { label: "신호 적중률 실시간 추적", free: "최근 7일", pro: "최근 90일" },
  { label: "텔레그램·브라우저 알림", free: false, pro: true },
  { label: "포트폴리오 추적", free: "최대 10건", pro: "무제한" },
  { label: "우선 고객 지원", free: false, pro: true },
];

export default function PricingPage() {
  const { user } = useAuth();
  const { plan: currentPlan } = useSubscription();
  const navigate = useNavigate();

  const handleSelect = (plan: Plan) => {
    if (!user) { navigate("/auth"); return; }
    if (plan === "free") { toast.info("무료 플랜은 가입 시 자동으로 활성화됩니다."); return; }
    toast.info("결제 시스템 연동은 다음 단계에서 활성화됩니다.");
  };

  const Cell = ({ v }: { v: boolean | string }) => {
    if (v === true) return <Check className="h-4 w-4 text-emerald-500 mx-auto" />;
    if (v === false) return <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />;
    return <span className="text-xs font-medium text-foreground">{v}</span>;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> 돌아가기
          </Link>
          {user ? (
            <Badge variant="outline">현재 플랜: {currentPlan.toUpperCase()}</Badge>
          ) : (
            <Link to="/auth"><Button variant="outline" size="sm">로그인</Button></Link>
          )}
        </div>
      </nav>

      <section className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-3">요금제</h1>
        <p className="text-lg text-muted-foreground">무료로 시작하고 필요할 때 업그레이드하세요.</p>
      </section>

      {/* Comparison table */}
      <section className="container mx-auto px-4 pb-16 max-w-4xl">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-sm font-semibold p-4 w-1/2">기능</th>
                <th className="p-4 w-1/4">
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Free</div>
                    <div className="text-2xl font-bold mt-1">$0<span className="text-xs text-muted-foreground">/월</span></div>
                  </div>
                </th>
                <th className="p-4 w-1/4 bg-primary/5">
                  <div className="text-center">
                    <Badge className="mb-1">추천</Badge>
                    <div className="text-sm text-primary font-semibold">Pro</div>
                    <div className="text-2xl font-bold mt-1">$29<span className="text-xs text-muted-foreground">/월</span></div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="p-3 text-sm">{f.label}</td>
                  <td className="p-3 text-center"><Cell v={f.free} /></td>
                  <td className="p-3 text-center bg-primary/[0.03]"><Cell v={f.pro} /></td>
                </tr>
              ))}
              <tr>
                <td className="p-4"></td>
                <td className="p-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={currentPlan === "free"}
                    onClick={() => handleSelect("free")}
                  >
                    {currentPlan === "free" ? "현재 플랜" : "무료 시작"}
                  </Button>
                </td>
                <td className="p-4 bg-primary/[0.03]">
                  <Button
                    className="w-full"
                    disabled={currentPlan === "pro"}
                    onClick={() => handleSelect("pro")}
                  >
                    {currentPlan === "pro" ? "현재 플랜" : "Pro 업그레이드"}
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          모든 플랜은 언제든 취소 가능 · 7일 환불 보장
        </p>
      </section>
    </div>
  );
}
