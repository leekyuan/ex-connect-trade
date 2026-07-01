/**
 * Bot Safety Status — 실거래 전 필수 가드.
 * 종합 상태(SAFE / DEGRADED / BLOCKED)와 차단 사유 요약.
 */
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert, AlertOctagon } from 'lucide-react';

export type BotSafetyState = 'SAFE' | 'DEGRADED' | 'BLOCKED';

export interface BotSafetyCheck {
  label: string;
  ok: boolean;
  detail?: string;
  critical?: boolean; // false=경고만, true=BLOCKED 유발
}

interface Props {
  checks: BotSafetyCheck[];
  state?: BotSafetyState;
}

function computeState(checks: BotSafetyCheck[]): BotSafetyState {
  const anyCritical = checks.some(c => !c.ok && c.critical);
  if (anyCritical) return 'BLOCKED';
  const anyWarn = checks.some(c => !c.ok);
  return anyWarn ? 'DEGRADED' : 'SAFE';
}

const META: Record<BotSafetyState, { tone: string; bg: string; ring: string; label: string; sub: string; Icon: any }> = {
  SAFE:     { tone: 'text-emerald-300', bg: 'bg-emerald-500/10', ring: 'border-emerald-500/40', label: 'SAFE',     sub: '모든 안전 항목 통과 — 실거래 조건 충족', Icon: ShieldCheck },
  DEGRADED: { tone: 'text-amber-300',   bg: 'bg-amber-500/10',   ring: 'border-amber-500/40',   label: 'DEGRADED', sub: '일부 안전 항목 경고 — 관찰/Paper 권장',   Icon: ShieldAlert },
  BLOCKED:  { tone: 'text-red-300',     bg: 'bg-red-500/15',     ring: 'border-red-500/50',     label: 'BLOCKED',  sub: '실거래 차단됨 — 아래 사유를 먼저 해결하세요', Icon: AlertOctagon },
};

export function BotSafetyStatus({ checks, state }: Props) {
  const s = state ?? computeState(checks);
  const m = META[s];
  const Icon = m.Icon;

  return (
    <Card className={`p-4 border ${m.ring} ${m.bg}`}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className={`flex items-center gap-2 font-bold ${m.tone}`}>
          <Icon className="h-5 w-5" />
          <span className="text-base">Bot Safety Status</span>
          <Badge variant="outline" className={`${m.tone} border-current font-bold tracking-wider ml-2`}>
            {m.label}
          </Badge>
        </div>
        <span className="text-[11px] text-muted-foreground">{m.sub}</span>
      </div>

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
        {checks.map((c, i) => (
          <li key={i} className="flex items-start gap-2 leading-snug">
            <span
              className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                c.ok ? 'bg-emerald-400' : c.critical ? 'bg-red-400' : 'bg-amber-400'
              }`}
            />
            <div className="flex-1">
              <span className={c.ok ? 'text-foreground/80' : c.critical ? 'text-red-300' : 'text-amber-200/90'}>
                {c.label}
              </span>
              {c.detail && (
                <div className="text-[10px] text-muted-foreground font-mono">{c.detail}</div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {s === 'BLOCKED' && (
        <div className="mt-3 border-t border-border/40 pt-2 text-[11px] text-muted-foreground leading-relaxed">
          실거래 API 연결과 Live 실행은 위 항목이 모두 해결되기 전까지 비활성화됩니다.
          Paper Mode 100거래 이상 안정적 검증을 우선 진행하세요.
        </div>
      )}
    </Card>
  );
}

export function useBotSafetyChecks(): BotSafetyCheck[] {
  // localStorage 기반 최소 상태 추론 (실주문 실행 없음)
  let paperMode = true;
  try {
    const raw = localStorage.getItem('cryptoedge-risk-limits');
    if (raw) paperMode = !!JSON.parse(raw).paperMode;
  } catch { /* noop */ }

  return [
    { label: 'Paper Mode 검증 진행 중', ok: paperMode, critical: true,
      detail: paperMode ? 'Paper Mode 활성 — 실주문 미전송' : 'Paper Mode 해제됨 — 실거래 위험' },
    { label: 'BTC 전략 검증 (PF ≥ 1.30)', ok: false, critical: true,
      detail: '현재 BTC 4H PF 기준 미달 (참고 데이터)' },
    { label: 'ETH 전략 검증 (PF ≥ 1.30)', ok: false, critical: true,
      detail: '현재 ETH 4H PF 기준 미달 (참고 데이터)' },
    { label: 'OOS PF ≥ 1.20', ok: false, critical: true,
      detail: '검증구간 PF 기준 미달' },
    { label: 'Rolling30 PF ≥ 1.10', ok: false, critical: true,
      detail: '최근 30거래 PF 기준 미달' },
    { label: '오늘 손실 한도 미초과', ok: true },
    { label: '연속 손실 제한 미도달', ok: true },
    { label: 'API 키 Withdraw 권한 없음', ok: true, critical: true,
      detail: '연결 시 자동 검증' },
    { label: '거래소 ↔ 내부 DB 포지션 일치', ok: true },
    { label: 'SL 주문 미등록 포지션 없음', ok: true, critical: true },
    { label: 'TP/SL 등록 실패 이력 없음', ok: true },
    { label: '네트워크/API 오류 반복 없음', ok: true },
  ];
}
