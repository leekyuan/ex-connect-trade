import { useEffect, useState, useCallback } from 'react';
import { Activity, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { loadCreds, getOpenPositions, closePosition, type FuturesPosition } from '@/utils/exchangeApi';
import { Link } from 'react-router-dom';

export function LivePositionsPanel() {
  const [positions, setPositions] = useState<FuturesPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creds = loadCreds();

  const refresh = useCallback(async () => {
    if (!creds) return;
    setLoading(true);
    try {
      const list = await getOpenPositions();
      setPositions(list);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally { setLoading(false); }
  }, [creds]);

  useEffect(() => {
    if (!creds) return;
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [creds, refresh]);

  const handleClose = async (p: FuturesPosition) => {
    try {
      await closePosition(p.symbol, p.positionAmt);
      toast.success(`${p.symbol} 청산 완료`);
      refresh();
    } catch (e: any) { toast.error(`청산 실패: ${e.message ?? e}`); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-red-400" />
          <h3 className="text-sm font-bold">실시간 포지션 (LIVE)</h3>
          {loading && <span className="text-[10px] text-muted-foreground">갱신 중…</span>}
        </div>
        <span className="text-[10px] text-muted-foreground">30s 자동 갱신</span>
      </div>

      {!creds ? (
        <div className="text-xs text-muted-foreground bg-muted rounded-md p-3">
          API 키 미설정 — <Link to="/settings" className="text-primary underline">설정 &gt; API 연결</Link>
        </div>
      ) : error ? (
        <div className="text-xs text-red-400 bg-red-500/10 rounded-md p-2">{error}</div>
      ) : positions.length === 0 ? (
        <div className="text-xs text-muted-foreground bg-muted rounded-md p-3 text-center">오픈 포지션 없음</div>
      ) : (
        <div className="space-y-2">
          {positions.map(p => {
            const pnl = p.unRealizedProfit;
            const pct = ((p.markPrice / p.entryPrice - 1) * 100) * (p.side === 'LONG' ? 1 : -1);
            return (
              <div key={p.symbol} className="rounded-lg border border-border p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{p.symbol}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      p.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>{p.side}</span>
                    <span className="text-[10px] text-muted-foreground">{p.leverage}x</span>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" className="h-7 text-[11px] px-2">
                        <X className="h-3 w-3 mr-1" /> 즉시 청산
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{p.symbol} 포지션을 청산하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {p.side} {Math.abs(p.positionAmt)} 계약을 시장가로 즉시 종료합니다.
                          미실현 손익 ${pnl.toFixed(2)} ({pct.toFixed(2)}%)이 실현됩니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleClose(p)}>청산</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div><span className="text-muted-foreground">진입</span> ${p.entryPrice.toFixed(2)}</div>
                  <div><span className="text-muted-foreground">현재</span> ${p.markPrice.toFixed(2)}</div>
                  <div className={`text-right font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pct.toFixed(2)}%)
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
