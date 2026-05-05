import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, RefreshCw, Zap, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCoinMarketCap } from '@/hooks/useCoinMarketCap';
import { useBinanceOHLCV } from '@/hooks/useBinanceOHLCV';
import { getStoredWeights, THEORY_LABELS, type TheoryKey } from '@/hooks/useTheoryWeights';
import { analyzeElliott } from '@/utils/theories/elliott';
import { analyzeDow } from '@/utils/theories/dow';
import { analyzeWyckoff } from '@/utils/theories/wyckoff';
import { analyzeGann } from '@/utils/theories/gann';
import { analyzeFibonacci } from '@/utils/theories/fibonacci';
import { analyzeICT } from '@/utils/theories/ict';
import { calcATR } from '@/utils/indicators';
import { toast } from 'sonner';

interface SignalRow {
  symbol: string;
  signal: 'LONG' | 'SHORT';
  confidence: number;
  entry: number;
  sl: number | null;
  tp1: number | null;
  theories: string[];
}

interface Props {
  onQuickEntry?: (row: SignalRow) => void;
}

const REFRESH_MS = 30_000;
const TOP_N = 3;
const MAX_SYMBOLS = 8;

const ANALYZERS = {
  elliott: analyzeElliott,
  dow: analyzeDow,
  wyckoff: analyzeWyckoff,
  gann: analyzeGann,
  fibonacci: analyzeFibonacci,
  ict: analyzeICT,
} as const;

const ANALYZER_KEYS: (keyof typeof ANALYZERS)[] = ['elliott', 'dow', 'wyckoff', 'gann', 'fibonacci', 'ict'];

export function TopSignalsWidget({ onQuickEntry }: Props) {
  const navigate = useNavigate();
  const { coins } = useCoinMarketCap();

  const monitoredSymbols = useMemo(
    () => coins.slice(0, MAX_SYMBOLS).map(c => c.symbol),
    [coins],
  );

  const ohlcv = useBinanceOHLCV(monitoredSymbols, 'daytrading');

  const [tick, setTick] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [knownIds, setKnownIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1);
      setLastUpdate(Date.now());
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const top: SignalRow[] = useMemo(() => {
    const weights = getStoredWeights();
    const minConfirm = 2;
    const rows: SignalRow[] = [];

    for (const sym of monitoredSymbols) {
      const data = ohlcv[sym];
      const coin = coins.find(c => c.symbol === sym);
      if (!data || !coin || data.candles.length < 25) continue;
      const candles = data.candles;
      const price = coin.price;

      // Run each price-based theory; skip 'fundamental' (needs API per coin).
      const sigs = ANALYZER_KEYS.map(k => ({ key: k as TheoryKey, sig: ANALYZERS[k](candles, price) }));
      let weighted = 0, total = 0;
      sigs.forEach(({ key, sig }) => {
        const w = weights[key] ?? 1;
        if (w <= 0) return;
        const score = sig.signal === 'LONG' ? sig.confidence : sig.signal === 'SHORT' ? -sig.confidence : 0;
        weighted += score * w;
        total += w;
      });
      const finalScore = total > 0 ? weighted / total : 0;
      let dir: 'LONG' | 'SHORT' | null = null;
      if (finalScore >= 25) dir = 'LONG';
      else if (finalScore <= -25) dir = 'SHORT';
      if (!dir) continue;
      const confirms = sigs.filter(s => s.sig.signal === dir && s.sig.confidence >= 50 && (weights[s.key] ?? 0) > 0);
      if (confirms.length < minConfirm) continue;
      const conf = Math.round(Math.min(100, Math.abs(finalScore)));
      if (conf < 50) continue;

      const atrArr = calcATR(candles, 14);
      const atr = atrArr[atrArr.length - 1];
      let sl: number | null = null;
      let tp1: number | null = null;
      if (isFinite(atr) && atr > 0) {
        const risk = atr * 1.5;
        sl = dir === 'LONG' ? price - risk : price + risk;
        tp1 = dir === 'LONG' ? price + risk * 1.5 : price - risk * 1.5;
      }

      rows.push({
        symbol: sym,
        signal: dir,
        confidence: conf,
        entry: price,
        sl,
        tp1,
        theories: confirms.map(c => THEORY_LABELS[c.key]),
      });
    }

    rows.sort((a, b) => b.confidence - a.confidence);
    return rows.slice(0, TOP_N);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    monitoredSymbols.join(','),
    coins.map(c => `${c.symbol}:${c.price}`).join('|'),
    Object.values(ohlcv).map(o => `${o.symbol}:${o.candles.length}`).join('|'),
    tick,
  ]);

  // Toast on new high-confidence signals
  useEffect(() => {
    const next = new Set(knownIds);
    let added = false;
    top.forEach(row => {
      if (row.confidence < 70) return;
      const id = `${row.symbol}-${row.signal}`;
      if (!knownIds.has(id)) {
        toast.success(`${row.symbol} ${row.signal} 신호`, {
          description: `신뢰도 ${row.confidence}% · ${row.theories.slice(0, 2).join(', ')}`,
        });
        next.add(id);
        added = true;
      }
    });
    if (added) setKnownIds(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top.map(r => `${r.symbol}-${r.signal}-${r.confidence}`).join('|')]);

  const handleEntry = (row: SignalRow) => {
    if (onQuickEntry) onQuickEntry(row);
    else toast.info(`${row.symbol} ${row.signal} 진입 신호 — 주문 패널에서 확인하세요`, {
      description: `진입 $${row.entry.toFixed(2)} · SL ${row.sl ? `$${row.sl.toFixed(2)}` : '-'}`,
    });
  };
  const handleBacktest = (row: SignalRow) => {
    navigate(`/backtest?symbol=${row.symbol}&mode=daytrading`);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">실시간 매매 추천 TOP {TOP_N}</h3>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{Math.max(0, Math.round((REFRESH_MS - (Date.now() - lastUpdate)) / 1000))}s 후 갱신</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => { setTick(t => t + 1); setLastUpdate(Date.now()); }}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {top.length === 0 ? (
        <div className="rounded border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
          현재 컨펌된 고신뢰 신호 없음 — 모니터링 중...
        </div>
      ) : (
        <div className="grid gap-2 lg:grid-cols-3">
          {top.map(row => {
            const tone =
              row.confidence >= 80 ? 'border-success/40 bg-success/5'
              : row.confidence >= 65 ? 'border-warning/40 bg-warning/5'
              : 'border-border bg-muted/30';
            const sigTone = row.signal === 'LONG' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive';
            const confTone = row.confidence >= 80 ? 'text-success' : row.confidence >= 65 ? 'text-warning' : 'text-muted-foreground';
            return (
              <div key={`${row.symbol}-${row.signal}`} className={`flex flex-col gap-2 rounded-lg border-2 p-3 ${tone}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{row.symbol}/USDT</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${sigTone}`}>{row.signal}</span>
                  </div>
                  <span className={`text-sm font-bold ${confTone}`}>{row.confidence}%</span>
                </div>

                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <div>
                    <div className="text-muted-foreground">진입</div>
                    <div className="font-mono">${row.entry.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">SL</div>
                    <div className="font-mono text-destructive">{row.sl ? `$${row.sl.toFixed(2)}` : '-'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">TP1</div>
                    <div className="font-mono text-success">{row.tp1 ? `$${row.tp1.toFixed(2)}` : '-'}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[10px] text-muted-foreground">{row.theories.join(' · ') || '컨펌 0'}</span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => handleEntry(row)}
                      className="rounded bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground hover:opacity-90"
                    >
                      <Zap className="mr-0.5 inline h-3 w-3" />즉시 진입
                    </button>
                    <button
                      onClick={() => handleBacktest(row)}
                      className="rounded border border-border bg-card px-2 py-1 text-[10px] font-semibold hover:bg-muted"
                    >
                      <FlaskConical className="mr-0.5 inline h-3 w-3" />검증
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
