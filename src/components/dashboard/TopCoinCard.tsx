import { useEffect, useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { MiniTradingViewChart } from '@/components/charts/MiniTradingViewChart';
import { AccuracyBadge } from '@/components/common/AccuracyBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { computeUnifiedSignal, LABEL_META, estimateAccuracy, type UnifiedSignal } from '@/utils/unifiedSignal';
import type { Candle } from '@/utils/indicators';
import type { TopCoin } from '@/hooks/useTopMarketCoins';

interface Props {
  coin: TopCoin;
}

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPrice(p: number) { return `$${fmt(p, p < 1 ? 6 : p < 100 ? 4 : 2)}`; }
function fmtRange(low: number, high: number) {
  const d = low < 1 ? 6 : low < 100 ? 4 : 2;
  return `$${fmt(low, d)} – $${fmt(high, d)}`;
}

export function TopCoinCard({ coin }: Props) {
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch 1H candles from Binance
  useEffect(() => {
    let alive = true;
    setError(null);
    fetch(`https://api.binance.com/api/v3/klines?symbol=${coin.symbol}USDT&interval=1h&limit=200`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => {
        if (!alive) return;
        const cs: Candle[] = (data as any[]).map(k => ({
          time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5],
        }));
        setCandles(cs);
      })
      .catch(e => alive && setError(e.message));
    return () => { alive = false; };
  }, [coin.symbol]);

  const sig: UnifiedSignal | null = useMemo(
    () => candles ? computeUnifiedSignal(candles, coin.price) : null,
    [candles, coin.price]
  );

  const meta = sig ? LABEL_META[sig.label] : null;
  const biasLabel =
    sig?.bias === 'BULL' ? { txt: '매수세 우위', cls: 'bg-emerald-500 text-white' }
    : sig?.bias === 'BEAR' ? { txt: '매도세 우위', cls: 'bg-red-500 text-white' }
    : { txt: '균형', cls: 'bg-muted text-muted-foreground' };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <img src={coin.image} alt={coin.symbol} className="h-7 w-7 rounded-full" />
          <div className="min-w-0">
            <div className="text-sm font-bold text-foreground">{coin.symbol}/USDT</div>
            <div className="text-[10px] text-muted-foreground truncate">{coin.name}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-mono font-bold text-foreground">{fmtPrice(coin.price)}</div>
          <div className={`text-xs font-mono ${coin.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'} flex items-center justify-end gap-0.5`}>
            {coin.change24h >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Bias badge (large) */}
      <div className="px-4 pt-3 flex items-center justify-between gap-2">
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${biasLabel.cls}`}>{biasLabel.txt}</span>
        {meta && (
          <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${meta.border} ${meta.bg} ${meta.cls}`}>
            {meta.emoji} {meta.ko}
          </span>
        )}
      </div>

      {/* Chart */}
      <div className="px-3 pt-3">
        <MiniTradingViewChart tvSymbol={coin.tvSymbol} interval="60" height={200} />
      </div>

      {/* Accuracy */}
      {sig && (
        <div className="px-4 pt-3">
          <AccuracyBadge accuracy={estimateAccuracy(sig.score)} />
        </div>
      )}

      {/* SR table */}
      <div className="p-4 space-y-2 text-[11px]">
        {error && <div className="text-red-400">차트 데이터 오류: {error}</div>}
        {!sig && !error && (
          <>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </>
        )}
        {sig && (
          <>
            <Row label="2차 저항" price={sig.resistance2.price} range={fmtRange(sig.resistance2.low, sig.resistance2.high)} color="text-red-400" />
            <Row label="1차 저항" price={sig.resistance1.price} range={fmtRange(sig.resistance1.low, sig.resistance1.high)} color="text-orange-400" />
            <div className="border-t border-border my-1" />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>현재가</span>
              <span className="font-mono text-foreground">{fmtPrice(coin.price)}</span>
            </div>
            <div className="border-t border-border my-1" />
            <Row label="1차 지지" price={sig.support1.price} range={fmtRange(sig.support1.low, sig.support1.high)} color="text-emerald-300" />
            <Row label="2차 지지" price={sig.support2.price} range={fmtRange(sig.support2.low, sig.support2.high)} color="text-emerald-400" />
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, price, range, color }: { label: string; price: number; range: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-[10px] font-medium w-14 ${color}`}>{label}</span>
      <span className="font-mono text-foreground">{fmtPrice(price)}</span>
      <span className="text-[10px] text-muted-foreground font-mono">{range}</span>
    </div>
  );
}
