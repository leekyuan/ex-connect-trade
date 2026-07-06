import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import type { Exchange } from "@/types/trading";

interface ApiKeyFormProps {
  exchange: Exchange;
}

/**
 * DEPRECATED — legacy plaintext API key form has been disabled.
 *
 * All exchange API keys must be saved through Settings → 거래소 연동
 * (which uses the server-side encrypted flow and RLS-protected storage).
 * This shell only renders a redirect notice so any lingering imports keep working.
 */
export function ApiKeyForm({ exchange }: ApiKeyFormProps) {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-start gap-2 text-xs text-amber-300">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <b>API 키 저장은 설정에서만 가능합니다.</b>
          <div className="text-amber-200/80 mt-1">
            {exchange.toUpperCase()} 키는 Settings 페이지의 거래소 연동 화면에서
            서버측 암호 저장소에 저장됩니다. 이 폼에서는 저장할 수 없습니다.
          </div>
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="w-full">
        <Link to="/settings">Settings로 이동</Link>
      </Button>
    </div>
  );
}
