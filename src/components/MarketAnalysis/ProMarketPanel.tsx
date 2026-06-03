/**
 * Pro Market Panel — Real-time futures derivatives dashboard.
 * Shows funding, OI, L/S ratios, CVD, RSI, liquidation heatmap.
 */
import { useMemo } from 'react';
import {
  LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
  BarChart, Bar, Cell,
} from 'recharts';
import { useBinancePro } from '@/hooks/useBinancePro';
import { Activity, TrendingUp, TrendingDown, Zap, Users, Flame } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Props { symbol: string }

const fmt = (n: number | null, d = 2) =>
  n == null || !isFinite(n) ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: d });

const Card = ({
  title, icon, badge, badgeTone, children,
}: { title: string; icon: React.ReactNode; badge?: string; badgeTone?: 'pos' | 'neg' | 'neu'; children: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-card p-3 space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      {badge && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
          badgeTone === 'pos' ? 'bg-emerald-500/15 text-emerald-400'
          : badgeTone === 'neg' ? 'bg-red-500/15 text-red-400'
          : 'bg-muted text-muted-foreground'
        }`}>{badge}</span>
      )}
    </div>
    {children}
  </div>
);

export function ProMarketPanel({ symbol }: Props) {
  const d = useBinancePro(symbol, 30_000);

  const lsBias = useMemo(() => {
    if (d.topPositionLs == null) return null;
    const pct = (d.topPositionLs / (1 + d.topPositionLs)) * 100;
    return { longPct: pct, shortPct: 100 - pct };
  }, [d.topPositionLs]);

  if (d.loading && !d.lastUpdate) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }
  if (d.error && !d.lastUpdate) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
        Pro 데이터 로드 실패: {d.error}
      </div>
    );
  }

  const fundingTone = d.fundingRate == null ? 'neu' : d.fundingRate > 0.01 ? 'neg' : d.fundingRate < -0.01 ? 'pos' : 'neu';
  const oiTone = d.oiChange24hPct == null ? 'neu' : d.oiChange24hPct > 0 ? 'pos' : 'neg';
  const rsiTone = d.rsi == null ? 'neu' : d.rsi > 70 ? 'neg' : d.rsi < 30 ? 'pos' : 'neu';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-emerald-400" />
          파생상품 실시간 (Binance Futures)
        </h3>
        {d.lastUpdate && (
          <span className="text-[10px] text-muted-foreground">
            업데이트: {new Date(d.lastUpdate).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Funding Rate */}
        <Card
          title="펀딩 비율 (Funding)"
          icon={<Zap className="h-3.5 w-3.5" />}
          badge={d.fundingRate != null ? `${d.fundingRate >= 0 ? '+' : ''}${d.fundingRate.toFixed(4)}%` : undefined}
          badgeTone={fundingTone as any}
        >
          <div className="text-2xl font-black tabular-nums">
            {d.fundingRate != null ? `${(d.fundingRate * 3 * 365).toFixed(2)}%` : '—'}
            <span className="text-[10px] font-normal text-muted-foreground ml-1">연환산</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {d.fundingRate != null && d.fundingRate > 0.01
              ? '롱이 숏에 지불 중 → 롱 과열'
              : d.fundingRate != null && d.fundingRate < -0.01
              ? '숏이 롱에 지불 중 → 숏 과열'
              : '균형'}
          </div>
        </Card>

        {/* Open Interest */}
        <Card
          title="Open Interest (OI)"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          badge={d.oiChange24hPct != null ? `24h ${d.oiChange24hPct >= 0 ? '+' : ''}${d.oiChange24hPct.toFixed(2)}%` : undefined}
          badgeTone={oiTone as any}
        >
          <div className="text-xl font-bold tabular-nums">{fmt(d.openInterest, 0)}</div>
          <div className="h-12 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.oiHistory}>
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 11 }} formatter={(v: any) => fmt(v, 0)} labelFormatter={(t) => new Date(t).toLocaleString()} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* RSI */}
        <Card
          title="RSI (15m, 14)"
          icon={<Activity className="h-3.5 w-3.5" />}
          badge={d.rsi != null ? d.rsi.toFixed(1) : undefined}
          badgeTone={rsiTone as any}
        >
          <div className="relative h-2 bg-muted rounded-full overflow-hidden mt-3">
            <div className="absolute inset-y-0 left-[30%] right-[30%] bg-emerald-500/10" />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-foreground rounded"
              style={{ left: `${Math.max(0, Math.min(100, d.rsi ?? 50))}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>과매도 30</span><span>50</span><span>과매수 70</span>
          </div>
        </Card>

        {/* Long/Short Position Ratio (Top Traders) */}
        <Card
          title="대형 트레이더 포지션 L/S"
          icon={<Users className="h-3.5 w-3.5" />}
          badge={d.topPositionLs != null ? `${d.topPositionLs.toFixed(2)}x` : undefined}
        >
          {lsBias && (
            <>
              <div className="flex h-6 rounded overflow-hidden">
                <div className="bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-emerald-950" style={{ width: `${lsBias.longPct}%` }}>
                  L {lsBias.longPct.toFixed(0)}%
                </div>
                <div className="bg-red-500 flex items-center justify-center text-[10px] font-bold text-red-950" style={{ width: `${lsBias.shortPct}%` }}>
                  S {lsBias.shortPct.toFixed(0)}%
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                계정 L/S {fmt(d.topAccountLs, 2)} · 글로벌 L/S {fmt(d.globalAccountLs, 2)}
              </div>
            </>
          )}
        </Card>

        {/* Taker Buy/Sell Ratio (CVD-proxy) */}
        <Card
          title="테이커 매수/매도 비율"
          icon={<TrendingDown className="h-3.5 w-3.5" />}
          badge={d.takerBuySellRatio != null ? `${d.takerBuySellRatio.toFixed(2)}x` : undefined}
          badgeTone={d.takerBuySellRatio != null && d.takerBuySellRatio > 1 ? 'pos' : 'neg'}
        >
          <div className="h-14 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.takerHistory}>
                <ReferenceLine y={1} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 11 }} formatter={(v: any) => Number(v).toFixed(2)} labelFormatter={(t) => new Date(t).toLocaleString()} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* CVD */}
        <Card
          title="CVD (누적 거래량 델타)"
          icon={<Activity className="h-3.5 w-3.5" />}
          badge={d.cvd.length ? (d.cvd[d.cvd.length - 1].value >= 0 ? '매수우위' : '매도우위') : undefined}
          badgeTone={d.cvd.length && d.cvd[d.cvd.length - 1].value >= 0 ? 'pos' : 'neg'}
        >
          <div className="h-16 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.cvd}>
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 11 }} formatter={(v: any) => fmt(v, 2)} labelFormatter={(t) => new Date(t).toLocaleString()} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Liquidation Heatmap */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            <span>청산 히트맵 (추정 · 레버리지별 클러스터)</span>
          </div>
          <span className="text-[10px] text-muted-foreground">현재가: {fmt(d.markPrice, 2)}</span>
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.liquidationLevels} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="price" width={70} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => Number(v).toFixed(0)} />
              <ReferenceLine x={0} stroke="hsl(var(--border))" />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 11 }}
                formatter={(_, __, p) => [`${p.payload.leverage}x ${p.payload.side === 'long' ? '롱' : '숏'} 청산`, '강도']}
                labelFormatter={(v) => `가격 ${Number(v).toFixed(2)}`}
              />
              <Bar dataKey="size">
                {d.liquidationLevels.map((lvl, i) => (
                  <Cell key={i} fill={lvl.side === 'long' ? '#ef4444' : '#10b981'} opacity={0.4 + lvl.size * 0.6} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">
          ⚠️ 공개 데이터에서 직접 청산 큐를 얻을 수 없어 L/S 편향 + 표준 레버리지(10/25/50/75/100x) 기반 추정값입니다.
        </div>
      </div>
    </div>
  );
}
