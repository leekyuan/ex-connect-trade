import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCoinMarketCap, type CoinData } from '@/hooks/useCoinMarketCap';
import { useScreenerTheories, type Dir, type CoinTheorySignals } from '@/hooks/useScreenerTheories';
import { useScreenerMtf, MTF_TFS, type MtfTf, type MtfCell } from '@/hooks/useScreenerMtf';
import { useBinanceTicker } from '@/hooks/useBinanceTicker';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Search, TrendingUp, Star } from 'lucide-react';
import { ScreenerCoinDrawer } from '@/components/MarketScreener/ScreenerCoinDrawer';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

type ConsensusFilter = 'ALL' | 'LONG' | 'SHORT' | 'WATCH';
const REFRESH_MS = 60_000;

export default function MarketScreenerPage() {
  const { coins, loading, lastUpdated, refetch } = useCoinMarketCap(REFRESH_MS);
  const tickers = useBinanceTicker(15_000);

  const top30 = useMemo(() => coins.slice(0, 30), [coins]);
  const symbols = useMemo(() => top30.map(c => c.symbol), [top30]);
  const { data: theories, progress, total } = useScreenerTheories(symbols, REFRESH_MS);
  const [view, setView] = useState<'single' | 'mtf'>('single');
  const { matrix, progress: mtfProgress, total: mtfTotal } = useScreenerMtf(view === 'mtf' ? symbols : [], 30_000);

  const [filter, setFilter] = useState<ConsensusFilter>('ALL');
  const [query, setQuery] = useState('');

  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  useEffect(() => {
    const id = setInterval(() => setCountdown(c => (c <= 1 ? REFRESH_MS / 1000 : c - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { setCountdown(REFRESH_MS / 1000); }, [lastUpdated]);

  const [openSym, setOpenSym] = useState<CoinData | null>(null);

  const rows = useMemo(() => {
    return top30.map(c => {
      const t = tickers[`${c.symbol}USDT`];
      const livePrice = t?.lastPrice ?? c.price;
      const sigs = theories[c.symbol] ?? null;
      return { coin: c, price: livePrice, sigs };
    });
  }, [top30, tickers, theories]);

  const filtered = useMemo(() => {
    let f = rows;
    if (query.trim()) {
      const q = query.toUpperCase();
      f = f.filter(r => r.coin.symbol.includes(q) || r.coin.name.toUpperCase().includes(q));
    }
    if (filter !== 'ALL') {
      f = f.filter(r => (r.sigs?.consensus ?? 'WATCH') === filter);
    }
    return [...f].sort((a, b) => {
      const sa = a.sigs ? Math.max(a.sigs.longCount, a.sigs.shortCount) : 0;
      const sb = b.sigs ? Math.max(b.sigs.longCount, b.sigs.shortCount) : 0;
      if (sb !== sa) return sb - sa;
      return a.coin.cmc_rank - b.coin.cmc_rank;
    });
  }, [rows, filter, query]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" /> 마켓 스크리너 · 5대 이론 매매 신호
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              CoinMarketCap TOP 30 · 거래소 자동 폴백(Binance/OKX/Bybit/MEXC) · ICT · 와이코프 · 하모닉 · Neely · 프랙탈
              {view === 'single'
                ? ` · ${progress}/${total} 분석 완료`
                : ` · MTF ${mtfProgress}/${mtfTotal} 셀 완료`}
            </p>
          </div>
          <div className="flex items-center gap-2 min-w-[180px]">
            <div className="flex-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>다음 갱신</span>
                <span className="font-mono">{countdown}s</span>
              </div>
              <Progress value={((REFRESH_MS / 1000 - countdown) / (REFRESH_MS / 1000)) * 100} className="h-1" />
            </div>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> 새로고침
            </Button>
          </div>
        </header>

        <Tabs value={view} onValueChange={(v) => setView(v as 'single' | 'mtf')}>
          <TabsList>
            <TabsTrigger value="single">단일뷰 (1H)</TabsTrigger>
            <TabsTrigger value="mtf">MTF 매트릭스 (15m·1H·4H·1D)</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4 mt-3">
            {/* 필터 바 */}
            <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="코인 검색 (BTC, Ethereum...)"
                  className="h-8 pl-7 text-xs"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">합의 신호</span>
                <Select value={filter} onValueChange={v => setFilter(v as ConsensusFilter)}>
                  <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체</SelectItem>
                    <SelectItem value="LONG">롱 합의</SelectItem>
                    <SelectItem value="SHORT">숏 합의</SelectItem>
                    <SelectItem value="WATCH">관망</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 ml-auto text-[10px] text-muted-foreground">
                <Legend dir="LONG" label="롱" />
                <Legend dir="SHORT" label="숏" />
                <Legend dir="WATCH" label="관망" />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">코인</th>
                      <th className="px-3 py-2 text-right">현재가</th>
                      <th className="px-3 py-2 text-center">ICT</th>
                      <th className="px-3 py-2 text-center">와이코프</th>
                      <th className="px-3 py-2 text-center">하모닉</th>
                      <th className="px-3 py-2 text-center">Neely</th>
                      <th className="px-3 py-2 text-center">프랙탈</th>
                      <th className="px-3 py-2 text-center">합의</th>
                      <th className="px-3 py-2 text-center" title="사용자 가중치 반영 -100..+100">가중점수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && rows.length === 0
                      ? Array.from({ length: 10 }).map((_, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td colSpan={10} className="p-2"><Skeleton className="h-7 w-full" /></td>
                          </tr>
                        ))
                      : filtered.map(r => (
                          <tr
                            key={r.coin.id}
                            onClick={() => setOpenSym(r.coin)}
                            className="border-b border-border/40 hover:bg-muted/40 cursor-pointer transition"
                          >
                            <td className="px-3 py-2 text-muted-foreground font-mono">{r.coin.cmc_rank}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-foreground">{r.coin.symbol}</div>
                                <div className="text-muted-foreground hidden sm:inline">{r.coin.name}</div>
                                {r.sigs?.fallback && (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
                                    {r.sigs.exchange}
                                  </span>
                                )}
                                {r.sigs?.status === 'low_data' && (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300">데이터 부족</span>
                                )}
                                {r.sigs?.status === 'failed' && (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-300">분석 실패</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono">${formatPrice(r.price)}</td>
                            <TheoryCell sig={r.sigs?.ict} />
                            <TheoryCell sig={r.sigs?.wyckoff} />
                            <TheoryCell sig={r.sigs?.harmonic} />
                            <TheoryCell sig={r.sigs?.neely} />
                            <TheoryCell sig={r.sigs?.fractal} />
                            <td className="px-3 py-2 text-center">
                              {r.sigs == null ? <Skeleton className="h-5 w-16 mx-auto" /> :
                                <ConsensusBadge sigs={r.sigs} />}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {r.sigs == null ? <Skeleton className="h-5 w-12 mx-auto" /> :
                                <WeightedScoreCell score={r.sigs.weightedScore} />}
                            </td>
                          </tr>
                        ))}
                    {!loading && filtered.length === 0 && (
                      <tr><td colSpan={10} className="p-6 text-center text-muted-foreground text-sm">조건에 맞는 코인이 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mtf" className="mt-3">
            <MtfMatrixTable
              top30={top30}
              matrix={matrix}
              filter={filter}
              setFilter={setFilter}
              query={query}
              setQuery={setQuery}
            />
          </TabsContent>
        </Tabs>

        <ScreenerCoinDrawer
          open={!!openSym}
          onClose={() => setOpenSym(null)}
          symbol={openSym?.symbol ?? null}
          tvSymbol={openSym?.tvSymbol ?? null}
          price={openSym?.price ?? null}
        />
      </div>
    </DashboardLayout>
  );
}

function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toFixed(6);
}

function dirStyle(dir: Dir): { box: string; text: string; label: string } {
  if (dir === 'LONG') return { box: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', label: '롱' };
  if (dir === 'SHORT') return { box: 'bg-red-500/15 border-red-500/30', text: 'text-red-400', label: '숏' };
  return { box: 'bg-muted border-border', text: 'text-muted-foreground', label: '관망' };
}

function TheoryCell({ sig }: { sig: { dir: Dir; confidence: number } | undefined }) {
  if (!sig) return (
    <td className="px-3 py-2 text-center"><Skeleton className="h-5 w-12 mx-auto" /></td>
  );
  const s = dirStyle(sig.dir);
  return (
    <td className="px-3 py-2 text-center">
      <div className={`inline-flex flex-col items-center px-1.5 py-0.5 rounded border text-[10px] font-bold ${s.box} ${s.text}`}>
        <span>{s.label}</span>
        <span className="opacity-70 font-mono text-[9px]">{sig.confidence}%</span>
      </div>
    </td>
  );
}

function ConsensusBadge({ sigs }: { sigs: CoinTheorySignals }) {
  const s = dirStyle(sigs.consensus);
  const strong = Math.max(sigs.longCount, sigs.shortCount) >= 3;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${s.box} ${s.text}`}>
      <span className="font-bold text-[11px]">{strong ? '★ ' : ''}{s.label}</span>
      <span className="font-mono text-[9px] opacity-80">{sigs.longCount}L · {sigs.shortCount}S</span>
    </div>
  );
}

function WeightedScoreCell({ score }: { score: number }) {
  const abs = Math.min(100, Math.abs(score));
  const cls = score > 15 ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
    : score < -15 ? 'text-red-400 border-red-500/40 bg-red-500/10'
    : 'text-muted-foreground border-border bg-muted/40';
  return (
    <div className={`inline-flex flex-col items-center px-2 py-0.5 rounded border min-w-[56px] ${cls}`}>
      <span className="font-mono font-bold text-[11px]">{score > 0 ? '+' : ''}{score}</span>
      <div className="w-full h-0.5 mt-0.5 rounded bg-background/60 overflow-hidden">
        <div className="h-full bg-current" style={{ width: `${abs}%` }} />
      </div>
    </div>
  );
}

function Legend({ dir, label }: { dir: Dir; label: string }) {
  const s = dirStyle(dir);
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${s.box} ${s.text}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />{label}
    </span>
  );
}

// ─────────────────────── MTF 매트릭스 ───────────────────────
function MtfMatrixTable({
  top30, matrix, filter, setFilter, query, setQuery,
}: {
  top30: CoinData[];
  matrix: Record<string, Record<string, MtfCell | null>>;
  filter: ConsensusFilter;
  setFilter: (v: ConsensusFilter) => void;
  query: string;
  setQuery: (v: string) => void;
}) {
  const navigate = useNavigate();

  const rows = useMemo(() => {
    return top30
      .filter(c => !query.trim() || c.symbol.includes(query.toUpperCase()) || c.name.toUpperCase().includes(query.toUpperCase()))
      .map(c => {
        const row = matrix[c.symbol] ?? {};
        let longCount = 0, shortCount = 0;
        for (const tf of MTF_TFS) {
          const cell = row[tf];
          if (cell?.dir === 'LONG') longCount++;
          else if (cell?.dir === 'SHORT') shortCount++;
        }
        const consensus: Dir = longCount > shortCount && longCount >= 2 ? 'LONG'
          : shortCount > longCount && shortCount >= 2 ? 'SHORT' : 'WATCH';
        return { coin: c, row, longCount, shortCount, consensus };
      })
      .filter(r => filter === 'ALL' ? true : r.consensus === filter)
      .sort((a, b) => Math.max(b.longCount, b.shortCount) - Math.max(a.longCount, a.shortCount));
  }, [top30, matrix, filter, query]);

  const dirCellStyle = (d?: Dir): string => {
    if (d === 'LONG') return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300';
    if (d === 'SHORT') return 'bg-red-500/20 border-red-500/40 text-red-300';
    return 'bg-muted/40 border-border text-muted-foreground';
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="코인 검색"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">필터</span>
          <Select value={filter} onValueChange={v => setFilter(v as ConsensusFilter)}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">전체</SelectItem>
              <SelectItem value="LONG">롱만 보기</SelectItem>
              <SelectItem value="SHORT">숏만 보기</SelectItem>
              <SelectItem value="WATCH">관망</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">코인</th>
                {MTF_TFS.map(tf => (
                  <th key={tf} className="px-3 py-2 text-center">{tf.toUpperCase()}</th>
                ))}
                <th className="px-3 py-2 text-center">합의 (4TF)</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={MTF_TFS.length + 3} className="p-6 text-center text-muted-foreground">데이터를 불러오는 중...</td></tr>
              )}
              {rows.map(r => {
                const allMatch = (r.longCount === MTF_TFS.length || r.shortCount === MTF_TFS.length);
                return (
                  <tr key={r.coin.id} className="border-b border-border/40 hover:bg-muted/40 transition">
                    <td className="px-3 py-2 text-muted-foreground font-mono">{r.coin.cmc_rank}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-foreground">{r.coin.symbol}</div>
                      <div className="text-[10px] text-muted-foreground">${formatPrice(r.coin.price)}</div>
                    </td>
                    {MTF_TFS.map(tf => {
                      const cell = r.row[tf];
                      if (!cell) return (
                        <td key={tf} className="p-1.5">
                          <Skeleton className="h-9 w-full" />
                        </td>
                      );
                      const cls = dirCellStyle(cell.dir);
                      const arrow = cell.dir === 'LONG' ? '↑' : cell.dir === 'SHORT' ? '↓' : '—';
                      const label = cell.dir === 'LONG' ? '롱' : cell.dir === 'SHORT' ? '숏' : '관망';
                      return (
                        <td key={tf} className="p-1.5 text-center">
                          <button
                            onClick={() => navigate(`/market-analysis?symbol=${r.coin.symbol}`)}
                            className={`w-full inline-flex flex-col items-center px-2 py-1 rounded border font-bold ${cls} hover:brightness-110 transition`}
                          >
                            <span className="text-[11px]">{arrow} {label}</span>
                            <span className="font-mono text-[9px] opacity-80">{cell.score}%</span>
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${dirCellStyle(r.consensus)}`}>
                        {allMatch && <Star className="h-3 w-3 fill-current" />}
                        <span className="font-bold text-[11px]">
                          {r.consensus === 'LONG' ? `롱 ${r.longCount}/${MTF_TFS.length}`
                            : r.consensus === 'SHORT' ? `숏 ${r.shortCount}/${MTF_TFS.length}`
                            : `관망 ${r.longCount}L·${r.shortCount}S`}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
