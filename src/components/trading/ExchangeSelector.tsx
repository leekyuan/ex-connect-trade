import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Exchange } from "@/types/trading";

interface ExchangeSelectorProps {
  value: Exchange;
  onChange: (value: Exchange) => void;
}

const exchanges: { value: Exchange; label: string }[] = [
  { value: "binance", label: "Binance" },
  { value: "bybit", label: "Bybit" },
  { value: "okx", label: "OKX" },
];

export function ExchangeSelector({ value, onChange }: ExchangeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">거래소 선택</label>
      <Select value={value} onValueChange={(v) => onChange(v as Exchange)}>
        <SelectTrigger className="bg-input border-border">
          <SelectValue placeholder="거래소를 선택하세요" />
        </SelectTrigger>
        <SelectContent>
          {exchanges.map((ex) => (
            <SelectItem key={ex.value} value={ex.value}>
              {ex.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
