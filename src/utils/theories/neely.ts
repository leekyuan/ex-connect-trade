/**
 * Glenn Neely — Neo-Wave 분석 (확장판)
 *
 * 출력:
 *  - signal/confidence/reason/entry/sl/tp (TheorySignal 호환)
 *  - structure: 라벨링된 스윙 포인트(0~5), 진행 단계, 채널선, 시나리오 3종
 *
 * 시나리오 산출 로직 (5파 미완·완성·실패에 따라 동적):
 *  1) 기본(BASE) — 가장 정통한 Neely 카운트가 그대로 진행될 경우
 *  2) 연장(EXTENSION) — Wave 5 연장 또는 임펄스 연장
 *  3) 실패/반전(FAILURE) — W4 침범 등 룰 위반으로 카운트가 무효화되는 경우
 */
import type { Candle } from '../indicators';
import { findSwingPoints, calcATR, type SwingPoint } from '../indicators';
import type { TheorySignal } from './types';

export type WaveLabel = '0' | '1' | '2' | '3' | '4' | '5' | 'a' | 'b' | 'c';

export interface LabeledSwing extends SwingPoint {
  label: WaveLabel;
}

export interface WaveChannel {
  /** 1·3 고점(또는 1·3 저점) 추세선 — [time, price] 두 점 */
  upper: { t1: number; p1: number; t2: number; p2: number };
  /** 2·4 저점(또는 2·4 고점) 추세선 */
  lower: { t1: number; p1: number; t2: number; p2: number };
}

export interface NeoWaveScenario {
  id: 'base' | 'extension' | 'failure';
  label: string;        // 한국어 표시명
  probability: number;  // 0..100
  direction: 'LONG' | 'SHORT' | 'WATCH';
  description: string;
  /** 시나리오 목표 가격 (현재→target 점선) */
  target: number;
  invalidation: number; // 시나리오가 무효화되는 가격
  color: string;        // 차트 표시용 hex (semantic 토큰 매핑은 컴포넌트에서)
}

export interface NeoWaveStructure {
  /** 임펄스 방향 */
  direction: 'up' | 'down' | 'corrective';
  /** 라벨링된 스윙 (0~5 또는 부분) */
  labeledSwings: LabeledSwing[];
  /** 현재 진행 단계 텍스트 (예: "W3 진행 중", "W5 완성, abc 조정 임박") */
  stage: string;
  /** 진행률 0..1 — 5파 완성도 */
  progress: number;
  /** 평행 채널 (3·4파 이상 확인된 경우) */
  channel: WaveChannel | null;
  /** Neely 룰 검증 결과 */
  rules: {
    w3NotShortest: boolean;
    w3GoldenExt: boolean;
    timeBalance: boolean;
    alternation: boolean;
    channelValid: boolean;
  };
}

export interface NeoWaveResult extends TheorySignal {
  structure: NeoWaveStructure;
  scenarios: NeoWaveScenario[];
}

function emptyStructure(): NeoWaveStructure {
  return {
    direction: 'corrective',
    labeledSwings: [],
    stage: '데이터 부족',
    progress: 0,
    channel: null,
    rules: { w3NotShortest: false, w3GoldenExt: false, timeBalance: false, alternation: false, channelValid: false },
  };
}

export function analyzeNeely(candles: Candle[], price: number): NeoWaveResult {
  const neutralStruct = emptyStructure();
  const neutral: NeoWaveResult = {
    signal: 'WATCH', confidence: 30,
    reason: 'Neo-Wave 구조 불명확 — 관망',
    entry: price, sl: price, tp: price,
    structure: neutralStruct,
    scenarios: [],
  };
  if (candles.length < 30) return neutral;

  const swings = findSwingPoints(candles, candles.length > 80 ? 0.022 : 0.015);
  if (swings.length < 4) {
    return { ...neutral, reason: 'Neely: 스윙 부족 — 패턴 카운팅 불가' };
  }

  const atr = calcATR(candles, 14);
  const a = atr[atr.length - 1] || price * 0.01;
  const lastIdx = candles.length - 1;
  const lastTime = candles[lastIdx].time;

  // 진행 중인 임펄스를 잡기 위해 4~6개 스윙 모두 활용
  const recent = swings.slice(-Math.min(6, swings.length));
  const n = recent.length;

  const dT = (i: number, j: number) => Math.abs(recent[j].index - recent[i].index);
  const dP = (i: number, j: number) => Math.abs(recent[j].price - recent[i].price);

  // ── 임펄스 방향 추정 ──
  // 6개 스윙: L H L H L H = up / H L H L H L = down
  // 4~5개면 진행 중 임펄스로 간주
  const types = recent.map(s => s.type).join(',');
  const isUp =
    types === 'low,high,low,high,low,high' ||
    types === 'low,high,low,high,low' ||
    types === 'low,high,low,high';
  const isDown =
    types === 'high,low,high,low,high,low' ||
    types === 'high,low,high,low,high' ||
    types === 'high,low,high,low';

  if (!isUp && !isDown) {
    // Corrective / diametric
    const last = recent[n - 1], prev = recent[n - 2];
    const drop = last.type === 'low' && prev.type === 'high';
    const labeledCorr: LabeledSwing[] = recent.slice(-3).map((s, i) => ({
      ...s, label: (['a', 'b', 'c'][i] as WaveLabel),
    }));
    const corrTarget = drop ? price - a * 2.5 : price + a * 2.5;
    const corrInval = drop ? recent[n - 1].price + a * 1.2 : recent[n - 1].price - a * 1.2;

    return {
      signal: 'WATCH', confidence: 38,
      reason: 'Neely: 조정/다이어메트릭 진행 중 — 명확한 임펄스 부재',
      entry: price,
      sl: drop ? price + a * 1.5 : price - a * 1.5,
      tp: corrTarget,
      structure: {
        direction: 'corrective',
        labeledSwings: labeledCorr,
        stage: drop ? 'abc 하락 조정 진행 중' : 'abc 상승 조정 진행 중',
        progress: 0.5,
        channel: null,
        rules: { w3NotShortest: false, w3GoldenExt: false, timeBalance: false, alternation: false, channelValid: false },
      },
      scenarios: [
        {
          id: 'base', label: '조정 지속', probability: 50,
          direction: drop ? 'SHORT' : 'LONG',
          description: 'abc 조정의 c파가 직전 스윙만큼 진행',
          target: corrTarget, invalidation: corrInval, color: '#3b82f6',
        },
        {
          id: 'extension', label: '연장 조정', probability: 30,
          direction: drop ? 'SHORT' : 'LONG',
          description: 'c파가 1.618 × a파 연장',
          target: drop ? price - a * 4 : price + a * 4,
          invalidation: corrInval, color: '#a855f7',
        },
        {
          id: 'failure', label: '조정 실패 → 반전', probability: 20,
          direction: drop ? 'LONG' : 'SHORT',
          description: '직전 스윙 돌파 시 새로운 임펄스 시작',
          target: drop ? price + a * 3 : price - a * 3,
          invalidation: drop ? price - a * 1.5 : price + a * 1.5,
          color: '#f59e0b',
        },
      ],
    };
  }

  // ── 라벨링 (마지막 N개를 0~5에 매핑) ──
  // n=6 → 0,1,2,3,4,5 / n=5 → 1,2,3,4,5 / n=4 → 1,2,3,4
  const labelMap: WaveLabel[][] = {
    6: ['0', '1', '2', '3', '4', '5'],
    5: ['1', '2', '3', '4', '5'],
    4: ['1', '2', '3', '4'],
  } as any;
  const labels = labelMap[n] ?? ['0', '1', '2', '3', '4', '5'];
  const labeledSwings: LabeledSwing[] = recent.map((s, i) => ({ ...s, label: labels[i] }));

  // 인덱스 헬퍼: label '0'..'5'의 위치
  const idxOf = (l: WaveLabel) => labeledSwings.findIndex(s => s.label === l);

  // 파장 (있는 만큼만)
  const w1 = idxOf('1') > 0 && idxOf('0') >= 0 ? Math.abs(labeledSwings[idxOf('1')].price - labeledSwings[idxOf('0')].price) : (idxOf('2') >= 0 && idxOf('1') >= 0 ? Math.abs(labeledSwings[idxOf('2')].price - labeledSwings[idxOf('1')].price) : 0);
  const w3Idx1 = idxOf('2'), w3Idx2 = idxOf('3');
  const w3 = w3Idx1 >= 0 && w3Idx2 >= 0 ? Math.abs(labeledSwings[w3Idx2].price - labeledSwings[w3Idx1].price) : 0;
  const w5Idx1 = idxOf('4'), w5Idx2 = idxOf('5');
  const w5 = w5Idx1 >= 0 && w5Idx2 >= 0 ? Math.abs(labeledSwings[w5Idx2].price - labeledSwings[w5Idx1].price) : 0;
  const t2 = idxOf('1') >= 0 && idxOf('2') >= 0 ? Math.abs(labeledSwings[idxOf('2')].index - labeledSwings[idxOf('1')].index) : 0;
  const t4 = idxOf('3') >= 0 && idxOf('4') >= 0 ? Math.abs(labeledSwings[idxOf('4')].index - labeledSwings[idxOf('3')].index) : 0;

  // ── Neely 룰 검증 ──
  const rules = {
    w3NotShortest: w3 > 0 && w3 >= w1 && (w5 === 0 || w3 >= w5),
    w3GoldenExt: w1 > 0 && w3 / w1 >= 1.4 && w3 / w1 <= 2.0,
    timeBalance: t2 > 0 && t4 > 0 && Math.max(t2, t4) / Math.min(t2, t4) < 3,
    alternation: false, // 단순화
    channelValid: false,
  };

  let score = 50;
  const reasons: string[] = [];
  if (rules.w3NotShortest) { score += 12; reasons.push('W3 최장 ✓'); }
  else if (w5 > 0) { score -= 18; reasons.push('W3 최단 — 임펄스 무효 위험'); }
  if (rules.w3GoldenExt) { score += 10; reasons.push(`W3 = ${(w3 / w1).toFixed(2)}×W1 (황금비)`); }
  if (rules.timeBalance) { score += 8; reasons.push(`시간 균형 (W2/W4 = ${(Math.max(t2, t4) / Math.min(t2, t4)).toFixed(1)})`); }

  // ── 채널 (1·3, 2·4 평행선) ──
  let channel: WaveChannel | null = null;
  const i1 = idxOf('1'), i2 = idxOf('2'), i3 = idxOf('3'), i4 = idxOf('4');
  if (i1 >= 0 && i3 >= 0 && i2 >= 0 && i4 >= 0) {
    channel = {
      upper: {
        t1: candles[labeledSwings[i1].index].time, p1: labeledSwings[i1].price,
        t2: candles[labeledSwings[i3].index].time, p2: labeledSwings[i3].price,
      },
      lower: {
        t1: candles[labeledSwings[i2].index].time, p1: labeledSwings[i2].price,
        t2: candles[labeledSwings[i4].index].time, p2: labeledSwings[i4].price,
      },
    };
    rules.channelValid = true;
    score += 5;
  }

  score = Math.min(88, Math.max(15, score));

  // ── 진행 단계 + 시그널 ──
  const direction: 'up' | 'down' = isUp ? 'up' : 'down';
  const has5 = idxOf('5') >= 0;
  let stage = '';
  let progress = 0;
  let signal: 'LONG' | 'SHORT' | 'WATCH';
  let entry: number, sl: number, tp: number;

  if (has5) {
    stage = direction === 'up' ? 'W5 완성 — abc 조정 임박' : 'W5 완성 — abc 반등 임박';
    progress = 1.0;
    // 5파 완성 → 반대 매매
    if (direction === 'up') {
      signal = 'SHORT';
      entry = price * 0.998;
      sl = labeledSwings[idxOf('5')].price + a * 0.8;
      tp = labeledSwings[i4 >= 0 ? i4 : 0].price; // W4 저점 부근
    } else {
      signal = 'LONG';
      entry = price * 1.002;
      sl = labeledSwings[idxOf('5')].price - a * 0.8;
      tp = labeledSwings[i4 >= 0 ? i4 : 0].price;
    }
  } else if (idxOf('4') >= 0) {
    stage = direction === 'up' ? 'W4 완성 — W5 상승 진행 중' : 'W4 완성 — W5 하락 진행 중';
    progress = 0.8;
    // W5 추종
    if (direction === 'up') {
      signal = 'LONG';
      entry = price;
      sl = labeledSwings[i4].price - a * 0.5;
      // W5 ≈ W1 측정
      tp = labeledSwings[i4].price + w1;
    } else {
      signal = 'SHORT';
      entry = price;
      sl = labeledSwings[i4].price + a * 0.5;
      tp = labeledSwings[i4].price - w1;
    }
  } else if (idxOf('3') >= 0) {
    stage = direction === 'up' ? 'W3 완성 — W4 조정 대기' : 'W3 완성 — W4 반등 대기';
    progress = 0.6;
    signal = 'WATCH';
    entry = price;
    if (direction === 'up') {
      sl = labeledSwings[i3].price + a * 1;
      tp = labeledSwings[i3].price - w1 * 0.382; // W4 = 0.382 × W3 retracement
    } else {
      sl = labeledSwings[i3].price - a * 1;
      tp = labeledSwings[i3].price + w1 * 0.382;
    }
  } else {
    stage = direction === 'up' ? 'W1·W2 형성 — W3 진입 대기' : 'W1·W2 형성 — W3 진입 대기';
    progress = 0.3;
    signal = direction === 'up' ? 'LONG' : 'SHORT';
    entry = price;
    sl = direction === 'up' ? price - a * 1.5 : price + a * 1.5;
    tp = direction === 'up' ? price + w1 * 1.618 : price - w1 * 1.618;
  }

  // ── 3가지 시나리오 ──
  const scenarios: NeoWaveScenario[] = [];

  if (has5) {
    // 5파 완성 → 시나리오는 조정/연장/실패
    const w4Price = i4 >= 0 ? labeledSwings[i4].price : price;
    const w5Price = labeledSwings[idxOf('5')].price;
    if (direction === 'up') {
      scenarios.push(
        {
          id: 'base', label: '기본: ABC 조정',
          probability: rules.w3NotShortest ? 55 : 45,
          direction: 'SHORT',
          description: `5파 완성. W4(${w4Price.toFixed(2)}) 부근까지 조정`,
          target: w4Price, invalidation: w5Price + a * 1.2, color: '#3b82f6',
        },
        {
          id: 'extension', label: '연장: 5파 연장',
          probability: 25,
          direction: 'LONG',
          description: '5파가 추가 연장(1.618×W1) — 신고가 갱신',
          target: w5Price + w1 * 0.618, invalidation: labeledSwings[i4 >= 0 ? i4 : 0].price, color: '#a855f7',
        },
        {
          id: 'failure', label: '실패: 임펄스 반전',
          probability: 20,
          direction: 'SHORT',
          description: 'W4 저점 이탈 시 임펄스 무효 → 추세 반전',
          target: labeledSwings[idxOf('2') >= 0 ? idxOf('2') : 0].price,
          invalidation: w5Price + a * 0.5, color: '#f59e0b',
        },
      );
    } else {
      scenarios.push(
        {
          id: 'base', label: '기본: abc 반등',
          probability: rules.w3NotShortest ? 55 : 45,
          direction: 'LONG',
          description: `하락 5파 완성. W4(${w4Price.toFixed(2)}) 부근까지 반등`,
          target: w4Price, invalidation: w5Price - a * 1.2, color: '#3b82f6',
        },
        {
          id: 'extension', label: '연장: 5파 연장',
          probability: 25,
          direction: 'SHORT',
          description: '5파가 추가 연장 — 신저가 갱신',
          target: w5Price - w1 * 0.618, invalidation: labeledSwings[i4 >= 0 ? i4 : 0].price, color: '#a855f7',
        },
        {
          id: 'failure', label: '실패: 임펄스 반전',
          probability: 20,
          direction: 'LONG',
          description: 'W4 고점 돌파 시 하락 임펄스 무효 → 추세 반전',
          target: labeledSwings[idxOf('2') >= 0 ? idxOf('2') : 0].price,
          invalidation: w5Price - a * 0.5, color: '#f59e0b',
        },
      );
    }
  } else if (idxOf('4') >= 0) {
    // W5 진행 중
    const w4Price = labeledSwings[i4].price;
    const w5Target = direction === 'up' ? w4Price + w1 : w4Price - w1;
    const w5Ext = direction === 'up' ? w4Price + w1 * 1.618 : w4Price - w1 * 1.618;
    scenarios.push(
      {
        id: 'base', label: '기본: W5 = W1',
        probability: 50,
        direction: direction === 'up' ? 'LONG' : 'SHORT',
        description: 'W5가 W1과 같은 길이 — 가장 보편적',
        target: w5Target, invalidation: w4Price + (direction === 'up' ? -a : a), color: '#3b82f6',
      },
      {
        id: 'extension', label: '연장: W5 = 1.618×W1',
        probability: 30,
        direction: direction === 'up' ? 'LONG' : 'SHORT',
        description: 'W3가 약했다면 W5가 연장될 가능성',
        target: w5Ext, invalidation: w4Price + (direction === 'up' ? -a : a), color: '#a855f7',
      },
      {
        id: 'failure', label: '실패: W4 침범',
        probability: 20,
        direction: direction === 'up' ? 'SHORT' : 'LONG',
        description: 'W4 저점/고점 침범 시 임펄스 무효',
        target: direction === 'up' ? labeledSwings[idxOf('2') >= 0 ? idxOf('2') : 0].price : labeledSwings[idxOf('2') >= 0 ? idxOf('2') : 0].price,
        invalidation: w4Price, color: '#f59e0b',
      },
    );
  } else if (idxOf('3') >= 0) {
    // W4 대기
    const w3Price = labeledSwings[i3].price;
    scenarios.push(
      {
        id: 'base', label: '기본: W4 = 0.382×W3 조정',
        probability: 50,
        direction: 'WATCH',
        description: '얕은 조정 후 W5 진입',
        target: direction === 'up' ? w3Price - w3 * 0.382 : w3Price + w3 * 0.382,
        invalidation: direction === 'up' ? w3Price + a : w3Price - a, color: '#3b82f6',
      },
      {
        id: 'extension', label: '연장: W4 = 0.618×W3 깊은 조정',
        probability: 30,
        direction: direction === 'up' ? 'LONG' : 'SHORT',
        description: '깊은 조정 후 강한 W5',
        target: direction === 'up' ? w3Price - w3 * 0.618 : w3Price + w3 * 0.618,
        invalidation: direction === 'up' ? labeledSwings[i1].price : labeledSwings[i1].price, color: '#a855f7',
      },
      {
        id: 'failure', label: '실패: W1 영역 침범',
        probability: 20,
        direction: direction === 'up' ? 'SHORT' : 'LONG',
        description: 'W4가 W1 영역 침범 → 임펄스 무효',
        target: direction === 'up' ? labeledSwings[idxOf('0') >= 0 ? idxOf('0') : i1].price : labeledSwings[idxOf('0') >= 0 ? idxOf('0') : i1].price,
        invalidation: labeledSwings[i1].price, color: '#f59e0b',
      },
    );
  } else {
    // 초기 단계
    scenarios.push(
      {
        id: 'base', label: '기본: 임펄스 진행',
        probability: 50,
        direction: direction === 'up' ? 'LONG' : 'SHORT',
        description: '추정 W3 진입 — 1.618×W1 목표',
        target: direction === 'up' ? price + w1 * 1.618 : price - w1 * 1.618,
        invalidation: direction === 'up' ? price - a * 1.5 : price + a * 1.5, color: '#3b82f6',
      },
      {
        id: 'extension', label: '연장 임펄스',
        probability: 30,
        direction: direction === 'up' ? 'LONG' : 'SHORT',
        description: 'W3가 2.618×W1 연장',
        target: direction === 'up' ? price + w1 * 2.618 : price - w1 * 2.618,
        invalidation: direction === 'up' ? price - a * 2 : price + a * 2, color: '#a855f7',
      },
      {
        id: 'failure', label: '실패: 추세 미형성',
        probability: 20,
        direction: 'WATCH',
        description: '횡보 박스 진입 — 임펄스 무효',
        target: price, invalidation: direction === 'up' ? price - a * 1 : price + a * 1, color: '#f59e0b',
      },
    );
  }

  return {
    signal,
    confidence: score,
    reason: `Neely: ${stage}. ${reasons.join(', ')}`,
    entry, sl, tp,
    structure: {
      direction,
      labeledSwings,
      stage,
      progress,
      channel,
      rules,
    },
    scenarios,
  };
}
