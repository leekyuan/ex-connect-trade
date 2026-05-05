import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCoinMarketCap, type CoinData } from '@/hooks/useCoinMarketCap';
import { useScreenerScores } from '@/hooks/useScreenerScores';
import { useBinanceTicker } from '@/hooks/useBinanceTicker';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowDown, ArrowUp, ArrowUpDown, RefreshCw, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { ScreenerCoinDrawer } from '@/components/MarketScreener/ScreenerCoinDrawer';
import { Input } from '@/components/ui/input';

type SortKey = 'rank' | 'price' | 'ch1h' | 'ch24h' | 'vol' | 'mcap' | 'rsi' | 'score';
type StratFilter = 'ALL' | 'SCALP' | 'DAY' | 'SWING';
type ChFilter = 'ALL' | '3' | '5' | '10';
type VolFilter = 'ALL' | '200' | '300';

const REFRESH_MS = 30_000;

export default function MarketScreenerPage() {
  const { coins, loading, lastUpdated, refetch } = useCoinMarketCap(REFRESH_MS);
  const tickers = useBinanceTicker(15_000);

  // 시총 TOP 30 추출
  const top30 = useMemo(() => coins.slice(0, 30), [coins]);
  const symbols = useMemo(() => top30.map(c => c.symbol), [top30]);

  const { scores, progress, total } = useScreenerScores(symbols, REFRESH_MS);

  // 필터 / 정렬
  const [strat, setStrat] = useState<StratFilter>('ALL');
  const [chFilter, setChFilter] = useState<ChFilter>('ALL');
  const [volFilter, setVolFilter] = useState<VolFilter>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [query, setQuery] = useState('');

  // 카운트다운
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  useEffect(() => {
    const id = setInterval(() => setCountdown(c => (c <= 1 ? REFRESH_MS / 1000 : c - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { setCountdown(REFRESH_MS / 1000); }, [lastUpdated]);

  // 사이드 패널
  const [openSym, setOpenSym] = useState<CoinData | null>(null);

  // 행 데이터 가공
  const rows = useMemo(() => {
    return top30.map(c => {
      const t = tickers[`${c.symbol}USDT`];
      const liveChange24h = t?.priceChangePercent ?? c.percent_change_24h;
      const livePrice = t?.lastPrice ?? c.price;
      const liveVol = t?.quoteVolume ?? c.volume_24h;
      const s = scores[c.symbol] ?? null;
      return {
        coin: c,
        price: livePrice,
        ch1h: c.percent_change_1h,
        ch4h: (c.percent_change_24h - c.percent_change_1h) / 6, // CMC가 4h 미제공 → 추정
        ch24h: liveChange24h,
        vol: liveVol,
        mcap: c.market_cap,
        rsi: s?.rsi ?? null,
        score: s?.score ?? null,
        scalp: s?.scalp ?? 50,
        day: s?.day ?? 50,
        swing: s?.swing ?? 50,
        strategy: s?.strategy ?? 'DAY',
        volSpike: s?.volumeSpike ?? 1,
      };
    });
  }, [top30, tickers, scores]);

  const filtered = useMemo(() => {
    let f = rows;
    if (query.trim()) {
      const q = query.toUpperCase();
      f = f.filter(r => r.coin.symbol.includes(q) || r.coin.name.toUpperCase().includes(q));
    }
    if (strat !== 'ALL') f = f.filter(r => r.strategy === strat);
    if (chFilter !== 'ALL') {
      const lim = Number(chFilter);
      f = f.filter(r => Math.abs(r.ch24h) >= lim);
    }
    if (volFilter !== 'ALL') {
      const lim = Number(volFilter) / 100;
      f = f.filter(r => r.volSpike >= lim);
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    const get = (r: typeof rows[number]): number => {
      switch (sortKey) {
        case 'rank': return r.coin.cmc_rank;
        case 'price': return r.price;
        case 'ch1h': return r.ch1h;
        case 'ch24h': return r.ch24h;
        case 'vol': return r.vol;
        case 'mcap': return r.mcap;
        case 'rsi': return r.rsi ?? -1;
        case 'score': return r.score ?? -1;
      }
    };
    return [...f].sort((a, b) => (get(a) - get(b)) * dir);
  }, [rows, sortKey, sortDir, strat, chFilter, volFilter, query]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'rank' ? 'asc' : 'desc'); }
  };

  const SortHeader = ({ k, label, className = '' }: { k: SortKey; label: string; className?: string }) => (
    <button onClick={() => toggleSort(k)} className={`flex items-center gap-1 hover:text-foreground transition ${className}`}>
      {label}
      {sortKey === k ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
    </button>
  );

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" /> 마켓 스크리너
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              CoinMarketCap TOP 30 · 스테이블 제외 · 30초 자동 새로고침 · {progress}/{total} 분석 완료
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">{countdown}s</span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> 새로고침
            </Button>
          </div>
        </header>

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
            <span className="text-[11px] text-muted-foreground">전략</span>
            <Select value={strat} onValueChange={v => setStrat(v as StratFilter)}>
              <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체</SelectItem>
                <SelectItem value="SCALP">스캘핑</SelectItem>
                <SelectItem value="DAY">단타</SelectItem>
                <SelectItem value="SWING">스윙</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">변동률</span>
            <Select value={chFilter} onValueChange={v => setChFilter(v as ChFilter)}>
              <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체</SelectItem>
                <SelectItem value="3">±3% 이상</SelectItem>
                <SelectItem value="5">±5% 이상</SelectItem>
                <SelectItem value="10">±10% 이상</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">거래량</span>
            <Select value={volFilter} onValueChange={v => setVolFilter(v as VolFilter)}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체</SelectItem>
                <SelectItem value="200">평균 대비 200%↑</SelectItem>
                <SelectItem value="300">평균 대비 300%↑</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 테이블 */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left"><SortHeader k="rank" label="#" /></th>
                  <th className="px-3 py-2 text-left">코인</th>
                  <th className="px-3 py-2 text-right"><SortHeader k="price" label="현재가" className="ml-auto" /></th>
                  <th className="px-3 py-2 text-right"><SortHeader k="ch1h" label="1h" className="ml-auto" /></th>
                  <th className="px-3 py-2 text-right hidden md:table-cell">4h</th>
                  <th className="px-3 py-2 text-right"><SortHeader k="ch24h" label="24h" className="ml-auto" /></th>
                  <th className="px-3 py-2 text-right hidden lg:table-cell"><SortHeader k="vol" label="거래량 24h" className="ml-auto" /></th>
                  <th className="px-3 py-2 text-right hidden lg:table-cell"><SortHeader k="mcap" label="시총" className="ml-auto" /></th>
                  <th className="px-3 py-2 text-right"><SortHeader k="rsi" label="RSI(1h)" className="ml-auto" /></th>
                  <th className="px-3 py-2 text-right"><SortHeader k="score" label="신호" className="ml-auto" /></th>
                  <th className="px-3 py-2 text-center">전략</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td colSpan={11} className="p-2"><Skeleton className="h-7 w-full" /></td>
                      </tr>
                    ))
                  : filtered.map(r => {
                      const upCh1h = r.ch1h >= 0;
                      const upCh24h = r.ch24h >= 0;
                      return (
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
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">${formatPrice(r.price)}</td>
                          <td className={`px-3 py-2 text-right font-mono ${upCh1h ? 'text-emerald-400' : 'text-red-400'}`}>
                            {upCh1h ? '+' : ''}{r.ch1h.toFixed(2)}%
                          </td>
                          <td className={`px-3 py-2 text-right font-mono hidden md:table-cell ${r.ch4h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {r.ch4h >= 0 ? '+' : ''}{r.ch4h.toFixed(2)}%
                          </td>
                          <td className={`px-3 py-2 text-right font-mono ${upCh24h ? 'text-emerald-400' : 'text-red-400'}`}>
                            <span className="inline-flex items-center gap-1">
                              {upCh24h ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {upCh24h ? '+' : ''}{r.ch24h.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground hidden lg:table-cell">${formatBig(r.vol)}</td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground hidden lg:table-cell">${formatBig(r.mcap)}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {r.rsi == null ? <Skeleton className="h-3 w-8 ml-auto" /> :
                              <span className={r.rsi > 70 ? 'text-red-400' : r.rsi < 30 ? 'text-emerald-400' : ''}>{r.rsi.toFixed(0)}</span>
                            }
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {r.score == null ? <Skeleton className="h-3 w-8 ml-auto" /> :
                              <SignalCell score={r.score} />
                            }
                          </td>
                          <td className="px-3 py-2 text-center">
                            {r.score == null ? <Skeleton className="h-5 w-12 mx-auto" /> :
                              <Badge variant="outline" className={stratColor(r.strategy)}>{stratLabel(r.strategy)}</Badge>
                            }
                          </td>
                        </tr>
                      );
                    })}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={11} className="p-6 text-center text-muted-foreground text-sm">조건에 맞는 코인이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

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
function formatBig(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return n.toFixed(0);
}
function stratLabel(s: 'SCALP' | 'DAY' | 'SWING'): string {
  return s === 'SCALP' ? '스캘핑' : s === 'DAY' ? '단타' : '스윙';
}
function stratColor(s: 'SCALP' | 'DAY' | 'SWING'): string {
  if (s === 'SCALP') return 'border-purple-500/40 text-purple-300';
  if (s === 'DAY') return 'border-blue-500/40 text-blue-300';
  return 'border-emerald-500/40 text-emerald-300';
}

function SignalCell({ score }: { score: number }) {
  // score 0-100 around 50; >=60 LONG, <=40 SHORT, else 관망
  if (score >= 60) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">LONG</span>
        <span className="font-mono text-emerald-400 w-7 text-right">{score}</span>
      </span>
    );
  }
  if (score <= 40) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">SHORT</span>
        <span className="font-mono text-red-400 w-7 text-right">{score}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 justify-end">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
      <span className="font-mono text-muted-foreground w-7 text-right">—</span>
    </span>
  );
}
