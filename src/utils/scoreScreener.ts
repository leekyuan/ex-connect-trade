/**
 * 빠른 멀티-코인 스크리닝용 신호 스코어 (RSI + MACD + 볼륨 스파이크)
 * 0-100. 추천 전략 (SCALP / DAY / SWING) 자동 분류.
 */
import { calcRSI, calcMACD, type Candle } from './indicators';

export type StratTag = 'SCALP' | 'DAY' | 'SWING';

export interface ScreenerScore {
  score: number;           // 0..100 (50 중립)
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  rsi: number | null;
  macdHist: number | null;
  volumeSpike: number;     // 1.0 = 평균
  strategy: StratTag;      // 가장 점수 높은 전략
  scalp: number; day: number; swing: number;
}

function clip(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

function scoreFromCandles(candles: Candle[]): { score: number; rsi: number | null; hist: number | null; vol: number } {
  if (candles.length < 30) return { score: 50, rsi: null, hist: null, vol: 1 };
  const closes = candles.map(c => c.close);
  const vols = candles.map(c => c.volume);

  const rsiArr = calcRSI(closes, 14);
  const rsi = rsiArr[rsiArr.length - 1];
  const macd = calcMACD(closes);
  const hist = macd.histogram[macd.histogram.length - 1];
  const prevHist = macd.histogram[macd.histogram.length - 2];

  const recent = vols.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const base = vols.slice(-23, -3).reduce((a, b) => a + b, 0) / 20 || 1;
  const volSpike = recent / base;

  let score = 50;
  if (!isNaN(rsi)) {
    if (rsi < 30) score += 15;
    else if (rsi < 45) score += 6;
    else if (rsi > 70) score -= 15;
    else if (rsi > 55) score -= 4;
  }
  if (!isNaN(hist) && !isNaN(prevHist)) {
    if (hist > 0 && hist > prevHist) score += 12;
    else if (hist < 0 && hist < prevHist) score -= 12;
    else if (hist > 0) score += 5;
    else if (hist < 0) score -= 5;
  }
  if (volSpike > 2) score += (score >= 50 ? 8 : -8);
  else if (volSpike > 1.5) score += (score >= 50 ? 4 : -4);

  return {
    score: clip(score, 0, 100),
    rsi: isNaN(rsi) ? null : Number(rsi.toFixed(1)),
    hist: isNaN(hist) ? null : Number(hist.toFixed(4)),
    vol: Number(volSpike.toFixed(2)),
  };
}

/** 코인 1개에 대해 3개 TF로 점수를 계산하여 가장 강한 전략을 추천 */
export async function computeScreenerScore(symbol: string): Promise<ScreenerScore | null> {
  try {
    // 5m (스캘핑), 1h (단타), 1d (스윙) 60봉씩
    const tfs: Array<{ tf: string; tag: StratTag }> = [
      { tf: '15m', tag: 'SCALP' },
      { tf: '1h',  tag: 'DAY' },
      { tf: '4h',  tag: 'SWING' },
    ];
    const out: Record<StratTag, number> = { SCALP: 50, DAY: 50, SWING: 50 };
    let dayDetails = { rsi: null as number | null, hist: null as number | null, vol: 1 };

    for (const t of tfs) {
      const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${t.tf}&limit=80`);
      if (!r.ok) continue;
      const raw: any[] = await r.json();
      const candles: Candle[] = raw.map(c => ({
        time: c[0],
        open: parseFloat(c[1]), high: parseFloat(c[2]),
        low: parseFloat(c[3]),  close: parseFloat(c[4]),
        volume: parseFloat(c[5]),
      }));
      const s = scoreFromCandles(candles);
      out[t.tag] = s.score;
      if (t.tag === 'DAY') dayDetails = { rsi: s.rsi, hist: s.hist, vol: s.vol };
    }

    // 가장 50에서 멀리 떨어진 (= 시그널이 강한) 전략을 추천
    const winner = (Object.keys(out) as StratTag[]).reduce((best, k) =>
      Math.abs(out[k] - 50) > Math.abs(out[best] - 50) ? k : best
    , 'DAY' as StratTag);

    const composite = Math.round((out.SCALP * 0.25 + out.DAY * 0.45 + out.SWING * 0.30));
    const direction: 'LONG' | 'SHORT' | 'NEUTRAL' =
      composite >= 60 ? 'LONG' : composite <= 40 ? 'SHORT' : 'NEUTRAL';

    return {
      score: composite,
      direction,
      rsi: dayDetails.rsi,
      macdHist: dayDetails.hist,
      volumeSpike: dayDetails.vol,
      strategy: winner,
      scalp: out.SCALP, day: out.DAY, swing: out.SWING,
    };
  } catch {
    return null;
  }
}
