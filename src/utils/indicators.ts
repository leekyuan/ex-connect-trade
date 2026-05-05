/** Pure JS technical indicators — no external deps */

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/* ── RSI(period) ── */
export function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return rsi;

  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

/* ── EMA ── */
export function calcEMA(values: number[], period: number): number[] {
  const ema: number[] = new Array(values.length).fill(NaN);
  const k = 2 / (period + 1);
  let sum = 0, count = 0;
  for (let i = 0; i < values.length; i++) {
    if (isNaN(values[i])) continue;
    if (count < period) {
      sum += values[i];
      count++;
      if (count === period) ema[i] = sum / period;
    } else {
      ema[i] = values[i] * k + ema[i - 1] * (1 - k);
    }
  }
  return ema;
}

/* ── MACD(fast, slow, signal) ── */
export interface MACDResult { macd: number[]; signal: number[]; histogram: number[] }
export function calcMACD(closes: number[], fast = 12, slow = 26, sig = 9): MACDResult {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const macdLine = closes.map((_, i) =>
    isNaN(emaFast[i]) || isNaN(emaSlow[i]) ? NaN : emaFast[i] - emaSlow[i]
  );
  const signalLine = calcEMA(macdLine.map(v => isNaN(v) ? 0 : v), sig);
  const histogram = macdLine.map((v, i) =>
    isNaN(v) || isNaN(signalLine[i]) ? NaN : v - signalLine[i]
  );
  return { macd: macdLine, signal: signalLine, histogram };
}

/* ── Bollinger Bands(period, stdDev) ── */
export interface BBResult { upper: number[]; middle: number[]; lower: number[] }
export function calcBB(closes: number[], period = 20, mult = 2): BBResult {
  const upper: number[] = new Array(closes.length).fill(NaN);
  const middle: number[] = new Array(closes.length).fill(NaN);
  const lower: number[] = new Array(closes.length).fill(NaN);

  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    const avg = sum / period;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (closes[j] - avg) ** 2;
    const std = Math.sqrt(variance / period);
    middle[i] = avg;
    upper[i] = avg + std * mult;
    lower[i] = avg - std * mult;
  }
  return { upper, middle, lower };
}

/* ── ATR(period) ── */
export function calcATR(candles: Candle[], period = 14): number[] {
  const atr: number[] = new Array(candles.length).fill(NaN);
  if (candles.length < 2) return atr;

  const tr: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }

  let sum = 0;
  for (let i = 0; i < period && i < tr.length; i++) sum += tr[i];
  if (tr.length >= period) {
    atr[period - 1] = sum / period;
    for (let i = period; i < tr.length; i++) {
      atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
    }
  }
  return atr;
}

/* ── Supertrend(period, multiplier) ── */
export interface SupertrendResult { trend: ('up' | 'down')[]; value: number[] }
export function calcSupertrend(candles: Candle[], period = 10, mult = 2): SupertrendResult {
  const atr = calcATR(candles, period);
  const len = candles.length;
  const trend: ('up' | 'down')[] = new Array(len).fill('up');
  const value: number[] = new Array(len).fill(NaN);
  const upperBand: number[] = new Array(len).fill(NaN);
  const lowerBand: number[] = new Array(len).fill(NaN);

  for (let i = period - 1; i < len; i++) {
    const hl2 = (candles[i].high + candles[i].low) / 2;
    let ub = hl2 + mult * atr[i];
    let lb = hl2 - mult * atr[i];

    if (i > period - 1) {
      if (lb > lowerBand[i - 1] || candles[i - 1].close < lowerBand[i - 1]) { /* keep lb */ }
      else lb = lowerBand[i - 1];
      if (ub < upperBand[i - 1] || candles[i - 1].close > upperBand[i - 1]) { /* keep ub */ }
      else ub = upperBand[i - 1];
    }

    upperBand[i] = ub;
    lowerBand[i] = lb;

    if (i === period - 1) {
      trend[i] = candles[i].close > ub ? 'up' : 'down';
    } else {
      const prevTrend = trend[i - 1];
      if (prevTrend === 'up') {
        trend[i] = candles[i].close < lowerBand[i] ? 'down' : 'up';
      } else {
        trend[i] = candles[i].close > upperBand[i] ? 'up' : 'down';
      }
    }
    value[i] = trend[i] === 'up' ? lowerBand[i] : upperBand[i];
  }
  return { trend, value };
}

/* ── ZigZag swing points ── */
export interface SwingPoint { index: number; price: number; type: 'high' | 'low' }
export function findSwingPoints(candles: Candle[], threshold = 0.03): SwingPoint[] {
  if (candles.length < 3) return [];
  const points: SwingPoint[] = [];
  let lastType: 'high' | 'low' = candles[1].high > candles[0].high ? 'high' : 'low';
  let lastIdx = 0;
  let lastPrice = lastType === 'high' ? candles[0].high : candles[0].low;

  for (let i = 1; i < candles.length; i++) {
    if (lastType === 'low') {
      if (candles[i].low < lastPrice) {
        lastPrice = candles[i].low; lastIdx = i;
      } else if ((candles[i].high - lastPrice) / lastPrice >= threshold) {
        points.push({ index: lastIdx, price: lastPrice, type: 'low' });
        lastType = 'high'; lastPrice = candles[i].high; lastIdx = i;
      }
    } else {
      if (candles[i].high > lastPrice) {
        lastPrice = candles[i].high; lastIdx = i;
      } else if ((lastPrice - candles[i].low) / lastPrice >= threshold) {
        points.push({ index: lastIdx, price: lastPrice, type: 'high' });
        lastType = 'low'; lastPrice = candles[i].low; lastIdx = i;
      }
    }
  }
  points.push({ index: lastIdx, price: lastPrice, type: lastType });
  return points;
}
