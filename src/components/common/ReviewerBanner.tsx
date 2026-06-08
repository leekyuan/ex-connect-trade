import { Link } from "react-router-dom";
import { Eye, AlertTriangle } from "lucide-react";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { Switch } from "@/components/ui/switch";

/**
 * Persistent banner shown to external reviewers.
 * Includes a demo-mode toggle and quick links to the reviewer hub.
 */
export function ReviewerBanner() {
  const { demo, toggle } = useDemoMode();
  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/30 text-amber-200 text-xs">
      <div className="container mx-auto px-3 py-1.5 flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 font-semibold">
          <Eye className="h-3.5 w-3.5" /> Reviewer / Demo Mode
        </span>
        <span className="flex items-center gap-1 text-amber-300/80">
          <AlertTriangle className="h-3 w-3" /> 표시되는 모든 데이터는 시뮬레이션 — 실주문 발생 안 함
        </span>
        <Link to="/reviewer" className="underline hover:text-amber-100 ml-auto">검토자 허브</Link>
        <Link to="/disclaimer" className="underline hover:text-amber-100">위험고지</Link>
        <Link to="/api-permissions" className="underline hover:text-amber-100">API 권한</Link>
        <Link to="/risk-limits" className="underline hover:text-amber-100">리스크 제한</Link>
        <span className="flex items-center gap-1.5">
          <span className="text-amber-300/70">데모</span>
          <Switch checked={demo} onCheckedChange={toggle} />
        </span>
      </div>
    </div>
  );
}
