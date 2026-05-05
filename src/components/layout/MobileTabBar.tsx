import { Home, LineChart, FlaskConical, PieChart, TrendingUp, Bell } from "lucide-react";
import { NavLink } from "@/components/NavLink";

const items = [
  { to: "/dashboard", icon: Home, label: "홈", end: true },
  { to: "/market-screener", icon: TrendingUp, label: "스크리너" },
  { to: "/market-analysis", icon: LineChart, label: "분석" },
  { to: "/portfolio", icon: PieChart, label: "포트폴리오" },
  { to: "/alerts", icon: Bell, label: "알림" },
];

export function MobileTabBar() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border shadow-lg"
      style={{ height: 64, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex h-16 items-stretch">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors"
            activeClassName="text-primary"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
