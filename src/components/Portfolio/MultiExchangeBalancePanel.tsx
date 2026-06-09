/**
 * 멀티거래소 잔고 조회 패널
 * - 서버측 exchange_api_keys (RLS) 에 저장된 키로 잔고를 조회합니다.
 * - Binance는 binance-proxy edge function 으로 실제 잔고 조회.
 * - OKX/Bybit/Bitget/Gate.io 는 현재 백엔드 프록시 미지원으로 "키 저장됨" 만 표시.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Wallet, AlertCircle } from "lucide-react";
import { getFuturesBalance } from "@/utils/exchangeApi";
import { supabase } from "@/integrations/supabase/client";

interface ExMeta { id: string; name: string; emoji: string; }
const EXCHANGES: ExMeta[] = [
  { id: 'binance', name: 'Binance Futures', emoji: '🟡' },
  { id: 'okx',     name: 'OKX',             emoji: '⬛' },
  { id: 'bybit',   name: 'Bybit',           emoji: '🟠' },
  { id: 'bitget',  name: 'Bitget',          emoji: '🔵' },
  { id: 'gate',    name: 'Gate.io',         emoji: '🟢' },
];

interface Row {
  id: string; name: string; emoji: string;
  status: 'idle' | 'loading' | 'connected' | 'unsaved' | 'error' | 'unsupported';
  balance?: string;
  error?: string;
}

export default function MultiExchangeBalancePanel() {
  const [rows, setRows] = useState<Row[]>(
    EXCHANGES.map(ex => ({ ...ex, status: 'idle' }))
  );
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    const { data: keyRows } = await (supabase as any)
      .from('exchange_api_keys')
      .select('exchange');
    const hasKey = new Set<string>((keyRows ?? []).map((r: any) => r.exchange));

    const next: Row[] = [];
    for (const ex of EXCHANGES) {
      if (!hasKey.has(ex.id)) {
        next.push({ ...ex, status: 'unsaved' });
        continue;
      }
      if (ex.id !== 'binance') {
        next.push({ ...ex, status: 'unsupported' });
        continue;
      }
      try {
        const bal = await getFuturesBalance();
        next.push({ ...ex, status: 'connected', balance: bal });
      } catch (e: any) {
        next.push({ ...ex, status: 'error', error: e?.message ?? String(e) });
      }
    }
    setRows(next);
    setRefreshing(false);
  };

  useEffect(() => { refresh(); }, []);

  const totalUsdt = rows
    .filter(r => r.status === 'connected' && r.balance)
    .reduce((s, r) => s + parseFloat(r.balance || '0'), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> 거래소 잔고
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            설정 → 거래소 API 연동에서 키를 등록하면 여기에 표시됩니다.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">합계 (조회된 USDT)</span>
          <span className="text-lg font-bold text-emerald-400">${totalUsdt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>

        {rows.map(r => (
          <div key={r.id} className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5">
            <span className="text-xl">{r.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{r.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {r.status === 'connected' && `✓ ${parseFloat(r.balance || '0').toLocaleString()} USDT`}
                {r.status === 'unsaved' && '미설정 — 설정 페이지에서 API 키 등록'}
                {r.status === 'unsupported' && '키 저장됨 · 잔고 조회는 추후 지원 예정'}
                {r.status === 'error' && (
                  <span className="text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {r.error}
                  </span>
                )}
                {r.status === 'loading' && '조회 중...'}
                {r.status === 'idle' && '대기'}
              </div>
            </div>
            <span
              className={`h-2 w-2 rounded-full ${
                r.status === 'connected' ? 'bg-emerald-500' :
                r.status === 'error' ? 'bg-destructive' :
                r.status === 'unsupported' ? 'bg-amber-500' :
                'bg-muted-foreground/40'
              }`}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
