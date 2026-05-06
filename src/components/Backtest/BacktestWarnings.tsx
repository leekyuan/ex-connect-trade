/**
 * BacktestWarnings — 백테스트 신뢰도 경고 패널
 */
import { AlertTriangle, AlertCircle, Info } from "lucide-react";

export interface BacktestResult {
  totalTrades: number;
  winRate: number;        // 0~1
  profitFactor: number;
  alpha: number;          // 전략 - B&H (%)
  inSampleReturn: number;
  outOfSampleReturn: number;
  mdd: number;            // %
  sharpe: number;
}

export interface BacktestWarning {
  level: 'critical' | 'warning' | 'info';
  message: string;
  suggestion: string;
}

export function analyzeBacktestReliability(r: BacktestResult): BacktestWarning[] {
  const w: BacktestWarning[] = [];

  if (r.totalTrades < 10) {
    w.push({ level: 'critical', message: `거래 수 ${r.totalTrades}건 — 통계적으로 무의미`, suggestion: '최소 30건 이상 권장. 기간을 3~6개월로 늘려보세요.' });
  } else if (r.totalTrades < 30) {
    w.push({ level: 'warning', message: `거래 수 ${r.totalTrades}건 — 신뢰도 낮음`, suggestion: '30건 이상 권장. 결과를 과신하지 마세요.' });
  }

  if (r.profitFactor < 1.0) {
    w.push({ level: 'critical', message: `Profit Factor ${r.profitFactor.toFixed(2)} — 손실 전략`, suggestion: '손익 구조 재검토 필요.' });
  } else if (r.profitFactor < 1.3) {
    w.push({ level: 'warning', message: `Profit Factor ${r.profitFactor.toFixed(2)} — 개선 필요`, suggestion: '수수료 포함 시 손실 전환 가능. 1.5 이상 목표.' });
  }

  if (r.alpha < -10) {
    w.push({ level: 'critical', message: `α ${r.alpha.toFixed(1)}% — 단순 보유 대비 심각히 열위`, suggestion: '전략 재설계 권장.' });
  } else if (r.alpha < 0) {
    w.push({ level: 'warning', message: `α ${r.alpha.toFixed(1)}% — B&H 대비 열위`, suggestion: 'Buy & Hold 대비 수익률이 낮습니다.' });
  }

  const gap = r.inSampleReturn - r.outOfSampleReturn;
  if (gap > 10) {
    w.push({ level: 'critical', message: `과최적화 의심 — IS +${r.inSampleReturn.toFixed(1)}% vs OOS ${r.outOfSampleReturn.toFixed(1)}%`, suggestion: 'Walk-Forward 최적화 사용 권장.' });
  } else if (gap > 5) {
    w.push({ level: 'warning', message: `과최적화 가능성 — 샘플 간 ${gap.toFixed(1)}%p 괴리`, suggestion: '파라미터를 보수적으로 조정.' });
  }

  if (r.mdd > 20) {
    w.push({ level: 'critical', message: `MDD ${r.mdd.toFixed(1)}% — 위험 수준`, suggestion: '포지션 사이즈 축소 또는 손절 강화.' });
  } else if (r.mdd > 10) {
    w.push({ level: 'warning', message: `MDD ${r.mdd.toFixed(1)}% — 주의`, suggestion: '실거래 시 심리적 부담 가능.' });
  }

  if (r.winRate < 0.4 && r.profitFactor < 1.5) {
    w.push({ level: 'warning', message: `승률 ${(r.winRate * 100).toFixed(0)}% + PF ${r.profitFactor.toFixed(2)} — 조합 불리`, suggestion: '낮은 승률은 높은 손익비로 보완 필요.' });
  }

  return w;
}

const STYLES: Record<BacktestWarning['level'], { cls: string; Icon: typeof AlertTriangle }> = {
  critical: { cls: 'border-destructive/50 bg-destructive/10 text-destructive', Icon: AlertCircle },
  warning:  { cls: 'border-amber-500/50 bg-amber-500/10 text-amber-300',       Icon: AlertTriangle },
  info:     { cls: 'border-primary/50 bg-primary/10 text-primary',             Icon: Info },
};

export function BacktestWarnings({ result }: { result: BacktestResult }) {
  const warnings = analyzeBacktestReliability(result);
  if (!warnings.length) return null;
  return (
    <div className="space-y-2">
      {warnings.map((w, i) => {
        const s = STYLES[w.level];
        return (
          <div key={i} className={`rounded-md border p-3 text-xs ${s.cls}`}>
            <div className="flex items-start gap-2 font-medium">
              <s.Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{w.message}</span>
            </div>
            <div className="mt-1 ml-5 opacity-85">→ {w.suggestion}</div>
          </div>
        );
      })}
    </div>
  );
}
