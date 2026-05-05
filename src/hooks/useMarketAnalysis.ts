import { useMemo } from 'react';
import type { CoinData } from './useCoinMarketCap';
import { calcZScores, type CoinWithZ } from '@/utils/zscore';

export type TradingMode = 'scalping' | 'daytrading' | 'swing';
export type Signal = 'LONG' | 'SHORT' | 'WATCH';

export interface ModeConfig {
  label: string;
  timeframes: string[];
  tvInterval: string;
  description: string;
}

export const MODE_CONFIG: Record<TradingMode, ModeConfig> = {
  scalping: {
    label: '스캘핑',
    timeframes: ['5분봉', '15분봉', '30분봉'],
    tvInterval: '5',
    description: '단기 변동성 포착 · 빠른 진입/청산',
  },
  daytrading: {
    label: '단타',
    timeframes: ['1시간봉', '4시간봉', '12시간봉'],
    tvInterval: '60',
    description: '당일 추세 추종 · 중기 모멘텀',
  },
  swing: {
    label: '스윙',
    timeframes: ['일봉', '3일봉', '주봉'],
    tvInterval: 'D',
    description: '다음 추세 선점 · 장기 추세 편승',
  },
};

export interface CoinAnalysis {
  coin: CoinData;
  signal: Signal;
  confidence: number;
  longEntry: number | null;
  shortEntry: number | null;
  stopLoss: number;
  tp1: number;
  tp2: number;
  takeProfit: number;
  riskReward: number;
  reasoning: string[];
  strategy: string;
  indicators: {
    trend: string;
    momentum: string;
    volume: string;
    strength: number;
  };
}

function analyzeWithZ(coin: CoinData, z: CoinWithZ, mode: TradingMode): CoinAnalysis {
  const price = coin.price;
  let signal: Signal = 'WATCH';
  let confidence = 40;
  const reasoning: string[] = [];

  // ── 스캘핑 ──
  if (mode === 'scalping') {
    if (z.z1h < -0.8) {
      signal = 'LONG';
      confidence = 55 + Math.min(30, Math.abs(z.z1h) * 10);
      reasoning.push(`1시간 상대 낙폭 (z=${z.z1h.toFixed(2)}) — 단기 과매도`);
      reasoning.push('전체 시장 대비 하락 강도 높음');
      if (z.volRatio > 0.5) {
        confidence += 8;
        reasoning.push('거래량 평균 이상 — 반등 가능성');
      }
    } else if (z.z1h > 0.8) {
      signal = 'SHORT';
      confidence = 55 + Math.min(30, z.z1h * 10);
      reasoning.push(`1시간 상대 급등 (z=${z.z1h.toFixed(2)}) — 단기 과매수`);
      reasoning.push('전체 시장 대비 상승 강도 높음');
      if (z.volRatio > 0.5) {
        confidence += 8;
        reasoning.push('거래량 동반 급등 — 되돌림 가능성');
      }
    } else {
      reasoning.push(`1시간 z-score ${z.z1h.toFixed(2)} — 중립 구간`);
      reasoning.push('상대적 방향성 없음 — 관망');
      confidence = 30 + Math.abs(z.z1h) * 8;
    }
  }
  // ── 단타 ──
  else if (mode === 'daytrading') {
    const volOk = z.volRatio > -0.3;
    if (z.z24h < -0.7 && volOk) {
      signal = 'LONG';
      confidence = 52 + Math.min(33, Math.abs(z.z24h) * 12);
      reasoning.push(`24시간 상대 약세 (z=${z.z24h.toFixed(2)})`);
      reasoning.push('거래량 정상 — 반등 매수 기회');
      if (z.z1h > 0.3) {
        confidence += 7;
        reasoning.push('1시간 회복 조짐');
      }
    } else if (z.z24h > 0.7 && volOk) {
      signal = 'SHORT';
      confidence = 52 + Math.min(33, z.z24h * 12);
      reasoning.push(`24시간 상대 강세 (z=${z.z24h.toFixed(2)}) — 과열`);
      reasoning.push('평균 대비 과매수 — 되돌림 경계');
      if (z.z1h < -0.3) {
        confidence += 7;
        reasoning.push('1시간 하락 반전 신호');
      }
    } else {
      reasoning.push(`24시간 z-score ${z.z24h.toFixed(2)} — 방향 불명확`);
      reasoning.push('4시간봉 방향 확인 후 진입 검토');
      confidence = 30 + Math.abs(z.z24h) * 10;
    }
  }
  // ── 스윙 ──
  else {
    if (z.z7d < -0.6) {
      signal = 'LONG';
      confidence = 50 + Math.min(35, Math.abs(z.z7d) * 14);
      reasoning.push(`주간 상대 약세 (z=${z.z7d.toFixed(2)}) — 저평가`);
      reasoning.push('전체 대비 하락 과도 — 반등 후보');
      if (z.z24h > 0.2) {
        confidence += 8;
        reasoning.push('단기 회복 시작 — 저점 다지기');
      }
    } else if (z.z7d > 0.6) {
      signal = 'SHORT';
      confidence = 50 + Math.min(35, z.z7d * 14);
      reasoning.push(`주간 상대 강세 (z=${z.z7d.toFixed(2)}) — 고평가`);
      reasoning.push('전체 대비 과도 상승 — 이익실현 압력');
      if (z.z24h < -0.2) {
        confidence += 8;
        reasoning.push('단기 하락 전환 징조');
      }
    } else {
      reasoning.push(`주봉 z-score ${z.z7d.toFixed(2)} — 횡보 구간`);
      reasoning.push('방향성 돌파 확인 필요');
      confidence = 28 + Math.abs(z.z7d) * 12;
    }
  }

  // ── Entry / SL / TP ──
  const atrPct: Record<TradingMode, number> = {
    scalping: 0.007,
    daytrading: 0.022,
    swing: 0.055,
  };
  const rrMap: Record<TradingMode, number> = {
    scalping: 2.0,
    daytrading: 2.5,
    swing: 3.0,
  };
  const atr = price * atrPct[mode];
  const rr = rrMap[mode];

  let longEntry: number | null = null;
  let shortEntry: number | null = null;
  let stopLoss = 0;
  let tp1 = 0;
  let tp2 = 0;

  if (signal === 'LONG') {
    longEntry =
      price * (mode === 'scalping' ? 0.9985 : mode === 'daytrading' ? 0.997 : 0.992);
    stopLoss = longEntry - atr * 1.5;
    tp1 = longEntry + atr * 1.5 * (rr * 0.6);
    tp2 = longEntry + atr * 1.5 * rr;
  } else if (signal === 'SHORT') {
    shortEntry =
      price * (mode === 'scalping' ? 1.0015 : mode === 'daytrading' ? 1.003 : 1.008);
    stopLoss = shortEntry + atr * 1.5;
    tp1 = shortEntry - atr * 1.5 * (rr * 0.6);
    tp2 = shortEntry - atr * 1.5 * rr;
  } else {
    longEntry = price * (1 - atrPct[mode] * 1.5);
    shortEntry = price * (1 + atrPct[mode] * 1.5);
    stopLoss = longEntry - atr;
    tp1 = price;
    tp2 = price;
  }

  // ── Strategy text ──
  const strategyMap: Record<TradingMode, Record<Signal, string>> = {
    scalping: {
      LONG: '15분봉 진입 — 전체 대비 상대 과매도. 즉시 TP1 목표 후 빠른 청산.',
      SHORT: '15분봉 진입 — 전체 대비 상대 과매수. 되돌림 0.5~1% 빠른 수익 실현.',
      WATCH: '5분봉 방향성 확립 대기. 변동성 확대 시 재스캔.',
    },
    daytrading: {
      LONG: '4시간봉 지지 확인 후 진입. TP1 50% 익절 후 나머지 TP2 홀딩.',
      SHORT: '4시간봉 저항 확인 후 숏 진입. 손절 타이트하게 유지.',
      WATCH: '4시간봉 방향 결정 대기. MACD 크로스 확인 필요.',
    },
    swing: {
      LONG: '일봉 되돌림 완료 시 3회 분할 매수. TP2까지 홀딩.',
      SHORT: '일봉 반등 시 분할 숏. 리스크 1% 이내 유지.',
      WATCH: '주봉 방향 돌파 확인 전 중립. 돌파 후 재진입.',
    },
  };

  // ── Indicator labels ──
  const trendLabel =
    z.z24h > 0.5 ? '강한 상승' : z.z24h > 0 ? '약한 상승' : z.z24h > -0.5 ? '약한 하락' : '강한 하락';
  const momentumLabel =
    z.z1h > 0.8 ? '과매수' :
    z.z1h > 0.3 ? '상승 우위' :
    z.z1h > -0.3 ? '중립' :
    z.z1h > -0.8 ? '하락 우위' : '과매도';
  const volumeLabel =
    z.volRatio > 1 ? '거래량 급증' : z.volRatio > 0 ? '거래량 정상' : '거래량 부족';

  return {
    coin,
    signal,
    confidence: Math.min(93, Math.max(15, Math.round(confidence))),
    longEntry,
    shortEntry,
    stopLoss: Number(stopLoss.toFixed(4)),
    takeProfit: Number(tp2.toFixed(4)),
    tp1: Number(tp1.toFixed(4)),
    tp2: Number(tp2.toFixed(4)),
    riskReward: rr,
    reasoning,
    strategy: strategyMap[mode][signal],
    indicators: {
      trend: trendLabel,
      momentum: momentumLabel,
      volume: volumeLabel,
      strength: Math.round(
        Math.min(
          100,
          Math.abs(mode === 'scalping' ? z.z1h : mode === 'daytrading' ? z.z24h : z.z7d) * 35 + 20
        )
      ),
    },
  };
}

export function useMarketAnalysis(coins: CoinData[], mode: TradingMode) {
  return useMemo(() => {
    if (!coins.length) return [] as CoinAnalysis[];
    const zMap = calcZScores(coins);
    return coins.map((c) => analyzeWithZ(c, zMap.get(c.id)!, mode));
  }, [coins, mode]);
}
