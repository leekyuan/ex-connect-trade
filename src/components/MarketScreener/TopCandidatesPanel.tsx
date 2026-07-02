/**
 * TOP 5 진입 후보 — 마켓 스크리너 기본 뷰.
 * 5대 이론 합의 + MTF 확인 기반. 실행 상태는 데모 규칙으로 계산.
 */
import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Ban, Info } from 'lucide-react';
import type { CoinData } from '@/hooks/useCoinMarketCap';
import type { CoinTheorySignals } from '@/hooks/useScreenerTheories';

export interface TopCandidateRow {
  coin: CoinData;
  price: number;
  sigs: CoinTheorySignals | null;
}

type Action = 'BLOCKED' | 'WATCH' | 'PAPER_READY' | 'LIVE_READY';

interface Row extends TopCandidateRow {
  bias: 'LONG' | 'SHORT' | 'NEUTRAL';
  score: number;         // 0~100
  htfTrend: 'UP' | 'DOWN' | 'MIXED';
  liquidityOk: boolean;
  volatilityOk: boolean;
  correlationRisk: boolean;
  action: Action;
  blockReason?: string;
  nextTrigger?: string;
}

function computeRow(r: TopCandidateRow): Row {
  const s = r.sigs;
  const bias: Row['bias'] = s?.consensus === 'LONG' ? 'LONG' : s?.consensus === 'SHORT' ? 'SHORT' : 'NEUTRAL';
  const raw = s ? Math.max(s.longCount, s.shortCount) / 5 : 0; // 0~1
  const scoreBase = Math.round(raw * 100);
  const weightedBoost = s ? Math.min(15, Math.abs(s.weightedScore) / 6) : 0;
  const score = Math.min(100, scoreBase + weightedBoost);

  // 데모 규칙
  const liquidityOk = (r.coin.volume_24h ?? 0) > 50_000_000;
  const volatilityOk = Math.abs(r.coin.percent_change_24h ?? 0) > 1.2 && Math.abs(r.coin.percent_change_24h ?? 0) < 15;
  // BTC와 상관관계 위험: BTC, ETH 는 낮음, 나머지는 24h 변화 방향이 BTC/ETH와 유사한 경우 위험
  const correlationRisk = !['BTC', 'ETH'].includes(r.coin.symbol) && Math.abs(r.coin.percent_change_24h ?? 0) > 8;

  const htfTrend: Row['htfTrend'] = bias === 'LONG' ? 'UP' : bias === 'SHORT' ? 'DOWN' : 'MIXED';

  let action: Action = 'WATCH';
  let blockReason: string | undefined;
  let nextTrigger: string | undefined;

  // BTC/ETH 는 전략 검증 실패 데모로 항상 BLOCKED
  if (r.coin.symbol === 'BTC' || r.coin.symbol === 'ETH') {
    action = 'BLOCKED';
    blockReason = '전략 검증 실패 (PF/OOS/Rolling30 미달)';
  } else if (!liquidityOk) {
    action = 'BLOCKED';
    blockReason = '유동성 부족 (24h vol < $50M)';
  } else if (correlationRisk) {
    action = 'WATCH';
    nextTrigger = 'BTC 방향 확정 대기';
  } else if (bias === 'NEUTRAL' || !volatilityOk) {
    action = 'WATCH';
    nextTrigger = volatilityOk ? '방향성 미확정 (5대 이론 합의 부족)' : '변동성 부족 — 브레이크아웃 대기';
  } else if (score >= 60) {
    action = 'PAPER_READY';
    nextTrigger = 'Paper Mode에서 20회 시뮬 후 판단';
  } else {
    action = 'WATCH';
    nextTrigger = `Tradeability ${score} — 60 이상 필요`;
  }

  return { ...r, bias, score, htfTrend, liquidityOk, volatilityOk, correlationRisk, action, blockReason, nextTrigger };
}

export function TopCandidatesPanel({ rows, onOpen }: { rows: TopCandidateRow[]; onOpen: (coin: CoinData) => void }) {
  const enriched = useMemo(() => {
    return rows
      .filter(r => r.sigs)
      .map(computeRow)
      .sort((a, b) => {
        // BLOCKED는 뒤로, 나머지는 score 내림차순
        const rank = (r: Row) => (r.action === 'BLOCKED' ? -1 : r.action === 'WATCH' ? 0 : r.action === 'PAPER_READY' ? 1 : 2);
        if (rank(b) !== rank(a)) return rank(b) - rank(a);
        return b.score - a.score;
      })
      .slice(0, 5);
  }, [rows]);

  if (enriched.length === 0) {
    return (
      <Card className="p-4 text-sm text-muted-foreground text-center">
        진입 후보 계산 중 — 5대 이론 분석 대기...
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> 진입 가능 후보 TOP 5
          </h2>
          <p className="text-[11px] text-muted-foreground">
            5대 이론 합의 + 유동성/변동성/상관관계 필터 · 실제 진입 판단 우선순위
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <ActionDot state="LIVE_READY" /> 실거래
          <ActionDot state="PAPER_READY" /> Paper
          <ActionDot state="WATCH" /> 관찰
          <ActionDot state="BLOCKED" /> 차단
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border/40">
            <tr>
              <th className="text-left py-2 px-2">Symbol</th>
              <th className="text-center py-2 px-2">Bias</th>
              <th className="text-center py-2 px-2">Score</th>
              <th className="text-center py-2 px-2">HTF</th>
              <th className="text-center py-2 px-2">Liq</th>
              <th className="text-center py-2 px-2">Vol</th>
              <th className="text-center py-2 px-2">Corr</th>
              <th className="text-left py-2 px-2">Block / Next Trigger</th>
              <th className="text-center py-2 px-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map(r => (
              <tr
                key={r.coin.id}
                onClick={() => onOpen(r.coin)}
                className="border-b border-border/30 hover:bg-muted/40 cursor-pointer"
              >
                <td className="py-2 px-2 font-bold">{r.coin.symbol}</td>
                <td className="py-2 px-2 text-center"><BiasBadge bias={r.bias} /></td>
                <td className="py-2 px-2 text-center font-mono font-bold">{r.score}</td>
                <td className="py-2 px-2 text-center">
                  {r.htfTrend === 'UP' ? <TrendingUp className="h-3 w-3 text-emerald-400 mx-auto" /> :
                   r.htfTrend === 'DOWN' ? <TrendingDown className="h-3 w-3 text-red-400 mx-auto" /> :
                   <Minus className="h-3 w-3 text-muted-foreground mx-auto" />}
                </td>
                <td className="py-2 px-2 text-center">
                  <Dot ok={r.liquidityOk} />
                </td>
                <td className="py-2 px-2 text-center">
                  <Dot ok={r.volatilityOk} />
                </td>
                <td className="py-2 px-2 text-center">
                  <Dot ok={!r.correlationRisk} />
                </td>
                <td className="py-2 px-2 text-[11px] text-muted-foreground max-w-[220px] truncate">
                  {r.blockReason ? <span className="text-red-300">{r.blockReason}</span> : r.nextTrigger}
                </td>
                <td className="py-2 px-2 text-center"><ActionBadge state={r.action} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-[10px] text-muted-foreground border-t border-border/40 pt-2 flex items-start gap-1.5">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        <span>BLOCKED 후보는 실행 버튼이 모든 페이지에서 비활성화됩니다. Paper 검증 후보만 모의매매 사용 권장.</span>
      </div>
    </Card>
  );
}

function BiasBadge({ bias }: { bias: 'LONG' | 'SHORT' | 'NEUTRAL' }) {
  if (bias === 'LONG') return <span className="text-emerald-400 font-bold text-[10px]">LONG</span>;
  if (bias === 'SHORT') return <span className="text-red-400 font-bold text-[10px]">SHORT</span>;
  return <span className="text-muted-foreground text-[10px]">—</span>;
}
function Dot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />;
}
function ActionDot({ state }: { state: Action }) {
  const cls =
    state === 'LIVE_READY' ? 'bg-emerald-400' :
    state === 'PAPER_READY' ? 'bg-sky-400' :
    state === 'WATCH' ? 'bg-amber-400' :
    'bg-red-400';
  return <span className={`inline-block h-1.5 w-1.5 rounded-full mx-1 ${cls}`} />;
}
function ActionBadge({ state }: { state: Action }) {
  const map: Record<Action, string> = {
    LIVE_READY:  'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
    PAPER_READY: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
    WATCH:       'text-amber-300 border-amber-500/40 bg-amber-500/10',
    BLOCKED:     'text-red-300 border-red-500/50 bg-red-500/10',
  };
  const icon = state === 'BLOCKED' ? <Ban className="h-2.5 w-2.5 mr-0.5" /> : null;
  return (
    <Badge variant="outline" className={`text-[9px] font-bold tracking-wider ${map[state]}`}>
      {icon}{state}
    </Badge>
  );
}
