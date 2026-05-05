export type Exchange = 'binance' | 'bybit' | 'okx';

export interface TradeParams {
  symbol: string;
  entry: number;
  tp1: number;
  tp2: number;
  sl: number;
  tpSplitRatio: number; // 0-100, percentage for TP1
  leverage: number;
  positionSize: number;
}

export interface ApiKeyConfig {
  exchange: Exchange;
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // OKX requires this
}
