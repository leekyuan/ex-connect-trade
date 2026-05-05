import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCoinMarketCap } from "@/hooks/useCoinMarketCap";
import { toast } from "sonner";

const REFRESH_MS = 30 * 60 * 1000; // 30 min

function renderMarkdown(md: string) {
  // Lightweight markdown: **bold**, ## heading, lists
  const lines = md.split("\n");
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-2" />;
    if (trimmed.startsWith("## "))
      return (
        <h3 key={i} className="mt-3 text-sm font-bold text-primary">
          {trimmed.slice(3)}
        </h3>
      );
    if (/^\d+\.\s/.test(trimmed))
      return (
        <p key={i} className="mt-2 text-sm font-semibold">
          {renderInline(trimmed)}
        </p>
      );
    if (trimmed.startsWith("- ") || trimmed.startsWith("* "))
      return (
        <p key={i} className="ml-3 text-sm text-muted-foreground">
          • {renderInline(trimmed.slice(2))}
        </p>
      );
    return (
      <p key={i} className="text-sm text-muted-foreground">
        {renderInline(trimmed)}
      </p>
    );
  });
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="text-foreground">{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export function AIMarketSummary() {
  const { coins } = useCoinMarketCap();
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const fetchSummary = async () => {
    if (!coins || coins.length === 0) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("ai-market-summary", {
      body: { coins: coins.slice(0, 15) },
    });
    setLoading(false);
    if (error || data?.error) {
      toast.error(`시황 분석 실패: ${error?.message ?? data?.error}`);
      return;
    }
    setSummary(data.summary);
    setUpdatedAt(new Date());
  };

  useEffect(() => {
    if (!coins || coins.length === 0) return;
    if (summary) return;
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coins]);

  useEffect(() => {
    const id = setInterval(() => {
      if (coins && coins.length > 0) fetchSummary();
    }, REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coins]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> AI 시황 분석
        </CardTitle>
        <div className="flex items-center gap-2">
          {updatedAt && (
            <span className="text-[11px] text-muted-foreground">
              {updatedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={fetchSummary} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !summary ? (
          <div className="space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ) : summary ? (
          <div className="space-y-1">{renderMarkdown(summary)}</div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
            시장 데이터를 기다리는 중...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
