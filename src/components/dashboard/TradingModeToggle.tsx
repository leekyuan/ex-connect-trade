import { Switch } from "@/components/ui/switch";
import { Bot, User } from "lucide-react";

interface TradingModeToggleProps {
  isAutoMode: boolean;
  onToggle: (auto: boolean) => void;
}

export function TradingModeToggle({ isAutoMode, onToggle }: TradingModeToggleProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isAutoMode ? (
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isAutoMode ? "AI 자동매매" : "수동 매매"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isAutoMode
                ? "RSI 전략 기반 자동 매수/매도"
                : "직접 주문을 입력하여 매매"}
            </p>
          </div>
        </div>
        <Switch checked={isAutoMode} onCheckedChange={onToggle} />
      </div>

      {isAutoMode && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">전략</span>
            <span className="text-foreground font-mono">RSI Reversal</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">매수 조건</span>
            <span className="text-success font-mono">RSI &lt; 30</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">매도 조건</span>
            <span className="text-destructive font-mono">RSI &gt; 70</span>
          </div>
        </div>
      )}
    </div>
  );
}
