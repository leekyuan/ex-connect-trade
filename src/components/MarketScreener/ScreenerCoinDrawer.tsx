import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MiniTradingViewChart } from '@/components/charts/MiniTradingViewChart';
import { useEffect, useState } from 'react';
import { computeUnifiedSignal, LABEL_META, type UnifiedSignal } from '@/utils/unifiedSignal';
import type { Candle } from '@/utils/indicators';
import { Link } from 'react-router-dom';
import { ExternalLink, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  symbol: string | null;
  tvSymbol: string | null;
  price: number | null;
}

export function ScreenerCoinDrawer({ open, onClose, symbol, tvSymbol, price }: Props) {
  const [signal, setSignal] = useState<UnifiedSignal | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !symbol) return;
    let alive = true;
    setLoading(true);
    setSignal(null);
    fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1h&limit=300`)
      .then(r => r.json())
      .then((raw: any[]) => {
        if (!alive) return;
        const candles: Candle[] = raw.map(c => ({
          time: c[0],
          open: parseFloat(c[1]), high: parseFloat(c[2]),
          low: parseFloat(c[3]),  close: parseFloat(c[4]),
          volume: parseFloat(c[5]),
        }));
        const last = price ?? candles[candles.length - 1].close;
        setSignal(computeUnifiedSignal(candles, last));
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [open, symbol, price]);

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>{symbol} 빠른 분석</span>
            {signal && (
              <Badge className={`${LABEL_META[signal.label].bg} ${LABEL_META[signal.label].cls} ${LABEL_META[signal.label].border} border`}>
                {LABEL_META[signal.label].emoji} {LABEL_META[signal.label].ko} · {signal.score}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>1시간봉 · 6대 이론 통합 신호</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {tvSymbol && <MiniTradingViewChart tvSymbol={tvSymbol} interval="60" height={260} />}

          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {signal && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted p-2">
                  <div className="text-[10px] text-muted-foreground">기술 (40)</div>
                  <div className="text-sm font-mono font-bold">{signal.breakdown.technical}</div>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <div className="text-[10px] text-muted-foreground">패턴 (35)</div>
                  <div className="text-sm font-mono font-bold">{signal.breakdown.pattern}</div>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <div className="text-[10px] text-muted-foreground">추세 (25)</div>
                  <div className="text-sm font-mono font-bold">{signal.breakdown.trend}</div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 text-xs space-y-1">
                <div className="text-foreground font-semibold mb-1">트레이드 플랜</div>
                <div className="grid grid-cols-2 gap-1 font-mono">
                  <span className="text-muted-foreground">진입가</span><span>${signal.entry}</span>
                  <span className="text-muted-foreground">TP1</span><span className="text-emerald-400">${signal.tp1}</span>
                  <span className="text-muted-foreground">TP2</span><span className="text-emerald-400">${signal.tp2}</span>
                  <span className="text-muted-foreground">손절</span><span className="text-red-400">${signal.sl}</span>
                  <span className="text-muted-foreground">1차 저항</span><span>${signal.resistance1.price.toFixed(2)}</span>
                  <span className="text-muted-foreground">2차 저항</span><span>${signal.resistance2.price.toFixed(2)}</span>
                  <span className="text-muted-foreground">1차 지지</span><span>${signal.support1.price.toFixed(2)}</span>
                  <span className="text-muted-foreground">2차 지지</span><span>${signal.support2.price.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
                {signal.comment}
              </div>

              <Button asChild variant="outline" className="w-full" size="sm">
                <Link to={`/market-analysis?symbol=${symbol}`}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> 풀 분석 보기
                </Link>
              </Button>
              <Button
                variant="default" className="w-full" size="sm"
                onClick={async () => {
                  const { data: u } = await supabase.auth.getUser();
                  if (!u.user) { toast.error('로그인 필요'); return; }
                  const side = signal.label === 'STRONG_BUY' || signal.label === 'BUY'
                    ? 'LONG'
                    : signal.label === 'STRONG_SELL' || signal.label === 'SELL'
                      ? 'SHORT'
                      : 'WATCH';
                  const strength = signal.label.startsWith('STRONG') ? 'STRONG'
                    : signal.label === 'WATCH' ? 'WEAK' : 'MODERATE';
                  const { error } = await supabase.from('signal_history').insert({
                    user_id: u.user.id,
                    symbol: `${symbol}USDT`,
                    timeframe: '1h',
                    side, strength,
                    confidence: signal.score,
                    entry_price: Number(signal.entry),
                    sl_price: Number(signal.sl),
                    tp1_price: Number(signal.tp1),
                    tp2_price: Number(signal.tp2),
                    reasons: { comment: signal.comment, breakdown: signal.breakdown },
                    source: 'screener',
                  });
                  if (error) toast.error('저장 실패: ' + error.message);
                  else toast.success('신호가 적중률 추적에 추가되었습니다');
                }}
              >
                <Save className="h-3.5 w-3.5 mr-1.5" /> 신호 추적에 저장
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
