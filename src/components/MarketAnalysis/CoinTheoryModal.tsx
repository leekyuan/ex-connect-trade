import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useBinanceOHLCV } from '@/hooks/useBinanceOHLCV';
import { useAdvancedAnalysis } from '@/hooks/useAdvancedAnalysis';
import { useFundamental } from '@/hooks/useFundamental';
import { AdvancedAnalysisPanel } from './AdvancedAnalysisPanel';
import type { CoinAnalysis, TradingMode } from '@/hooks/useMarketAnalysis';

interface Props {
  coin: CoinAnalysis | null;
  mode: TradingMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CoinTheoryModal({ coin, mode, open, onOpenChange }: Props) {
  // Only fetch when modal is open & we have a coin
  const symbol = open && coin ? coin.coin.symbol : '';
  const symbols = symbol ? [symbol] : [];
  const ohlcv = useBinanceOHLCV(symbols, mode);
  const candles = symbol ? ohlcv[symbol]?.candles ?? null : null;
  const fundamental = useFundamental(open && coin ? coin.coin.symbol : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{coin?.coin.symbol}/USDT</span>
            <span className="text-sm text-muted-foreground font-normal">
              6대 이론 정밀 분석
            </span>
          </DialogTitle>
        </DialogHeader>
        {coin && (
          <AdvancedPanelWrapper
            coin={coin}
            candles={candles}
            mode={mode}
            fundamental={fundamental}
            loading={ohlcv[symbol]?.loading}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdvancedPanelWrapper({
  coin, candles, mode, fundamental, loading,
}: { coin: CoinAnalysis; candles: any; mode: TradingMode; fundamental: any; loading?: boolean }) {
  const result = useAdvancedAnalysis(candles, coin.coin.price, mode, {
    fundamental,
    priceChange24h: coin.coin.percent_change_24h,
    minConfirm: 2,
  });

  if (loading || !candles) {
    return <div className="py-12 text-center text-sm text-muted-foreground">캔들 데이터 로딩 중...</div>;
  }

  return <AdvancedAnalysisPanel result={result} symbol={coin.coin.symbol} />;
}
