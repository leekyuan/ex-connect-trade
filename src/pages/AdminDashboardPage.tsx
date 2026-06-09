import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FeatureLabel } from "@/components/common/FeatureLabel";
import { DemoBadge } from "@/components/common/DemoBadge";
import { useRole } from "@/hooks/useRole";
import { Navigate } from "react-router-dom";
import { Users, Activity, AlertTriangle, Server, TrendingUp, Database } from "lucide-react";

const STATS = [
  { icon: Users, label: "총 가입자", value: "1,247", delta: "+34 (7일)", color: "text-primary" },
  { icon: Activity, label: "활성 사용자 (24h)", value: "412", delta: "+8%", color: "text-emerald-400" },
  { icon: TrendingUp, label: "신호 생성 (24h)", value: "8,931", delta: "+15%", color: "text-emerald-400" },
  { icon: AlertTriangle, label: "오류 로그 (24h)", value: "23", delta: "-12%", color: "text-amber-400" },
  { icon: Server, label: "Edge Function 호출", value: "142,801", delta: "+5%", color: "text-primary" },
  { icon: Database, label: "DB 쿼리/min", value: "287", delta: "정상", color: "text-emerald-400" },
];

const RECENT_USERS = [
  { id: "u_8af3", email: "trader_***@gmail.com", plan: "Pro", joined: "2분 전", status: "active" },
  { id: "u_9c12", email: "btc_whale_***@kakao.com", plan: "Premium", joined: "11분 전", status: "active" },
  { id: "u_7e22", email: "newbie_***@naver.com", plan: "Free", joined: "1시간 전", status: "active" },
  { id: "u_6d11", email: "scalp_***@gmail.com", plan: "Pro", joined: "3시간 전", status: "idle" },
  { id: "u_5a00", email: "hodler_***@yahoo.com", plan: "Free", joined: "5시간 전", status: "active" },
];

const SYSTEM_HEALTH = [
  { name: "Supabase Auth", status: "정상", uptime: "99.99%" },
  { name: "Edge Functions", status: "정상", uptime: "99.95%" },
  { name: "Binance WebSocket", status: "정상", uptime: "99.87%" },
  { name: "CoinMarketCap API", status: "지연", uptime: "98.42%" },
  { name: "Telegram Bot", status: "정상", uptime: "100%" },
];

export default function AdminDashboardPage() {
  const { isAdmin, loading } = useRole();
  const [stats, setStats] = useState(STATS);

  useEffect(() => { document.title = "관리자 · CryptoEdge AI"; }, []);

  // simulated jitter
  useEffect(() => {
    const id = setInterval(() => {
      setStats(prev => prev.map(s => ({ ...s })));
    }, 5000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <DashboardLayout><div className="p-8 text-muted-foreground">권한 확인 중…</div></DashboardLayout>;
  if (!isAdmin) {
    return <Navigate to="/reviewer" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <FeatureLabel
          title="🛡️ 관리자 대시보드 (데모)"
          desc="플랫폼 운영자 전용 뷰 — 사용자/신호/시스템 헬스 모니터링."
          tip="user_roles 테이블의 admin 권한이 부여된 계정만 접근 가능합니다."
        />

        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">시스템 개요</h2>
          <DemoBadge label="시뮬레이션 데이터" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map(s => (
            <Card key={s.label}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                  <span className="text-[10px] text-muted-foreground">{s.delta}</span>
                </div>
                <div className="text-lg font-bold">{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">최근 가입자</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {RECENT_USERS.map(u => (
                <div key={u.id} className="flex items-center justify-between text-xs border-b border-border/50 pb-2 last:border-0">
                  <div>
                    <div className="font-mono">{u.email}</div>
                    <div className="text-[10px] text-muted-foreground">{u.id} · {u.joined}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={u.plan === "Free" ? "outline" : "default"}>{u.plan}</Badge>
                    <span className={`h-2 w-2 rounded-full ${u.status === "active" ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">시스템 상태</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {SYSTEM_HEALTH.map(s => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${s.status === "정상" ? "bg-emerald-400" : "bg-amber-400"}`} />
                    <span>{s.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={s.status === "정상" ? "text-emerald-400" : "text-amber-400"}>{s.status}</span>
                    <span className="font-mono text-muted-foreground">{s.uptime}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">최근 오류 로그 (샘플)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="text-red-400">[12:42:11] crypto-news 500: rate_limit_exceeded (자동 복구됨)</div>
              <div className="text-amber-400">[12:18:03] binance-proxy timeout: BTCUSDT funding (재시도 성공)</div>
              <div className="text-muted-foreground">[11:55:30] cmc-top30 cache hit (정상)</div>
              <div className="text-muted-foreground">[11:30:12] auto-trade simulated (demo mode user_xxx)</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
