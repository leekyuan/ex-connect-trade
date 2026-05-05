import { useRef, useState } from "react";
import { Share2, Image as ImageIcon, Link as LinkIcon, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { CoinAnalysis } from "@/hooks/useMarketAnalysis";
import { ShareCard } from "./ShareCard";

interface Props {
  analysis: CoinAnalysis;
}

export function ShareButton({ analysis }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const captureCanvas = async (): Promise<HTMLCanvasElement | null> => {
    if (!cardRef.current) return null;
    return await html2canvas(cardRef.current, {
      scale: 2,
      backgroundColor: "#0f172a",
      logging: false,
      useCORS: true,
    });
  };

  const handleSaveImage = async () => {
    setBusy(true);
    try {
      const canvas = await captureCanvas();
      if (!canvas) throw new Error("캡처 실패");
      canvas.toBlob((blob) => {
        if (!blob) throw new Error("이미지 변환 실패");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cryptoedge-${analysis.coin.symbol}-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "저장됨!", description: "분석 이미지가 다운로드되었습니다." });
      }, "image/png");
    } catch (e) {
      toast({
        title: "공유 실패",
        description: "다시 시도해주세요",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}?coin=${analysis.coin.symbol}`;
      await navigator.clipboard.writeText(url);
      toast({ title: "링크 복사됨", description: url });
    } catch {
      toast({ title: "복사 실패", variant: "destructive" });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy} className="h-8 gap-1.5">
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Share2 className="h-3.5 w-3.5" />
            )}
            <span className="text-xs">공유</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={handleSaveImage} disabled={busy}>
            <ImageIcon className="h-4 w-4 mr-2" />
            이미지 저장
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyLink}>
            <LinkIcon className="h-4 w-4 mr-2" />
            링크 복사
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden capture target */}
      <div
        style={{
          position: "fixed",
          left: -9999,
          top: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <ShareCard ref={cardRef} analysis={analysis} />
      </div>
    </>
  );
}
