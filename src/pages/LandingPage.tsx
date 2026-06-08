import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BarChart3, Bot, Bell, Layers, ShieldCheck, Zap, Eye } from "lucide-react";

const features = [
  { icon: Layers, title: "6대 이론 분석", desc: "엘리어트, ICT, 와이코프, 하모닉, 피보나치, 다우 — 실제 캔들로 합의점수 산출" },
  { icon: Bot, title: "AI 자동매매", desc: "Binance / Bybit / OKX — 신호 발생 시 자동 진입, TP1/TP2 분할 익절, SL 자동 등록" },
  { icon: Bell, title: "실시간 알림", desc: "텔레그램 봇으로 신호·체결·청산 알림. 데스크톱 푸시 알림도 지원" },
  { icon: BarChart3, title: "포트폴리오 추적", desc: "에쿼티 커브, 일/주/월 PnL, 승률·샤프·평균 RR 자동 계산" },
  { icon: ShieldCheck, title: "API 키 암호화", desc: "AES-256 암호화 저장, RLS 보호. 거래소 키는 본인만 접근 가능" },
  { icon: Zap, title: "백테스트 엔진", desc: "과거 데이터로 전략 검증. 수수료·슬리피지 포함, 복리 수익률 계산" },
];

const stats = [
  { value: "30", label: "분석 코인 (Pro)" },
  { value: "6", label: "트레이딩 이론" },
  { value: "3", label: "지원 거래소" },
  { value: "5m / 1h / 1d", label: "타임프레임" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <Bot className="h-6 w-6 text-primary" />
            AutoBot Trading
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/reviewer"><Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200"><Eye className="h-4 w-4 mr-1" /> 검토자 모드</Button></Link>
            <Link to="/pricing"><Button variant="ghost" size="sm">요금제</Button></Link>
            <Link to="/dashboard"><Button variant="outline" size="sm">데모 체험</Button></Link>
            <Link to="/dashboard"><Button size="sm">무료 시작</Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <Badge variant="secondary" className="mb-6">실제 캔들 기반 분석 엔진 · 6대 이론 합의 신호</Badge>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
          AI 기반 암호화폐<br />자동매매 플랫폼
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          엘리어트·ICT·와이코프·하모닉·피보나치·다우 이론을 실시간 OHLCV 데이터로 분석하여
          LONG/SHORT 신호를 자동 생성하고 거래소에 직접 주문합니다.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link to="/dashboard"><Button size="lg" className="gap-2">지금 무료로 시작 <ArrowRight className="h-4 w-4" /></Button></Link>
          <Link to="/reviewer"><Button size="lg" variant="outline" className="gap-2 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"><Eye className="h-4 w-4" /> 외부 검토자용 데모 보기</Button></Link>
          <Link to="/pricing"><Button size="lg" variant="ghost">요금제 보기</Button></Link>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/50 bg-muted/20">
        <div className="container mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">{s.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">전문 트레이더의 도구</h2>
          <p className="text-muted-foreground">개인 트레이더도 헤지펀드 수준의 분석 엔진을 사용할 수 있습니다.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="border-border/50 hover:border-primary/50 transition-colors">
              <CardHeader>
                <f.icon className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-xl">{f.title}</CardTitle>
                <CardDescription className="text-base">{f.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">단순한 요금제</h2>
        <p className="text-muted-foreground mb-8">무료로 시작하고 필요할 때 업그레이드하세요.</p>
        <Link to="/pricing"><Button size="lg" variant="outline">요금제 비교</Button></Link>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-24">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-12 text-center">
            <h2 className="text-4xl font-bold mb-4">지금 무료로 시작하세요</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              신용카드 불필요. 5개 코인 분석을 무료로 사용해 보세요.
            </p>
            <Link to="/auth"><Button size="lg" className="gap-2">무료 계정 만들기 <ArrowRight className="h-4 w-4" /></Button></Link>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} AutoBot Trading. 투자에는 손실 위험이 따릅니다.
      </footer>
    </div>
  );
}
