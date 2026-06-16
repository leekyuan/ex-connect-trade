import { ShieldAlert } from "lucide-react";

export function DisclaimerBar() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-warning/30 bg-warning/5 text-[11px] text-muted-foreground">
      <ShieldAlert className="h-3.5 w-3.5 text-warning shrink-0" />
      <span>
        본 화면은 <strong className="text-foreground">매매 의사결정 보조 도구</strong>입니다 ·
        <strong className="text-foreground"> 수익을 보장하지 않습니다</strong> ·
        실거래 전 <strong className="text-foreground">모의검증 필수</strong>
      </span>
    </div>
  );
}
