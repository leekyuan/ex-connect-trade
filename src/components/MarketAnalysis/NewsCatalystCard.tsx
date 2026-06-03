/**
 * 24h news/catalyst card — fetches news via crypto-news edge function
 * which combines CryptoCompare headlines + Lovable AI classification.
 */
import { useEffect, useState } from 'react';
import { Newspaper, TrendingUp, TrendingDown, Minus, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Source { title: string; url: string; source: string; time: string }
interface News {
  symbol: string;
  bullish: string[];
  bearish: string[];
  neutral: string[];
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sources: Source[];
  fetchedAt: string;
}

interface Props { symbol: string }

export function NewsCatalystCard({ symbol }: Props) {
  const [data, setData] = useState<News | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: invErr } = await supabase.functions.invoke('crypto-news', {
        body: { symbol },
      });
      if (invErr) throw invErr;
      if (res?.error) throw new Error(res.error);
      setData(res as News);
    } catch (e: any) {
      setError(e?.message ?? '뉴스 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, 10 * 60_000); // 10분
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const tone = data?.sentiment === 'bullish'
    ? { cls: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: '호재 우세', icon: <TrendingUp className="h-3.5 w-3.5" /> }
    : data?.sentiment === 'bearish'
    ? { cls: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: '악재 우세', icon: <TrendingDown className="h-3.5 w-3.5" /> }
    : { cls: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', label: '중립', icon: <Minus className="h-3.5 w-3.5" /> };

  return (
    <div className={`rounded-xl border ${tone.border} ${tone.bg} p-3 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <Newspaper className="h-4 w-4" />
          <span>24h 뉴스/SNS · {symbol}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${tone.cls} ${tone.bg}`}>
            {tone.icon}{tone.label}
          </span>
        </div>
        <button
          onClick={fetchNews}
          disabled={loading}
          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          갱신
        </button>
      </div>

      {error && (
        <div className="text-xs text-destructive">뉴스 로드 실패: {error}</div>
      )}

      {loading && !data && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> 24시간 뉴스 수집 + AI 분석 중...
        </div>
      )}

      {data && (
        <>
          {data.summary && (
            <p className="text-xs text-foreground/90 leading-relaxed">{data.summary}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.bullish.length > 0 && (
              <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2">
                <div className="text-[10px] font-bold text-emerald-400 mb-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> 호재
                </div>
                <ul className="space-y-1 text-[11px]">
                  {data.bullish.map((b, i) => <li key={i}>• {b}</li>)}
                </ul>
              </div>
            )}
            {data.bearish.length > 0 && (
              <div className="rounded border border-red-500/30 bg-red-500/5 p-2">
                <div className="text-[10px] font-bold text-red-400 mb-1 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" /> 악재
                </div>
                <ul className="space-y-1 text-[11px]">
                  {data.bearish.map((b, i) => <li key={i}>• {b}</li>)}
                </ul>
              </div>
            )}
          </div>

          {data.sources.length > 0 && (
            <details className="text-[10px] text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">원문 헤드라인 {data.sources.length}건</summary>
              <ul className="mt-1 space-y-0.5">
                {data.sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary inline-flex items-center gap-1">
                      <ExternalLink className="h-2.5 w-2.5" />
                      <span className="opacity-70">[{s.source}]</span> {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
