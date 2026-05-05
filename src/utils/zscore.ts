export interface CoinWithZ {
  z1h: number;
  z24h: number;
  z7d: number;
  volRatio: number;
}

export function calcZScores(coins: any[]): Map<number, CoinWithZ> {
  const stat = (arr: number[]) => {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const std =
      Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length) || 1;
    return { mean, std };
  };

  const ch1h = coins.map((c) => c.percent_change_1h ?? 0);
  const ch24h = coins.map((c) => c.percent_change_24h ?? 0);
  const ch7d = coins.map((c) => c.percent_change_7d ?? 0);
  const volR = coins.map((c) => c.volume_24h / ((c.market_cap || 1) * 0.03));

  const s1h = stat(ch1h);
  const s24h = stat(ch24h);
  const s7d = stat(ch7d);
  const sVol = stat(volR);

  const result = new Map<number, CoinWithZ>();
  coins.forEach((coin, i) => {
    result.set(coin.id, {
      z1h: (ch1h[i] - s1h.mean) / s1h.std,
      z24h: (ch24h[i] - s24h.mean) / s24h.std,
      z7d: (ch7d[i] - s7d.mean) / s7d.std,
      volRatio: (volR[i] - sVol.mean) / sVol.std,
    });
  });
  return result;
}
