/**
 * Master Trade Plan
 * - multi-TF 통합 신호 + (옵션) advanced 6-이론 결과를 합쳐서
 * - 1차/2차 진입, 1차/2차 익절, 1차/2차 손절을 최종 산출
 *
 * LONG 기준
 *   Entry1 = 즉시 진입 (살짝 눌림 = primarySignal.entry)
 *   Entry2 = support1 (더 깊은 눌림 분할 매수)
 *   TP1    = resistance1
 *   TP2    = resistance2
 *   SL1    = support1.low - 0.3*ATR  (50% 청산, 1차 방어선)
 *   SL2    = support2.low - 0.5*ATR  (전량 청산, 시나리오 무효화)
 * SHORT는 반대로.
 */
import type { MultiTfSignal } from './multiTfSignal';
import type { Candle } from './indicators';
import { calcATR } from './indicators';

export type PlanSide = 'LONG' | 'SHORT' | 'WAIT';

export interface MasterPlan {
  side: PlanSide;
  confidence: number;       // 0..100
  agreementText: string;
  entry1: number;
  entry2: number;
  tp1: number;
  tp2: number;
  sl1: number;
  sl2: number;
  /** R:R = (TP1 - entry1) / (entry1 - SL1) for LONG */
  rrTp1: number;
  rrTp2: number;
  positionPlan: {
    entry1Pct: number;     // 진입 비중 %
    entry2Pct: number;
    tp1ClosePct: number;   // TP1 도달 시 청산 비중
    tp2ClosePct: number;
    sl1ClosePct: number;
    sl2ClosePct: number;
  };
  notes: string[];
}

function fmt(n: number, price: number): number {
  return Number(n.toFixed(price < 1 ? 6 : price < 100 ? 4 : 2));
}

export function buildMasterPlan(
  multi: MultiTfSignal | null,
  candles: Candle[],
  currentPrice: number,
): MasterPlan | null {
  if (!multi || !multi.primarySignal) return null;
  const sig = multi.primarySignal;

  const isBuy = sig.label === 'STRONG_BUY' || sig.label === 'BUY';
  const isSell = sig.label === 'STRONG_SELL' || sig.label === 'SELL';
  const side: PlanSide = isBuy ? 'LONG' : isSell ? 'SHORT' : 'WAIT';

  // confidence: weighted score 편차(0..50) → 0..100 + agreement 보너스
  const dev = Math.abs(multi.weightedScore - 50);
  const agreementBonus = (multi.agreement / multi.perTf.length) * 15;
  const confidence = Math.min(100, Math.round(dev * 2 + agreementBonus));

  const atrArr = calcATR(candles, 14);
  const atr = atrArr[atrArr.length - 1] || currentPrice * 0.01;

  let entry1: number, entry2: number, tp1: number, tp2: number, sl1: number, sl2: number;

  if (side === 'LONG') {
    entry1 = sig.entry;                              // 1차: 즉시/살짝 눌림
    entry2 = Math.min(sig.support1.high, currentPrice - atr * 0.8); // 2차: 더 깊은 눌림
    tp1 = sig.tp1;
    tp2 = sig.tp2;
    sl1 = sig.support1.low - atr * 0.3;
    sl2 = sig.support2.low - atr * 0.5;
  } else if (side === 'SHORT') {
    entry1 = sig.entry;
    entry2 = Math.max(sig.resistance1.low, currentPrice + atr * 0.8);
    tp1 = sig.tp1;
    tp2 = sig.tp2;
    sl1 = sig.resistance1.high + atr * 0.3;
    sl2 = sig.resistance2.high + atr * 0.5;
  } else {
    entry1 = entry2 = sig.entry;
    tp1 = sig.tp1; tp2 = sig.tp2;
    sl1 = sig.sl; sl2 = sig.sl;
  }

  const risk1 = Math.abs(entry1 - sl1) || 1;
  const rrTp1 = Math.abs(tp1 - entry1) / risk1;
  const rrTp2 = Math.abs(tp2 - entry1) / risk1;

  // 강신호일수록 1차에 비중 더 실음
  const isStrong = sig.label === 'STRONG_BUY' || sig.label === 'STRONG_SELL';
  const positionPlan = {
    entry1Pct: isStrong ? 60 : 50,
    entry2Pct: isStrong ? 40 : 50,
    tp1ClosePct: 50,    // 1차 익절: 절반 청산 + 본절로 SL 이동
    tp2ClosePct: 50,    // 잔여 50% TP2까지
    sl1ClosePct: 50,    // 1차 손절: 절반만 컷, 시나리오 재평가
    sl2ClosePct: 100,   // 2차 손절: 전량 청산
  };

  const notes: string[] = [];
  notes.push(`${multi.primaryTf.label} 기준 ${side === 'LONG' ? '롱' : side === 'SHORT' ? '숏' : '관망'} — 통합점수 ${multi.weightedScore}/100, ${multi.agreement}/${multi.perTf.length} TF 일치`);
  if (rrTp1 < 1) notes.push('⚠ TP1 R:R < 1.0 — 진입 보류 또는 더 좋은 가격 대기 권장');
  else if (rrTp1 >= 2) notes.push(`✅ TP1 R:R ${rrTp1.toFixed(2)} 양호`);
  notes.push('1차 익절 후 SL을 본절(entry1)로 이동시켜 무손실 라이딩');
  if (side === 'WAIT') notes.push('현재 신호 약함 — 돌파/이탈 확인 후 재평가');

  return {
    side,
    confidence,
    agreementText: `${multi.agreement}/${multi.perTf.length} TF`,
    entry1: fmt(entry1, currentPrice),
    entry2: fmt(entry2, currentPrice),
    tp1: fmt(tp1, currentPrice),
    tp2: fmt(tp2, currentPrice),
    sl1: fmt(sl1, currentPrice),
    sl2: fmt(sl2, currentPrice),
    rrTp1: Number(rrTp1.toFixed(2)),
    rrTp2: Number(rrTp2.toFixed(2)),
    positionPlan,
    notes,
  };
}
