import type { Candle } from '../indicators';

export interface TheorySignal {
  signal: 'LONG' | 'SHORT' | 'WATCH';
  confidence: number; // 0-100
  reason: string;     // Korean description
  entry: number;
  sl: number;
  tp: number;
}

export type TheoryAnalyzer = (candles: Candle[], currentPrice: number) => TheorySignal;
