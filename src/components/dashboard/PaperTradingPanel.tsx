import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, RefreshCw, Wallet, Shield, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { usePaperTrading } from '@/hooks/usePaperTrading';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  loadCreds, getFuturesBalance, placeMarketOrder, placeSLTP, setLeverage as setExchLeverage,
} from '@/utils/exchangeApi';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { DemoBadge } from '@/components/common/DemoBadge';
import { useGlobalSafety } from '@/hooks/useGlobalSafety';

const COINS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOGE', 'LINK', 'MATIC'];

type TradeMode = 'paper' | 'live';

export function PaperTradingPanel() {
  const { balance, positions, realizedPnl, buy, sell, reset, initialBalance } = usePaperTrading();
  const { demo } = useDemoMode();
  const safety = useGlobalSafety();
  const [mode, setMode] = useState<TradeMode>('paper');
  const [symbol, setSymbol] = useState('BTC');
  const [qty, setQty] = useState<string>('0.01');
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [leverage, setLeverage] = useState<number>(1);
  const [autoSl, setAutoSl] = useState<boolean>(true);
  const [liveBalance, setLiveBalance] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const creds = loadCreds();
  const liveReady = !!creds;

  // Live prices polling
  useEffect(() => {
    let alive = true;
    const fetchAll = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(COINS.map(s => s + 'USDT')))}`);
        if (!res.ok) return;
        const list = await res.json();
        if (!alive) return;
        const next: Record<string, number> = {};
        for (const it of list) next[String(it.symbol).replace('USDT', '')] = parseFloat(it.price);
        setPrices(next);
      } catch {}
    };
    fetchAll();
    const id = setInterval(fetchAll, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Live balance
  useEffect(() => {
    if (mode !== 'live' || !liveReady) { setLiveBalance(null); return; }
    let alive = true;
    const load = async () => {
      try { const b = await getFuturesBalance(); if (alive) setLiveBalance(b); }
      catch (e: any) { if (alive) { setLiveBalance(null); toast.error(`실잔고 조회 실패: ${e.message ?? e}`); } }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, [mode, liveReady]);

  const currentPrice = prices[symbol] ?? 0;
  const qtyNum = Number(qty) || 0;

  const unrealized = useMemo(() => positions.reduce((s, p) => {
    const px = prices[p.symbol] ?? p.entryPrice;
    const dir = p.side === 'BUY' ? 1 : -1;
    return s + (px - p.entryPrice) * p.qty * dir;
  }, 0), [positions, prices]);

  const totalEquity = balance + unrealized;
  const totalReturn = ((totalEquity / initialBalance) - 1) * 100;

  // ── LIVE order ──
  const liveOrder = async (side: 'BUY' | 'SELL') => {
    if (demo) return toast.error('🚫 데모 모드에서는 실주문 차단됨 — 모의매매 탭을 사용하세요');
    if (!liveReady) return toast.error('API 키 미설정');
    if (qtyNum <= 0) return toast.error('수량을 확인하세요');
    setBusy(true);
    try {
      const sym = `${symbol}USDT`;
      if (leverage > 1) await setExchLeverage(sym, leverage);
      await placeMarketOrder(sym, side, qtyNum);
      if (autoSl && currentPrice > 0) {
        const sl = side === 'BUY' ? currentPrice * 0.98 : currentPrice * 1.02;
        const tp = side === 'BUY' ? currentPrice * 1.04 : currentPrice * 0.96;
        try { await placeSLTP(sym, side, sl, tp); } catch (e) { console.warn('SL/TP 설정 실패', e); }
      }
      toast.success(`✅ ${side === 'BUY' ? '롱' : '숏'} 진입: ${symbol} ${qtyNum} @ $${currentPrice.toFixed(2)}`);
      const b = await getFuturesBalance(); setLiveBalance(b);
    } catch (e: any) {
      toast.error(`주문 실패: ${e.message ?? e}`);
    } finally { setBusy(false); }
  };

  const onBuy = () => {
    if (mode === 'live') return liveOrder('BUY');
    if (!currentPrice || qtyNum <= 0) return toast.error('수량/가격을 확인하세요');
    const r = buy(symbol, qtyNum, currentPrice);
    if (!r.ok) toast.error(r.error || '실패');
    else toast.success(`${symbol} ${qtyNum} 매수 @ $${currentPrice.toFixed(2)}`);
  };
  const onSell = () => {
    if (mode === 'live') return liveOrder('SELL');
    if (!currentPrice || qtyNum <= 0) return toast.error('수량/가격을 확인하세요');
    sell(symbol, qtyNum, currentPrice);
    toast.success(`${symbol} ${qtyNum} 매도 @ $${currentPrice.toFixed(2)}`);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">매매 패널</h3>
          {demo && <DemoBadge />}
        </div>
        {mode === 'paper' && (
          <button
            onClick={() => { reset(); toast.info('모의 계좌 초기화됨'); }}
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" /> 초기화
          </button>
        )}
      </div>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted rounded-lg">
        <button
          onClick={() => setMode('paper')}
          className={`py-1.5 text-xs font-semibold rounded-md transition ${
            mode === 'paper' ? 'bg-card text-foreground shadow' : 'text-muted-foreground'
          }`}
        >● 모의매매</button>
        <button
          onClick={() => setMode('live')}
          className={`py-1.5 text-xs font-semibold rounded-md transition ${
            mode === 'live' ? 'bg-red-600/20 text-red-400 ring-1 ring-red-500/40' : 'text-muted-foreground'
          }`}
        >🔴 실거래 {liveReady ? '(연결됨)' : ''}</button>
      </div>

      {mode === 'live' && !liveReady && (
        <div className="text-[11px] text-amber-400 bg-amber-500/10 rounded-md p-2 flex items-center gap-2">
          <KeyRound className="h-3.5 w-3.5" />
          API 키가 없습니다 — <Link to="/settings" className="underline font-semibold">설정 &gt; API 연결</Link>
        </div>
      )}

      {/* Balance summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted p-2">
          <div className="text-[10px] text-muted-foreground">잔고</div>
          <div className="text-sm font-mono font-bold text-foreground">
            ${mode === 'live' ? (liveBalance ?? '—') : balance.toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <div className="text-[10px] text-muted-foreground">모드</div>
          <div className={`text-sm font-bold ${mode === 'live' ? 'text-red-400' : 'text-emerald-400'}`}>
            {mode === 'live' ? 'LIVE' : 'PAPER'}
          </div>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <div className="text-[10px] text-muted-foreground">{mode === 'live' ? '레버리지' : '수익률'}</div>
          <div className="text-sm font-mono font-bold text-foreground">
            {mode === 'live' ? `${leverage}x` :
              <span className={totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
              </span>}
          </div>
        </div>
      </div>

      {/* Order form */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">코인</label>
          <select value={symbol} onChange={e => setSymbol(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm">
            {COINS.map(c => <option key={c} value={c}>{c} {prices[c] ? `· $${prices[c].toFixed(2)}` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">수량</label>
          <Input type="number" step="0.0001" min="0" value={qty} onChange={e => setQty(e.target.value)} className="text-sm" />
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground flex items-center justify-between">
        <span>현재가 <span className="font-mono text-foreground">${currentPrice ? currentPrice.toFixed(2) : '—'}</span></span>
        <span>예상 비용 <span className="font-mono text-foreground">${(qtyNum * currentPrice).toFixed(2)}</span></span>
      </div>

      <div className="rounded-lg bg-muted/50 p-2 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">레버리지</span>
          <span className="font-mono font-bold text-foreground">{leverage}x</span>
        </div>
        <Slider min={1} max={20} step={1} value={[leverage]} onValueChange={v => setLeverage(v[0])} />
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Shield className="h-3 w-3 text-emerald-400" />
            <span className="text-muted-foreground">자동 SL/TP (-2%/+4%)</span>
          </div>
          <Switch checked={autoSl} onCheckedChange={setAutoSl} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onBuy} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <ArrowUpRight className="h-4 w-4 mr-1" /> {mode === 'live' ? '롱 진입 (실거래)' : '매수'}
        </Button>
        <Button onClick={onSell} disabled={busy} className="bg-red-600 hover:bg-red-700 text-white">
          <ArrowDownRight className="h-4 w-4 mr-1" /> {mode === 'live' ? '숏 진입 (실거래)' : '매도'}
        </Button>
      </div>

      {/* Paper positions only */}
      {mode === 'paper' && (
        <div>
          <div className="text-[11px] text-muted-foreground mb-1">보유 포지션 ({positions.length})</div>
          {positions.length === 0 ? (
            <div className="text-[11px] text-muted-foreground bg-muted rounded-md p-2 text-center">포지션 없음</div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {positions.map(p => {
                const px = prices[p.symbol] ?? p.entryPrice;
                const dir = p.side === 'BUY' ? 1 : -1;
                const pnl = (px - p.entryPrice) * p.qty * dir;
                const pct = ((px / p.entryPrice - 1) * 100) * dir;
                return (
                  <div key={p.id} className="flex items-center justify-between text-[11px] bg-muted rounded-md px-2 py-1.5">
                    <span className="font-mono">{p.symbol} <span className={p.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>{p.side}</span> {p.qty}</span>
                    <span className="font-mono text-muted-foreground">@ ${p.entryPrice.toFixed(2)}</span>
                    <span className={`font-mono font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pct.toFixed(2)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="text-[10px] text-muted-foreground opacity-70 mt-2">
            실현 PNL: <span className={realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>${realizedPnl.toFixed(2)}</span>
            {' · '}모의 투자 — 실제 자금 사용 안 함
          </div>
        </div>
      )}
    </div>
  );
}
