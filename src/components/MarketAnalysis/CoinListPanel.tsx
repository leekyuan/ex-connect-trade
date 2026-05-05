import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Clock, Star, Zap, BarChart3 } from 'lucide-react';
import type { CoinAnalysis, TradingMode } from '@/hooks/useMarketAnalysis';
import { MODE_CONFIG } from '@/hooks/useMarketAnalysis';
import { useFavorites } from '@/hooks/useFavorites';
import { CoinTheoryModal } from './CoinTheoryModal';

interface Props {
  analyses: CoinAnalysis[];
  mode: TradingMode;
  onModeChange: (m: TradingMode) => void;
  onSelectCoin: (a: CoinAnalysis) => void;
  selectedSymbol: string;
  loading: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

type ListFilter = 'ALL' | 'CAP30' | 'VOL30' | 'FAV';
type ConfFilter = 0 | 50 | 65 | 80;

const SIGNAL_STYLE = {
  LONG: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'LONG', icon: TrendingUp },
  SHORT: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: 'SHORT', icon: TrendingDown },
  WATCH: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400', label: '관망', icon: Minus },
};

const MODE_BUTTONS: { key: TradingMode; label: string; color: string }[] = [
  { key: 'scalping', label: '스캘핑', color: 'bg-purple-600 hover:bg-purple-700' },
  { key: 'daytrading', label: '단타', color: 'bg-blue-600 hover:bg-blue-700' },
  { key: 'swing', label: '스윙', color: 'bg-amber-600 hover:bg-amber-700' },
];

function fmt(n: number, d = 2) {
  return n.toLocaleString('ko-KR', { maximumFractionDigits: d });
}
function fmtPct(n: number) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}
function fmtCap(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

function modeChange(coin: CoinAnalysis['coin'], mode: TradingMode): { label: string; value: number } {
  if (mode === 'scalping') return { label: '1H', value: coin.percent_change_1h };
  if (mode === 'swing') return { label: '7D', value: coin.percent_change_7d };
  return { label: '24H', value: coin.percent_change_24h };
}

export function CoinListPanel({
  analyses, mode, onModeChange, onSelectCoin,
  selectedSymbol, loading, lastUpdated, onRefresh,
}: Props) {
  const [signalFilter, setSignalFilter] = useState<'ALL' | 'LONG' | 'SHORT' | 'WATCH'>('ALL');
  const [listFilter, setListFilter] = useState<ListFilter>('ALL');
  const [confFilter, setConfFilter] = useState<ConfFilter>(0);
  const [sortBy, setSortBy] = useState<'rank' | 'signal' | 'change'>('signal');
  const [theoryModal, setTheoryModal] = useState<CoinAnalysis | null>(null);
  const { has: isFav, toggle: toggleFav, favs } = useFavorites();

  useEffect(() => { setSortBy('signal'); }, [mode]);

  const cfg = MODE_CONFIG[mode];

  // Counts for the list filter tabs
  const cap30Count = useMemo(() => analyses.filter(a => a.coin.is_top_cap).length, [analyses]);
  const vol30Count = useMemo(() => analyses.filter(a => a.coin.is_top_volume).length, [analyses]);
  const favCount = useMemo(() => analyses.filter(a => favs.has(a.coin.symbol)).length, [analyses, favs]);

  // Apply list filter first, then signal filter
  const listFiltered = analyses.filter(a => {
    if (listFilter === 'CAP30') return a.coin.is_top_cap;
    if (listFilter === 'VOL30') return a.coin.is_top_volume;
    if (listFilter === 'FAV') return favs.has(a.coin.symbol);
    return true;
  });

  const sorted = [...listFiltered]
    .filter(a => signalFilter === 'ALL' || a.signal === signalFilter)
    .filter(a => a.confidence >= confFilter)
    .sort((a, b) => {
      if (sortBy === 'signal') {
        const order = { LONG: 0, SHORT: 1, WATCH: 2 };
        const diff = order[a.signal] - order[b.signal];
        if (diff !== 0) return diff;
        return b.confidence - a.confidence;
      }
      if (sortBy === 'change') {
        const aVal = Math.abs(modeChange(a.coin, mode).value);
        const bVal = Math.abs(modeChange(b.coin, mode).value);
        return bVal - aVal;
      }
      return a.coin.cmc_rank - b.coin.cmc_rank;
    });

  const longCount = listFiltered.filter(a => a.signal === 'LONG').length;
  const shortCount = listFiltered.filter(a => a.signal === 'SHORT').length;
  const watchCount = listFiltered.filter(a => a.signal === 'WATCH').length;

  const LIST_TABS: { key: ListFilter; label: string; count: number }[] = [
    { key: 'ALL', label: '전체', count: analyses.length },
    { key: 'CAP30', label: '시총 Top30', count: cap30Count },
    { key: 'VOL30', label: '거래량 Top30', count: vol30Count },
    { key: 'FAV', label: '★ 즐겨찾기', count: favCount },
  ];

  const CONF_TABS: { key: ConfFilter; label: string }[] = [
    { key: 0, label: '전체' },
    { key: 50, label: '50%+' },
    { key: 65, label: '65%+' },
    { key: 80, label: '80%+' },
  ];

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border">
      {/* Header */}
      <div className="p-3 space-y-3 border-b border-border">
        {/* Mode selection */}
        <div className="flex gap-1">
          {MODE_BUTTONS.map(btn => (
            <button
              key={btn.key}
              onClick={() => onModeChange(btn.key)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === btn.key
                  ? `${btn.color} text-white`
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Mode description */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{cfg.timeframes.join(' · ')} — {cfg.description}</span>
        </div>

        {/* List filter tabs (시총/거래량) */}
        <div className="flex gap-1">
          {LIST_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setListFilter(tab.key)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
                listFilter === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1 rounded ${
                listFilter === tab.key ? 'bg-primary-foreground/20' : 'bg-background/40'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Confidence filter */}
        <div className="flex gap-1">
          {CONF_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setConfFilter(tab.key)}
              className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all ${
                confFilter === tab.key
                  ? 'bg-primary/80 text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              신뢰도 {tab.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'LONG', count: longCount, color: 'text-emerald-400', bg: 'bg-emerald-500/10', filterVal: 'LONG' as const },
            { label: 'SHORT', count: shortCount, color: 'text-red-400', bg: 'bg-red-500/10', filterVal: 'SHORT' as const },
            { label: '관망', count: watchCount, color: 'text-gray-400', bg: 'bg-muted', filterVal: 'WATCH' as const },
          ].map(s => (
            <button
              key={s.label}
              onClick={() => setSignalFilter(prev => prev === s.filterVal ? 'ALL' : s.filterVal)}
              className={`${s.bg} rounded-lg p-2 text-center transition-all ${
                signalFilter === s.filterVal ? 'ring-1 ring-primary' : ''
              }`}
            >
              <p className={`text-lg font-bold ${s.color}`}>{s.count}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Sort + refresh */}
        <div className="flex gap-2 items-center">
          <select
            value={signalFilter}
            onChange={e => setSignalFilter(e.target.value as any)}
            className="flex-1 bg-muted border border-border rounded-lg text-xs text-foreground px-2 py-1.5"
          >
            <option value="ALL">신호: 전체</option>
            <option value="LONG">LONG ({longCount})</option>
            <option value="SHORT">SHORT ({shortCount})</option>
            <option value="WATCH">관망 ({watchCount})</option>
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="flex-1 bg-muted border border-border rounded-lg text-xs text-foreground px-2 py-1.5"
          >
            <option value="signal">신호 순</option>
            <option value="rank">시총 순위</option>
            <option value="change">변동률 순</option>
          </select>
          <button onClick={onRefresh} className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {lastUpdated && (
          <p className="text-[10px] text-muted-foreground text-right">
            업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
          </p>
        )}
      </div>

      {/* Coin list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map(analysis => {
          const { coin, signal, confidence, indicators } = analysis;
          const st = SIGNAL_STYLE[signal];
          const Icon = st.icon;
          const mc = modeChange(coin, mode);
          const isSelected = coin.tvSymbol === selectedSymbol;
          const isWatch = signal === 'WATCH';

          // Badge: 시총+거래량 동시 → 금별, 거래량만 → 번개
          const isBoth = coin.is_top_cap && coin.is_top_volume;
          const isVolOnly = !coin.is_top_cap && coin.is_top_volume;

          return (
            <div
              key={coin.id}
              onClick={() => onSelectCoin(analysis)}
              className={`p-2 sm:p-3 border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-all ${
                isSelected ? 'bg-muted/80 border-l-2 border-l-primary' : ''
              } ${isWatch ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFav(coin.symbol); }}
                    className="shrink-0 p-0.5 hover:scale-110 transition-transform"
                    title={isFav(coin.symbol) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                  >
                    <Star className={`h-3.5 w-3.5 ${isFav(coin.symbol) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/40'}`} />
                  </button>
                  <span className="text-[10px] text-muted-foreground w-5 text-right shrink-0">
                    {coin.cmc_rank}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{coin.symbol}</span>
                      {isBoth && (
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" aria-label="시총+거래량 Top30" />
                      )}
                      {isVolOnly && (
                        <Zap className="h-3 w-3 text-blue-400 fill-blue-400" aria-label="거래량 Top30" />
                      )}
                      <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${st.bg} ${st.text}`}>
                        <Icon className="h-2.5 w-2.5" />
                        {st.label} {confidence}%
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate hidden sm:block">{coin.name}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-mono text-foreground">
                    ${fmt(coin.price, coin.price < 1 ? 6 : 2)}
                  </p>
                  <div className="flex items-center gap-1 justify-end">
                    <span className="text-[9px] text-muted-foreground">{mc.label}</span>
                    <p className={`text-xs font-mono font-semibold ${mc.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmtPct(mc.value)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      signal === 'LONG' ? 'bg-emerald-500' : signal === 'SHORT' ? 'bg-red-500' : 'bg-gray-500'
                    }`}
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>

              {/* Entry / SL / TP one-liner */}
              {!isWatch && (analysis.longEntry || analysis.shortEntry) && (
                <div className="flex items-center gap-1.5 text-[9px] mb-1 font-mono">
                  <span className="text-muted-foreground">진입</span>
                  <span className="text-foreground">{fmt(analysis.longEntry ?? analysis.shortEntry ?? 0, coin.price < 1 ? 6 : 2)}</span>
                  <span className="text-red-400">SL {fmt(analysis.stopLoss, coin.price < 1 ? 6 : 2)}</span>
                  <span className="text-emerald-400">TP1 {fmt(analysis.tp1, coin.price < 1 ? 6 : 2)}</span>
                  <span className="ml-auto text-primary font-semibold">R:R 1:{analysis.riskReward.toFixed(1)}</span>
                </div>
              )}

              <div className="hidden sm:flex gap-1 flex-wrap items-center">
                {[indicators.trend, indicators.volume].map((tag, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {tag}
                  </span>
                ))}
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {fmtCap(coin.market_cap)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setTheoryModal(analysis); }}
                  className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-primary/15 hover:bg-primary/25 text-primary font-medium flex items-center gap-1 transition-colors"
                  title="6대 이론 분석 모달 열기"
                >
                  <BarChart3 className="h-2.5 w-2.5" />
                  6대 이론
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <CoinTheoryModal
        coin={theoryModal}
        mode={mode}
        open={!!theoryModal}
        onOpenChange={(o) => { if (!o) setTheoryModal(null); }}
      />
    </div>
  );
}
