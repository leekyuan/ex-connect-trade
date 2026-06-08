import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Check, X, ShieldCheck } from "lucide-react";

const PERMS = [
  { key: "Read Info", allow: true, why: "잔고·포지션·체결 내역 조회 — 필수" },
  { key: "Enable Spot & Margin Trading", allow: true, why: "현물·마진 주문 — 매매 기능 시" },
  { key: "Enable Futures", allow: true, why: "선물 주문 — 레버리지 매매 시" },
  { key: "Enable Withdrawals", allow: false, why: "❌ 절대 켜면 안 됨. 키 유출 시 출금 도용 위험" },
  { key: "Permits Universal Transfer", allow: false, why: "❌ 거래소 내 지갑 간 이체 — 본 서비스 불필요" },
  { key: "Enable Internal Transfer", allow: false, why: "❌ 서브계정 이체 — 불필요" },
];

export default function ApiPermissionsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">거래소 API 키 권한 안내</h1>
        </div>

        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardContent className="p-4 text-sm flex gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>키 발급 시 <b>최소 권한 원칙</b>을 따르세요. 본 서비스는 출금 권한을 절대 요구하지 않습니다.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">권한별 허용 여부</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {PERMS.map(p => (
                <div key={p.key} className="py-2.5 flex items-start gap-3 text-sm">
                  {p.allow
                    ? <Check className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    : <X className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  }
                  <div className="flex-1">
                    <div className="font-semibold">{p.key}</div>
                    <div className="text-xs text-muted-foreground">{p.why}</div>
                  </div>
                  <span className={`text-xs font-bold ${p.allow ? "text-emerald-400" : "text-red-400"}`}>
                    {p.allow ? "허용" : "차단"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">IP 화이트리스트 (강력 권장)</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>거래소(Binance/Bybit/OKX)에서 API 키 발급 시 <b>"Restrict access to trusted IPs only"</b> 옵션을 활성화하고 서비스 IP를 등록하세요.</p>
            <p>본 서비스는 Supabase Edge Functions에서 호출하므로, Edge Function 출구 IP를 화이트리스트에 추가하면 키 유출 시에도 외부에서 사용 불가합니다.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">저장·전송 보안</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc ml-5 space-y-1">
              <li>API Key/Secret은 <b>AES-256 암호화</b>되어 DB에 저장</li>
              <li>RLS(Row Level Security)로 본인만 접근</li>
              <li>HTTPS/TLS 1.3 전송 암호화</li>
              <li>키 회전(rotate) 권장: 3개월마다</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">키 유출 의심 시 즉시 조치</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <div>1. 거래소에서 해당 키 즉시 삭제</div>
            <div>2. 모든 미체결 주문 취소 / 포지션 점검</div>
            <div>3. 2FA 재설정, 출금 주소 화이트리스트 점검</div>
            <div>4. 본 서비스 설정에서도 키 삭제</div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
