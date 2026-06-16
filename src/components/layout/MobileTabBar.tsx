import { Target, CheckCircle2, ShieldCheck, PieChart, Bell } from "lucide-react";
import { NavLink } from "@/components/NavLink";

const items = [
  { to: "/", icon: Target, label: "신호", end: true },
  { to: "/verification", icon: CheckCircle2, label: "검증" },
  { to: "/security", icon: ShieldCheck, label: "보안" },
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
