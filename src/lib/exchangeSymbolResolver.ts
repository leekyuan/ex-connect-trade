/**
 * exchangeSymbolResolver.ts
 * 
 * Binance 미상장 코인 → OKX → Bybit → MEXC 자동 폴백
 * TradingView 위젯에 올바른 거래소:심볼 형식 제공
 * 
 * Lovable 프로젝트에 /src/lib/ 또는 /src/utils/ 에 추가하세요.
 */

export type SupportedExchange = 'BINANCE' | 'OKX' | 'BYBIT' | 'MEXC' | 'BITGET' | 'GATEIO';

export interface SymbolResolution {
  exchange: SupportedExchange;
  tvSymbol: string;       // TradingView 위젯에 넣을 심볼 (예: "OKX:TONUSDT")
  isFutures: boolean;
  fallback: boolean;      // true = 원래 거래소(Binance)에 없어서 폴백된 것
}

// Binance Futures에 상장되지 않은 코인 목록 (현재 파악된 것들)
// 실제로는 API로 동적 확인하는 것이 좋음
const BINANCE_FUTURES_DELISTED = new Set([
  'HYPE', 'JU', 'LEO', 'WETH', 'OPG', 'CC', 'PRL', 'QUQ', 'M',
  'DOGS', 'TON', 'PENGU', 'MEGA', 'TRUMP', 'SC', 'TAO',
  'XMR', 'MONERO', // Binance에서 상장폐지됨
]);

// 거래소별 TradingView 심볼 prefix
const TV_EXCHANGE_PREFIX: Record<SupportedExchange, string> = {
  BINANCE: 'BINANCE',
  OKX: 'OKX',
  BYBIT: 'BYBIT',
  MEXC: 'MEXC',
  BITGET: 'BITGET',
  GATEIO: 'GATEIO',
};

// 거래소 우선순위 (설정에서 변경 가능하도록 export)
export const DEFAULT_EXCHANGE_PRIORITY: SupportedExchange[] = [
  'BINANCE',
  'OKX',
  'BYBIT',
  'MEXC',
  'BITGET',
  'GATEIO',
];

// 특정 코인이 특정 거래소에 있는지 확인 (실제로는 각 거래소 API 호출)
// 여기서는 알려진 케이스를 하드코딩 + API 동적 확인 병행
const EXCHANGE_LISTINGS: Partial<Record<SupportedExchange, Set<string>>> = {
  OKX: new Set([
    'HYPE', 'TON', 'PENGU', 'DOGS', 'MEGA', 'TRUMP', 'SC', 'TAO',
    'XMR', 'JU', 'LEO', 'CC', 'QUQ', 'M', 'WETH',
    // OKX는 대부분 알트코인 지원
    'BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'DOGE', 'ADA', 'LINK',
    'AVAX', 'LTC', 'BCH', 'TRX', 'ZEC', 'SUI', 'SHIB', 'UNI',
    'DOT', 'PEPE', 'XLM', 'HBAR', 'AAVE', 'PAXG',
  ]),
  BYBIT: new Set([
    'TON', 'PENGU', 'DOGS', 'MEGA', 'TRUMP', 'SC', 'TAO',
    'XMR', 'HYPE', 'M',
    'BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'DOGE', 'ADA', 'LINK',
  ]),
  MEXC: new Set([
    'HYPE', 'JU', 'LEO', 'OPG', 'CC', 'PRL', 'QUQ', 'TON',
    'PENGU', 'DOGS', 'MEGA', 'TRUMP', 'SC', 'TAO', 'XMR', 'M',
    'BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'ADA',
  ]),
};

/**
 * 코인 베이스 심볼 → TradingView 심볼 해석
 * @param baseSymbol  예: "TON", "BTC", "HYPE"
 * @param quoteAsset  예: "USDT" (기본값)
 * @param isFutures   선물 거래 여부
 * @param priority    거래소 우선순위 (설정에서 가져옴)
 */
export function resolveSymbol(
  baseSymbol: string,
  quoteAsset = 'USDT',
  isFutures = true,
  priority: SupportedExchange[] = DEFAULT_EXCHANGE_PRIORITY
): SymbolResolution {
  const upper = baseSymbol.toUpperCase();
  const pair = `${upper}${quoteAsset}`;

  // 1. Binance 상장 확인
  const isBinanceListed = !BINANCE_FUTURES_DELISTED.has(upper);
  
  if (isBinanceListed && priority[0] === 'BINANCE') {
    const suffix = isFutures ? '.P' : ''; // TradingView futures suffix
    return {
      exchange: 'BINANCE',
      tvSymbol: isFutures ? `BINANCE:${pair}PERP` : `BINANCE:${pair}`,
      isFutures,
      fallback: false,
    };
  }

  // 2. 폴백: 다음 우선순위 거래소에서 찾기
  for (const exchange of priority) {
    if (exchange === 'BINANCE') continue; // 이미 확인함
    
    const listings = EXCHANGE_LISTINGS[exchange];
    if (listings && listings.has(upper)) {
      const tvSymbol = buildTVSymbol(exchange, pair, isFutures);
      return {
        exchange,
        tvSymbol,
        isFutures,
        fallback: true,
      };
    }
  }

  // 3. 전혀 못 찾으면 OKX로 시도 (가장 많은 코인 지원)
  return {
    exchange: 'OKX',
    tvSymbol: buildTVSymbol('OKX', pair, isFutures),
    isFutures,
    fallback: true,
  };
}

function buildTVSymbol(exchange: SupportedExchange, pair: string, isFutures: boolean): string {
  const prefix = TV_EXCHANGE_PREFIX[exchange];
  
  switch (exchange) {
    case 'OKX':
      // OKX: OKX:BTCUSDT.P (perpetual) or OKX:BTCUSDT (spot)
      return isFutures ? `${prefix}:${pair}.P` : `${prefix}:${pair}`;
    
    case 'BYBIT':
      // Bybit: BYBIT:BTCUSDT.P
      return isFutures ? `${prefix}:${pair}.P` : `${prefix}:${pair}`;
    
    case 'MEXC':
      return `${prefix}:${pair}`;
    
    case 'BITGET':
      return isFutures ? `${prefix}:${pair}PERP` : `${prefix}:${pair}`;
    
    case 'GATEIO':
      return `${prefix}:${pair}_PERP`;
    
    default:
      return `${prefix}:${pair}`;
  }
}

/**
 * Binance API로 실제 상장 여부 확인 (비동기)
 * 앱 초기화 시 한 번 호출하여 BINANCE_FUTURES_DELISTED 캐시 업데이트
 */
export async function fetchBinanceFuturesListings(): Promise<Set<string>> {
  try {
    const res = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo');
    const data = await res.json();
    const symbols = new Set<string>(
      data.symbols
        .filter((s: any) => s.status === 'TRADING' && s.quoteAsset === 'USDT')
        .map((s: any) => s.baseAsset as string)
    );
    return symbols;
  } catch {
    console.warn('[exchangeSymbolResolver] Binance API 호출 실패, 캐시 사용');
    return new Set();
  }
}

/**
 * OKX API로 상장 심볼 확인
 */
export async function fetchOKXListings(): Promise<Set<string>> {
  try {
    const res = await fetch('https://www.okx.com/api/v5/public/instruments?instType=SWAP');
    const data = await res.json();
    const symbols = new Set<string>(
      (data.data || [])
        .filter((s: any) => s.settleCcy === 'USDT')
        .map((s: any) => (s.baseCcy as string).toUpperCase())
    );
    return symbols;
  } catch {
    console.warn('[exchangeSymbolResolver] OKX API 호출 실패');
    return new Set();
  }
}

/** 
 * useExchangeSymbol React Hook
 * 컴포넌트에서 바로 사용 가능
 */
export function useExchangeSymbol(
  baseSymbol: string,
  priority?: SupportedExchange[]
): SymbolResolution {
  // React import 없이 순수 함수로도 쓸 수 있게 함수 형태 유지
  return resolveSymbol(baseSymbol, 'USDT', true, priority);
}
