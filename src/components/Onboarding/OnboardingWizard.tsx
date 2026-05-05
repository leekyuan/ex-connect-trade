import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Check, Sparkles, BarChart3, Coins, Key, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useProfile, type UserPreferences } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Experience = "beginner" | "intermediate" | "advanced";
type Style = "scalping" | "daytrading" | "swing";

const COIN_OPTIONS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE", "LINK", "DOT"];

export function OnboardingWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { completeOnboarding } = useProfile();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [style, setStyle] = useState<Style | null>(null);
  const [coins, setCoins] = useState<string[]>([]);
  const [exchange, setExchange] = useState("binance");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const toggleCoin = (coin: string) => {
    setCoins((prev) => {
      if (prev.includes(coin)) return prev.filter((c) => c !== coin);
      if (prev.length >= 10) return prev;
      return [...prev, coin];
    });
  };

  const canProceed = () => {
    if (step === 2) return experience !== null;
    if (step === 3) return style !== null;
    if (step === 4) return coins.length > 0;
    return true;
  };

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
    if (!experience || !style || coins.length === 0) {
      toast({ title: "필수 항목 누락", description: "모든 단계를 완료해주세요.", variant: "destructive" });
      return;
    }
    setSubmitting(true);

    const prefs: UserPreferences = { experience, style, coins };

    // Optional API key save
    if (apiKey && apiSecret && user) {
      try {
        await supabase.from("exchange_api_keys").insert({
          user_id: user.id,
          exchange,
          api_key: apiKey,
          api_secret: apiSecret,
        });
      } catch (e) {
        console.error("API key save failed", e);
      }
    }

    const { error } = await completeOnboarding(prefs);
    setSubmitting(false);

    if (error) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "환영합니다! 🎉", description: "온보딩이 완료되었습니다." });
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card rounded-2xl border border-border shadow-xl overflow-hidden">
        {/* Progress */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">단계 {step} / {totalSteps}</span>
            <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <div className="p-6 min-h-[400px] flex flex-col">
          {step === 1 && (
            <div className="flex-1 flex flex-col justify-center text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">CryptoEdge AI에 오신 것을 환영합니다</h1>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                6대 트레이딩 이론 기반 분석 엔진과 실시간 시그널로 더 똑똑한 거래를 시작하세요.
                몇 가지 질문에 답해주시면 맞춤 환경을 구성해드립니다.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="flex-1 space-y-4">
              <div className="text-center space-y-1">
                <BarChart3 className="h-8 w-8 mx-auto text-primary" />
                <h2 className="text-xl font-bold text-foreground">거래 경험을 알려주세요</h2>
                <p className="text-sm text-muted-foreground">맞춤 가이드를 제공해드립니다</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                {(["beginner", "intermediate", "advanced"] as Experience[]).map((exp) => {
                  const labels = {
                    beginner: { title: "입문", desc: "이제 막 시작했어요" },
                    intermediate: { title: "중급", desc: "1년 이상 경험" },
                    advanced: { title: "고급", desc: "전문 트레이더" },
                  };
                  return (
                    <button
                      key={exp}
                      onClick={() => setExperience(exp)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        experience === exp
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-foreground">{labels[exp].title}</span>
                        {experience === exp && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <span className="text-xs text-muted-foreground">{labels[exp].desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex-1 space-y-4">
              <div className="text-center space-y-1">
                <Rocket className="h-8 w-8 mx-auto text-primary" />
                <h2 className="text-xl font-bold text-foreground">선호하는 트레이딩 스타일은?</h2>
                <p className="text-sm text-muted-foreground">신호 분석 모드의 기본값으로 사용됩니다</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                {(["scalping", "daytrading", "swing"] as Style[]).map((s) => {
                  const labels = {
                    scalping: { title: "스캘핑", desc: "5m~15m, 빠른 매매" },
                    daytrading: { title: "단타", desc: "1H~4H, 일중 거래" },
                    swing: { title: "스윙", desc: "1D~1W, 추세 추종" },
                  };
                  return (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        style === s
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-foreground">{labels[s].title}</span>
                        {style === s && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <span className="text-xs text-muted-foreground">{labels[s].desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex-1 space-y-4">
              <div className="text-center space-y-1">
                <Coins className="h-8 w-8 mx-auto text-primary" />
                <h2 className="text-xl font-bold text-foreground">관심 코인을 선택하세요</h2>
                <p className="text-sm text-muted-foreground">
                  최대 10개 ({coins.length}/10)
                </p>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-6">
                {COIN_OPTIONS.map((coin) => {
                  const selected = coins.includes(coin);
                  return (
                    <button
                      key={coin}
                      onClick={() => toggleCoin(coin)}
                      className={`py-3 rounded-lg border-2 font-bold text-sm transition-all ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-primary/50"
                      }`}
                    >
                      {coin}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="flex-1 space-y-4">
              <div className="text-center space-y-1">
                <Key className="h-8 w-8 mx-auto text-primary" />
                <h2 className="text-xl font-bold text-foreground">API 키 연결 (선택)</h2>
                <p className="text-sm text-muted-foreground">
                  자동매매를 사용하려면 거래소 API 키가 필요합니다. 나중에 추가할 수도 있어요.
                </p>
              </div>
              <div className="space-y-3 mt-6">
                <div>
                  <Label htmlFor="exchange">거래소</Label>
                  <select
                    id="exchange"
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-input text-foreground text-sm"
                  >
                    <option value="binance">Binance</option>
                    <option value="bybit">Bybit</option>
                    <option value="okx">OKX</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="api-key">API Key (선택)</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="선택사항 — 비워두셔도 됩니다"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="api-secret">API Secret (선택)</Label>
                  <Input
                    id="api-secret"
                    type="password"
                    placeholder="선택사항"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <Button variant="ghost" onClick={handleBack} disabled={step === 1 || submitting}>
              이전
            </Button>
            {step < totalSteps ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                다음
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={submitting}>
                {submitting ? "저장 중..." : "완료하고 시작하기"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
