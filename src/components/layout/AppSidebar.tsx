import {
  BarChart3,
  Settings,
  LineChart,
  FlaskConical,
  PieChart,
  Bell,
  TrendingUp,
  Calculator,
  Network,
  Eye,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Target,
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useUnreadAlerts } from "@/hooks/useUnreadAlerts";
import { useRole } from "@/hooks/useRole";

const reviewerItems = [
  { title: "검토자 허브", url: "/reviewer", icon: Eye },
];

const coreItems = [
  { title: "오늘의 신호", url: "/", icon: Target, exact: true },
  { title: "전략 검증", url: "/verification", icon: CheckCircle2 },
  { title: "Risk & API", url: "/security", icon: ShieldCheck },
  { title: "포트폴리오", url: "/portfolio", icon: PieChart },
  { title: "알림 센터", url: "/alerts", icon: Bell, badgeKey: "alerts" as const },
];

const advancedItems = [
  { title: "마켓 스크리너", url: "/market-screener", icon: TrendingUp },
  { title: "시장 분석", url: "/market-analysis", icon: LineChart },
  { title: "백테스트 (상세)", url: "/backtest", icon: FlaskConical },
  { title: "포지션 계산기", url: "/calculator", icon: Calculator },
  { title: "상관관계", url: "/correlation", icon: Network },
];

const legalItems = [
  { title: "이용약관", url: "/legal/terms", icon: BookOpen },
  { title: "개인정보처리방침", url: "/legal/privacy", icon: BookOpen },
  { title: "투자 유의사항", url: "/legal/risk", icon: ShieldAlert },
  { title: "API 보안 정책", url: "/legal/api-policy", icon: ShieldCheck },
  { title: "환불 정책", url: "/legal/refund", icon: BookOpen },
];

const settingsItems = [
  { title: "설정", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const unread = useUnreadAlerts();
  const { isAdmin } = useRole();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <BarChart3 className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold text-sidebar-foreground tracking-tight">
                CryptoEdge AI
              </h1>
              <p className="text-[10px] text-muted-foreground">Signal Terminal</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>검토자</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {reviewerItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin")}>
                    <NavLink to="/admin" className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <Shield className="h-4 w-4" />
                      {!collapsed && <span>관리자</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>핵심</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {coreItems.map((item) => {
                const showBadge = (item as any).badgeKey === 'alerts' && unread > 0;
                const active = (item as any).exact ? location.pathname === item.url : isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink
                        to={item.url}
                        end={(item as any).exact}
                        className="hover:bg-sidebar-accent/50 relative"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                        {showBadge && (
                          <span className={`${collapsed ? 'absolute top-1 right-1' : 'ml-auto'} bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center`}>
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Advanced</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {advancedItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>약관·정책</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {legalItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>



        <SidebarGroup>
          <SidebarGroupLabel>설정</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <span className="text-[10px] text-muted-foreground font-mono">v1.0 · Guest Mode</span>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
