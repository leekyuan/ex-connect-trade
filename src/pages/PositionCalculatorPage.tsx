import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Calculator, AlertTriangle, TrendingUp, TrendingDown, Sparkles, Send } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { sendTelegram } from '@/lib/telegram';
import { useTelegramSettings } from '@/hooks/useTelegramSettings';
import { toast } from 'sonner';

type Side = 'LONG' | 'SHORT';

export default function PositionCalculatorPage() {
  const [side, setSide] = useState<Side>('LONG');
  const [account, setAccount] = useState(10000);
  const [riskPct, setRiskPct] = useState(1); // % of account at risk
  const [entry, setEntry] = useState(50000);
  const [stop, setStop] = useState(49000);
  const [tp1, setTp1] = useState(52000);
  const [tp2, setTp2] = useState(54000);
  const [leverage, setLeverage] = useState(10);
  const [feeBps, setFeeBps] = useState(4); // 0.04% per side
  // Kelly inputs (from prior backtest, user-editable)
  const [winRate, setWinRate] = useState(50);
  const [avgWin, setAvgWin] = useState(2);
  const [avgLoss, setAvgLoss] = useState(1);
  const { settings: tgSettings } = useTelegramSettings();

  const calc = useMemo(() => {
    const riskUsdt = (account * riskPct) / 100;
    const stopDist = Math.abs(entry - stop);
    const stopPct = (stopDist / entry) * 100;
    if (stopDist <= 0 || entry <= 0) return null;

    // Position size in USDT (notional) such that stop-loss = riskUsdt
    const notional = (riskUsdt / stopDist) * entry;
    const margin = notional / leverage;
    const qty = notional / entry;

    const dir = side === 'LONG' ? 1 : -1;
    const pnlAt = (price: number) => (price - entry) * qty * dir;
    const fees = notional * (feeBps / 10000) * 2; // entry+exit

    const liqPct = (1 / leverage) * 100 * 0.95; // rough cross liq estimate
    const liq = side === 'LONG' ? entry * (1 - liqPct / 100) : entry * (1 + liqPct / 100);

    const rr1 = Math.abs(tp1 - entry) / stopDist;
    const rr2 = Math.abs(tp2 - entry) / stopDist;

    return {
      riskUsdt,
      notional,
      margin,
      qty,
      stopPct,
      pnlSL: -riskUsdt - fees,
      pnlTP1: pnlAt(tp1) - fees,
      pnlTP2: pnlAt(tp2) - fees,
      rr1, rr2,
      liq,
      fees,
      marginPct: (margin / account) * 100,
    };
  }, [account, riskPct, entry, stop, tp1, tp2, side, leverage, feeBps]);

  const warn = calc && calc.marginPct > 50;

  // Kelly Criterion: f = W - (1-W)/R, where W=winrate, R=avgWin/avgLoss
  const kelly = useMemo(() => {
    const W = winRate / 100;
    const R = avgLoss > 0 ? avgWin / avgLoss : 1;
    const full = W - (1 - W) / R;
    const safe = Math.max(0, full * 0.5); // Half-Kelly
    return { full: Math.max(0, full) * 100, half: safe * 100 };
  }, [winRate, avgWin, avgLoss]);

  const applyKelly = () => {
    setRiskPct(Math.min(5, Math.max(0.1, Number(kelly.half.toFixed(2)))));
    toast.success(`Half-Kelly 적용: ${kelly.half.toFixed(2)}%`);
  };

  const sendToTelegram = async () => {
    if (!tgSettings?.chat_id) {
      toast.error('설정 → 텔레그램에서 Chat ID를 먼저 등록하세요');
      return;
    }
    if (!calc) return;
    const msg = `<b>📐 포지션 계산 결과</b>

방향: ${side}
진입가: $${entry}
손절가: $${stop} (${calc.stopPct.toFixed(2)}%)
TP1: $${tp1} (R:R ${calc.rr1.toFixed(2)})
TP2: $${tp2} (R:R ${calc.rr2.toFixed(2)})

리스크: $${calc.riskUsdt.toFixed(2)} (${riskPct}%)
포지션: $${calc.notional.toFixed(2)} (${leverage}×)
증거금: $${calc.margin.toFixed(2)}
수량: ${calc.qty.toFixed(6)}
강제청산가: $${calc.liq.toFixed(2)}`;
    const res = await sendTelegram({ chat_id: tgSettings.chat_id, message: msg });
    if (res.ok) toast.success('텔레그램으로 전송 완료');
    else toast.error(res.error ?? '전송 실패');
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" /> 포지션 계산기
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            계좌 위험비율 기반 안전 포지션 사이즈 · R:R · 강제청산가 자동 산출
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Inputs */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex gap-2">
              {(['LONG', 'SHORT'] as Side[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`flex-1 py-2 rounded-md font-bold text-sm flex items-center justify-center gap-1 ${
                    side === s
                      ? s === 'LONG'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'bg-muted text-muted-foreground border border-transparent'
                  }`}
                >
                  {s === 'LONG' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {s}
                </button>
              ))}
            </div>

            <Field label="계좌 (USDT)" value={account} onChange={setAccount} />

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">리스크 % (계좌 대비)</span>
                <span className="font-mono font-bold">{riskPct.toFixed(2)}%</span>
              </div>
              <Slider value={[riskPct]} min={0.1} max={5} step={0.1}
                onValueChange={([v]) => setRiskPct(v)} />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">레버리지</span>
                <span className="font-mono font-bold">{leverage}×</span>
              </div>
              <Slider value={[leverage]} min={1} max={125} step={1}
                onValueChange={([v]) => setLeverage(v)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="진입가" value={entry} onChange={setEntry} />
              <Field label="손절가" value={stop} onChange={setStop} />
              <Field label="TP1" value={tp1} onChange={setTp1} />
              <Field label="TP2" value={tp2} onChange={setTp2} />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">왕복 수수료 (bps, 0.01% 단위)</span>
                <span className="font-mono">{feeBps} bps</span>
              </div>
              <Slider value={[feeBps]} min={0} max={20} step={1}
                onValueChange={([v]) => setFeeBps(v)} />
            </div>
          </div>

          {/* Results */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            {!calc ? (
              <p className="text-sm text-muted-foreground">유효한 입력값을 넣어주세요.</p>
            ) : (
              <>
                <Stat label="리스크 금액 (1R)" value={`$${calc.riskUsdt.toFixed(2)}`} highlight />
                <Stat label="권장 포지션 (Notional)" value={`$${calc.notional.toFixed(2)}`} />
                <Stat label="필요 증거금" value={`$${calc.margin.toFixed(2)} (${calc.marginPct.toFixed(1)}%)`}
                  warn={warn} />
                <Stat label="수량" value={calc.qty.toFixed(6)} />
                <Stat label="손절 거리" value={`${calc.stopPct.toFixed(2)}%`} />
                <div className="border-t border-border pt-3 space-y-2">
                  <Stat label="SL 손실" value={`-$${Math.abs(calc.pnlSL).toFixed(2)}`} negative />
                  <Stat label={`TP1 익절 (R:R ${calc.rr1.toFixed(2)})`}
                    value={`+$${calc.pnlTP1.toFixed(2)}`} positive />
                  <Stat label={`TP2 익절 (R:R ${calc.rr2.toFixed(2)})`}
                    value={`+$${calc.pnlTP2.toFixed(2)}`} positive />
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <Stat label="추정 강제청산가 (cross)" value={`$${calc.liq.toFixed(2)}`} />
                  <Stat label="총 수수료" value={`$${calc.fees.toFixed(2)}`} />
                </div>

                {warn && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    증거금이 계좌의 50%를 초과합니다. 레버리지를 낮추거나 리스크 %를 줄이세요.
                  </div>
                )}
                {calc.rr1 < 1 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/40 text-red-300 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    R:R이 1 미만입니다. 익절가를 늘리거나 손절 거리를 줄이세요.
                  </div>
                )}

                <Button onClick={sendToTelegram} variant="outline" className="w-full">
                  <Send className="mr-2 h-4 w-4" /> 텔레그램으로 전송
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Kelly Criterion */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-bold">Kelly 기준 추천 리스크 비율</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            과거 백테스트 통계를 입력하면 수학적으로 최적인 베팅 비율을 계산합니다. 안전을 위해 Half-Kelly 사용을 권장합니다.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="승률 (%)" value={winRate} onChange={setWinRate} />
            <Field label="평균 수익 (R)" value={avgWin} onChange={setAvgWin} />
            <Field label="평균 손실 (R)" value={avgLoss} onChange={setAvgLoss} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <div className="text-[11px] text-muted-foreground">Full Kelly</div>
              <div className="text-2xl font-mono font-bold">{kelly.full.toFixed(2)}%</div>
            </div>
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-center">
              <div className="text-[11px] text-emerald-400">Half Kelly (권장)</div>
              <div className="text-2xl font-mono font-bold text-emerald-400">{kelly.half.toFixed(2)}%</div>
            </div>
          </div>
          <Button onClick={applyKelly} className="w-full" disabled={kelly.half <= 0}>
            <Sparkles className="mr-2 h-4 w-4" /> Half-Kelly 값을 리스크 %에 적용
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Stat({ label, value, highlight, warn, positive, negative }: {
  label: string; value: string;
  highlight?: boolean; warn?: boolean; positive?: boolean; negative?: boolean;
}) {
  const cls = positive ? 'text-emerald-400' : negative ? 'text-red-400'
    : warn ? 'text-amber-400' : highlight ? 'text-primary' : 'text-foreground';
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-bold ${cls}`}>{value}</span>
    </div>
  );
}
