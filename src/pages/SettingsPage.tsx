import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TelegramSettings } from "@/components/Settings/TelegramSettings";
import { BinanceApiSettings } from "@/components/Settings/BinanceApiSettings";
import ExchangeSettings from "@/components/settings/ExchangeSettings";
import { StrategyConfidenceSettings } from "@/components/Settings/StrategyConfidenceSettings";
import { TheoryWeightsSettings } from "@/components/Settings/TheoryWeightsSettings";
import { PushNotificationSettings } from "@/components/Settings/PushNotificationSettings";

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6 p-4">
        <div>
          <h1 className="text-2xl font-bold">설정</h1>
          <p className="text-sm text-muted-foreground">
            알림, 거래소 연동, 전략 환경설정을 관리하세요.
          </p>
        </div>
        <ExchangeSettings />
        <BinanceApiSettings />
        <TheoryWeightsSettings />
        <PushNotificationSettings />
        <TelegramSettings />
        <StrategyConfidenceSettings />
      </div>
    </DashboardLayout>
  );
}

