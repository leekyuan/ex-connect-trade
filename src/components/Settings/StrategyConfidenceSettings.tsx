import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCoinMarketCap } from "@/hooks/useCoinMarketCap";
import { useMarketAnalysis } from "@/hooks/useMarketAnalysis";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "cryptoedge-strategy-confidence";

interface Levels {
  scalping: number;
  daytrading: number;
  swing: number;
}

const DEFAULTS: Levels = { scalping: 65, daytrading: 65, swing: 65 };

export function StrategyConfidenceSettings() {
  const { user } = useAuth();
  const [levels, setLevels] = useState<Levels>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const { coins } = useCoinMarketCap();
  const scalp = useMarketAnalysis(coins, "scalping");
  const day = useMarketAnalysis(coins, "daytrading");
  const swing = useMarketAnalysis(coins, "swing");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLevels({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const counts = {
    scalping: scalp.filter((a) => a.signal !== "WATCH" && a.confidence >= levels.scalping).length,
    daytrading: day.filter((a) => a.signal !== "WATCH" && a.confidence >= levels.daytrading).length,
    swing: swing.filter((a) => a.signal !== "WATCH" && a.confidence >= levels.swing).length,
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
      toast.success("최소 신뢰도가 저장되었습니다");
    } catch {
      toast.error("저장에 실패했습니다");
    }
    setSaving(false);
  };

  const ROWS: { key: keyof Levels; label: string; color: string }[] = [
    { key: "scalping", label: "스캘핑", color: "text-purple-400" },
    { key: "daytrading", label: "단타", color: "text-blue-400" },
    { key: "swing", label: "스윙", color: "text-amber-400" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>전략별 최소 신뢰도</CardTitle>
        <CardDescription>모드별로 알림을 받을 최소 신호 신뢰도를 다르게 설정합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {ROWS.map((row) => (
          <div key={row.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className={row.color}>{row.label}</Label>
              <div className="text-right">
                <span className="text-sm font-bold text-primary">{levels[row.key]}%</span>
                <span className="ml-2 text-[11px] text-muted-foreground">
                  현재 매칭: {counts[row.key]}개
                </span>
              </div>
            </div>
            <Slider
              min={50}
              max={95}
              step={1}
              value={[levels[row.key]]}
              onValueChange={(v) => setLevels((p) => ({ ...p, [row.key]: v[0] }))}
            />
          </div>
        ))}
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          저장
        </Button>
      </CardContent>
    </Card>
  );
}
