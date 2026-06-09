import { Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReviewerBanner } from "@/components/common/ReviewerBanner";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { seedDemoData, clearDemoData } from "@/utils/demoSeed";
import { toast } from "sonner";
import {
  LayoutDashboard, TrendingUp, LineChart, FlaskConical, Calculator, Network,
  PieChart, Bell, BookOpen, ListChecks, Target, Settings, ShieldAlert,
  KeyRound, Gauge, Database, Shield, Eye, Home, FileText
} from "lucide-react";

interface ReviewCard {
  to: string; icon: any; title: string; purpose: string; expect: string;
  scenario?: string; tag?: "core" | "admin" | "legal" | "info";
}

const CARDS: ReviewCard[] = [
  { to: "/dashboard", icon: LayoutDashboard, title: "사용자 대시보드", purpose: "TOP30 히트맵·신호·페이퍼 트레이딩 통합 뷰", expect: "실시간 가격, 페이퍼 잔고 $10k, 데모 포지션", scenario: "BTC 클릭 → 매수 → 포지션 카드 확인", tag: "core" },
  { to: "/market-screener", icon: TrendingUp, title: "마켓 스크리너", purpose: "스테이블 제외 TOP 코인 멀티 TF 신호 필터", expect: "코인별 점수·신호·이론 합의", scenario: "필터로 LONG 신호만 보기", tag: "core" },
  { to: "/market-analysis", icon: LineChart, title: "시장 분석 (단일코인)", purpose: "6대 이론 합의·온체인·뉴스·고래 포지션", expect: "차트+CVD+OI+펀딩+롱숏비율+뉴스 카드", scenario: "코인 선택 후 멀티 TF 신호 비교", tag: "core" },
  { to: "/backtest", icon: FlaskConical, title: "백테스트 엔진", purpose: "ATR 기반 동적 손익절·Kelly 사이징·워크포워드", expect: "PF/Sharpe/Sortino/MDD 카드 + 월별 히트맵 + 몬테카를로", scenario: "전략 선택 → 실행 → 결과 카드 확인", tag: "core" },
  { to: "/calculator", icon: Calculator, title: "포지션 계산기", purpose: "리스크 % 기반 적정 사이즈 계산", expect: "진입가/SL 입력 시 수량·증거금 산출", tag: "core" },
  { to: "/correlation", icon: Network, title: "상관관계 매트릭스", purpose: "코인 간 가격 상관계수 히트맵", expect: "BTC-알트 상관도 표시", tag: "core" },
  { to: "/portfolio", icon: PieChart, title: "포트폴리오", purpose: "에쿼티 커브·일별 PnL·승률 통계", expect: "데모 거래 50건 기반 차트", tag: "core" },
  { to: "/alerts", icon: Bell, title: "알림 센터", purpose: "가격·신호 알림 + 텔레그램 연동", expect: "데모 알림 5건", tag: "core" },
  { to: "/journal", icon: BookOpen, title: "매매 일지", purpose: "거래 회고·감정 점수·룰 위반 기록", expect: "데모 일지 10건", tag: "core" },
  { to: "/rules", icon: ListChecks, title: "트레이딩 룰", purpose: "개인 매매 원칙 체크리스트", expect: "데모 룰 8건", tag: "core" },
  { to: "/accuracy", icon: Target, title: "신호 정확도", purpose: "과거 신호 적중률 추적", expect: "이론별 적중률 차트", tag: "core" },
  { to: "/settings", icon: Settings, title: "설정", purpose: "거래소 API·텔레그램·전략 가중치", expect: "데모 모드에서 API 입력 차단", tag: "core" },

  { to: "/admin", icon: Shield, title: "관리자 대시보드", purpose: "가입자·신호·오류로그·시스템 상태", expect: "user_roles 테이블에 admin 권한이 부여된 계정만 접근 가능", scenario: "관리자 계정으로 로그인 후 /admin 이동", tag: "admin" },

  { to: "/disclaimer", icon: ShieldAlert, title: "위험 고지", purpose: "투자 원금 손실·레버리지 위험 안내", expect: "법적 고지 전문", tag: "legal" },
  { to: "/api-permissions", icon: KeyRound, title: "API 권한 안내", purpose: "거래소 키 발급 시 권한 가이드", expect: "Withdraw 금지·IP 화이트리스트", tag: "legal" },
  { to: "/risk-limits", icon: Gauge, title: "리스크 제한", purpose: "기본 손실·레버리지 한도 설명", expect: "일일 -3% / 포지션 -1.5% 규칙", tag: "legal" },

  { to: "/", icon: Home, title: "랜딩 페이지", purpose: "마케팅 페이지 (외부 접근 지점)", expect: "검토자 모드 CTA 노출", tag: "info" },
  { to: "/pricing", icon: FileText, title: "요금제", purpose: "구독 플랜 비교", expect: "Free/Pro/Premium 카드", tag: "info" },
];

const TAG_COLORS: Record<string, string> = {
  core: "bg-primary/15 text-primary border-primary/30",
  admin: "bg-red-500/15 text-red-300 border-red-500/30",
  legal: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  info: "bg-muted text-muted-foreground border-border",
};

export default function ReviewerHubPage() {
  const { demo, setDemo } = useDemoMode();
  useEffect(() => { document.title = "검토자 허브 · CryptoEdge AI"; }, []);

  const grantAdmin = () => {
    toast.info("관리자 진입은 user_roles 테이블에 admin 역할이 부여된 계정 로그인 후 /admin 으로 이동하세요.");
  };


  return (
    <div className="min-h-screen bg-background text-foreground">
      <ReviewerBanner />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Eye className="h-7 w-7 text-primary" /> 검토자 허브
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              외부 평가자를 위한 전체 기능 인덱스 · 모든 페이지에 1-클릭 접근
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => { seedDemoData(true); toast.success("데모 데이터 50건 생성됨"); }}>
              <Database className="h-4 w-4 mr-1" /> 데모 데이터 채우기
            </Button>
            <Button variant="outline" size="sm" onClick={() => { clearDemoData(); toast.info("데모 데이터 삭제됨"); }}>
              초기화
            </Button>
            <Button variant="outline" size="sm" onClick={grantAdmin}>
              <Shield className="h-4 w-4 mr-1" /> 관리자 권한으로 보기
            </Button>
            <Button
              variant={demo ? "default" : "outline"} size="sm"
              onClick={() => setDemo(!demo)}
            >
              데모 모드: {demo ? "ON" : "OFF"}
            </Button>
          </div>
        </div>

        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
            <div className="text-sm font-bold text-foreground">📋 검토자 체크리스트</div>
            <div>1. 위 "데모 데이터 채우기" 클릭 → 포트폴리오/저널/알림에 가짜 데이터 채워짐</div>
            <div>2. 아래 카드에서 페이지 이동 → 각 카드의 "기대 결과" 와 비교</div>
            <div>3. 자동매매/실주문은 데모 모드에서 모두 차단됨 (시뮬레이션 로그만 기록)</div>
            <div>4. 거래소 API 키 없이도 페이퍼 트레이딩 패널로 매매 흐름 체험 가능</div>
            <div>5. /admin 진입은 user_roles 테이블에서 admin 권한이 부여된 계정만 가능</div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CARDS.map(c => (
            <Link key={c.to} to={c.to} className="group">
              <Card className="h-full hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <c.icon className="h-5 w-5 text-primary" />
                    {c.tag && <Badge variant="outline" className={TAG_COLORS[c.tag]}>{c.tag}</Badge>}
                  </div>
                  <CardTitle className="text-base mt-2 group-hover:text-primary transition-colors">{c.title}</CardTitle>
                  <CardDescription className="text-xs">{c.to}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5 text-xs">
                  <div><span className="text-muted-foreground">목적: </span>{c.purpose}</div>
                  <div><span className="text-muted-foreground">기대 결과: </span><span className="text-foreground">{c.expect}</span></div>
                  {c.scenario && <div><span className="text-muted-foreground">테스트: </span><span className="text-amber-300">{c.scenario}</span></div>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
