/**
 * 멀티-타임프레임 HTF 가중 통합 신호
 *
 * 한 코인을 여러 봉(예: 1h/4h/1d)에서 동시에 분석한 뒤,
 * 고타임프레임(HTF)일수록 더 높은 가중치를 적용해 최종 신호를 산출.
 *
 * 근거: HTF 신호는 노이즈가 적고 추세 신뢰도가 높음.
 *  - 일봉 신호 1개 > 1시간봉 신호 3~5개 가치
 */
import type { Candle } from './indicators';
import { computeUnifiedSignal, type UnifiedSignal, type UnifiedLabel, LABEL_META } from './unifiedSignal';

/** 그룹 정의 — 사용자 요구사항 그대로 */
export type StyleGroup = 'scalping' | 'daytrading' | 'swing';

export interface TfDef {
  /** Binance API interval */
  binance: string;
  /** TradingView interval */
  tv: string;
  /** 한국어 라벨 */
  label: string;
  /** HTF 가중치 (그룹 내 상대) */
  weight: number;
}

export const STYLE_GROUPS: Record<StyleGroup, { label: string; emoji: string; tfs: TfDef[] }> = {
  scalping: {
    label: '스캘핑',
    emoji: '⚡',
    tfs: [
      { binance: '5m',  tv: '5',  label: '5분봉',  weight: 1 },
      { binance: '15m', tv: '15', label: '15분봉', weight: 2 },
      { binance: '30m', tv: '30', label: '30분봉', weight: 3 },
    ],
  },
  daytrading: {
    label: '단타',
    emoji: '📈',
    tfs: [
      { binance: '1h',  tv: '60',  label: '1시간봉',  weight: 1 },
      { binance: '4h',  tv: '240', label: '4시간봉',  weight: 2 },
      { binance: '12h', tv: '720', label: '12시간봉', weight: 3 },
    ],
  },
  swing: {
    label: '스윙',
    emoji: '🌊',
    tfs: [
      { binance: '1d', tv: 'D',  label: '1일봉', weight: 1 },
      { binance: '3d', tv: '3D', label: '3일봉', weight: 2 },
      { binance: '1w', tv: 'W',  label: '주봉',  weight: 3 },
    ],
  },
};

export interface PerTfResult {
  tf: TfDef;
  signal: UnifiedSignal | null;
  error?: string;
}

export interface MultiTfSignal {
  group: StyleGroup;
  perTf: PerTfResult[];
  /** HTF-가중 평균 점수 (0..100) */
  weightedScore: number;
  label: UnifiedLabel;
  /** 일치하는 TF 수 (같은 방향) */
  agreement: number;
  /** 추천 TF — 최고 가중치 + 신호 명확한 봉 */
  primaryTf: TfDef;
  /** primary TF의 신호를 그대로 가져옴 (entry/SL/TP 등) */
  primarySignal: UnifiedSignal;
  comment: string;
}

async function fetchCandles(symbol: string, interval: string, limit = 300): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data: any[] = await r.json();
  return data.map(k => ({
    time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5],
  }));
}

function labelFromScore(s: number): UnifiedLabel {
  if (s >= 75) return 'STRONG_BUY';
  if (s >= 60) return 'BUY';
  if (s >= 40) return 'WATCH';
  if (s >= 25) return 'SELL';
  return 'STRONG_SELL';
}

function dirOf(l: UnifiedLabel): -1 | 0 | 1 {
  if (l === 'STRONG_BUY' || l === 'BUY') return 1;
  if (l === 'STRONG_SELL' || l === 'SELL') return -1;
  return 0;
}

export async function computeMultiTfSignal(
  symbol: string,
  group: StyleGroup,
): Promise<MultiTfSignal> {
  const tfs = STYLE_GROUPS[group].tfs;

  // 병렬 fetch
  const results = await Promise.all(tfs.map(async (tf): Promise<PerTfResult> => {
    try {
      const candles = await fetchCandles(symbol, tf.binance, 300);
      const price = candles[candles.length - 1]?.close;
      if (!price) return { tf, signal: null, error: '가격 없음' };
      const sig = computeUnifiedSignal(candles, price);
      return { tf, signal: sig };
    } catch (e: any) {
      return { tf, signal: null, error: e.message ?? '로드 실패' };
    }
  }));

  // HTF 가중 평균 — 50점 기준 편차에 weight 적용
  let weightedDiff = 0;
  let totalWeight = 0;
  for (const r of results) {
    if (!r.signal) continue;
    weightedDiff += (r.signal.score - 50) * r.tf.weight;
    totalWeight += r.tf.weight;
  }
  const weightedScore = totalWeight > 0
    ? Math.max(0, Math.min(100, 50 + weightedDiff / totalWeight))
    : 50;

  const label = labelFromScore(weightedScore);

  // Agreement count
  const dir = dirOf(label);
  const agreement = results.filter(r => r.signal && dirOf(r.signal.label) === dir).length;

  // Primary TF — 가장 높은 weight 중 신호가 있는 것
  const primary = [...results]
    .filter(r => r.signal)
    .sort((a, b) => b.tf.weight - a.tf.weight)[0]
    ?? results[0];

  const primarySignal = primary.signal!; // 호출 측에서 null 체크
  const primaryTf = primary.tf;

  // 코멘트 — HTF 일치 여부
  const parts: string[] = [];
  parts.push(`[${STYLE_GROUPS[group].label}] ${primaryTf.label} 기준 ${LABEL_META[label].ko}`);
  if (agreement === results.length) parts.push('전 타임프레임 일치 — 매우 강한 신호.');
  else if (agreement >= 2) parts.push(`${agreement}/${results.length} TF 일치 — 신뢰도 양호.`);
  else parts.push('TF간 신호 엇갈림 — HTF 우선 참고.');

  return {
    group,
    perTf: results,
    weightedScore: Math.round(weightedScore * 10) / 10,
    label,
    agreement,
    primaryTf,
    primarySignal,
    comment: parts.join(' '),
  };
}
