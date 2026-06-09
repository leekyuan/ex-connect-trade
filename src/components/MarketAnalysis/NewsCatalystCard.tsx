/**
 * 24h news/catalyst card — fetches news via crypto-news edge function.
 * UX hardening:
 *  - 개발자용 raw 에러는 절대 UI에 노출하지 않음 (console.error 로만 남김)
 *  - 사용자 친화 메시지 + 마지막 성공 데이터 캐시(localStorage) fallback
 *  - 마지막 업데이트 시간 표시
 *  - 갱신 버튼 로딩 상태
 */
import { useEffect, useState, useCallback } from 'react';
import { Newspaper, TrendingUp, TrendingDown, Minus, ExternalLink, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
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

const CACHE_PREFIX = 'cryptoedge-news-cache-v1:';

function loadCache(symbol: string): News | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + symbol);
    return raw ? (JSON.parse(raw) as News) : null;
  } catch { return null; }
}
function saveCache(symbol: string, data: News) {
  try { localStorage.setItem(CACHE_PREFIX + symbol, JSON.stringify(data)); } catch { /* ignore */ }
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return '-';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export function NewsCatalystCard({ symbol }: Props) {
  const [data, setData] = useState<News | null>(() => loadCache(symbol));
  const [loading, setLoading] = useState(false);
  const [softError, setSoftError] = useState<string | null>(null);
  const [stale, setStale] = useState<boolean>(false);

  const fetchNews = useCallback(async (manual = false) => {
    setLoading(true);
    if (manual) setSoftError(null);
    try {
      const { data: res, error: invErr } = await supabase.functions.invoke('crypto-news', {
        body: { symbol },
      });
      if (invErr) throw invErr;
      if (res?.error) throw new Error(typeof res.error === 'string' ? res.error : 'response error');
      const news = res as News;
      setData(news);
      saveCache(symbol, news);
      setSoftError(null);
      setStale(false);
    } catch (e: any) {
      // 개발자용 에러는 콘솔에만
      console.error('[crypto-news] fetch failed:', e?.message ?? e);
      setSoftError('현재 뉴스 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      // 캐시가 있으면 그대로 유지하되 stale 표시
      const cached = loadCache(symbol);
      if (cached) {
        setData(cached);
        setStale(true);
      }
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    // 심볼 변경 시 캐시 즉시 반영
    const cached = loadCache(symbol);
    setData(cached);
    setStale(false);
    setSoftError(null);
    fetchNews(false);
    const id = setInterval(() => fetchNews(false), 10 * 60_000);
    return () => clearInterval(id);
  }, [symbol, fetchNews]);

  const tone = data?.sentiment === 'bullish'
    ? { cls: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: '호재 우세', icon: <TrendingUp className="h-3.5 w-3.5" /> }
    : data?.sentiment === 'bearish'
    ? { cls: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: '악재 우세', icon: <TrendingDown className="h-3.5 w-3.5" /> }
    : { cls: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', label: '중립', icon: <Minus className="h-3.5 w-3.5" /> };

  return (
    <div className={`rounded-xl border ${tone.border} ${tone.bg} p-3 space-y-3`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <Newspaper className="h-4 w-4" />
          <span>24h 뉴스/SNS · {symbol}</span>
          {data && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1 ${tone.cls} ${tone.bg}`}>
              {tone.icon}{tone.label}
            </span>
          )}
          {stale && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              캐시된 데이터
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {data?.fetchedAt && (
            <span className="text-[10px] text-muted-foreground">
              업데이트: {formatRelative(data.fetchedAt)}
            </span>
          )}
          <button
            onClick={() => fetchNews(true)}
            disabled={loading}
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            갱신
          </button>
        </div>
      </div>

      {softError && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{softError}</span>
        </div>
      )}

      {loading && !data && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> 24시간 뉴스 수집 중...
        </div>
      )}

      {!loading && !data && !softError && (
        <div className="text-xs text-muted-foreground">표시할 뉴스가 없습니다.</div>
      )}

      {data && (
        <>
          {data.summary && (
            <p className="text-xs text-foreground/90 leading-relaxed">{data.summary}</p>
          )}

          {(data.bullish.length > 0 || data.bearish.length > 0) && (
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
          )}

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
