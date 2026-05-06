/**
 * 멀티거래소 잔고 조회 패널
 * - localStorage(cryptoedge_api_*)에 저장된 키를 읽어 잔고를 조회합니다.
 * - Binance는 binance-proxy edge function으로 실제 잔고 조회.
 * - OKX/Bybit/Bitget/Gate.io는 현재 브라우저-사이드 서명 미지원으로 "키 저장됨" 상태만 표시합니다.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Wallet, AlertCircle } from "lucide-react";
import { getFuturesBalance } from "@/utils/exchangeApi";

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

function loadKeys(id: string): { apiKey?: string; secretKey?: string } {
  try {
    const raw = localStorage.getItem(`cryptoedge_api_${id}`);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

export default function MultiExchangeBalancePanel() {
  const [rows, setRows] = useState<Row[]>(
    EXCHANGES.map(ex => ({ ...ex, status: 'idle' }))
  );
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    const next: Row[] = [];
    for (const ex of EXCHANGES) {
      const keys = loadKeys(ex.id);
      if (!keys.apiKey || !keys.secretKey) {
        next.push({ ...ex, status: 'unsaved' });
        continue;
      }
      if (ex.id !== 'binance') {
        next.push({ ...ex, status: 'unsupported' });
        continue;
      }
      try {
        const bal = await getFuturesBalance({ apiKey: keys.apiKey, apiSecret: keys.secretKey });
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
