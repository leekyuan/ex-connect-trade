import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";
import { useTheme } from "@/hooks/useTheme";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import MarketAnalysisPage from "./pages/MarketAnalysisPage.tsx";
import MarketScreenerPage from "./pages/MarketScreenerPage.tsx";
import LandingPage from "./pages/LandingPage.tsx";
import PricingPage from "./pages/PricingPage.tsx";
import BacktestPage from "./pages/BacktestPage.tsx";
import PortfolioPage from "./pages/PortfolioPage.tsx";
import AlertsPage from "./pages/AlertsPage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import AccuracyPage from "./pages/AccuracyPage.tsx";
import RulesPage from "./pages/RulesPage.tsx";
import JournalPage from "./pages/JournalPage.tsx";
import PositionCalculatorPage from "./pages/PositionCalculatorPage.tsx";
import CorrelationPage from "./pages/CorrelationPage.tsx";
import ReviewerHubPage from "./pages/ReviewerHubPage.tsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.tsx";
import DisclaimerPage from "./pages/DisclaimerPage.tsx";
import ApiPermissionsPage from "./pages/ApiPermissionsPage.tsx";
import RiskLimitsPage from "./pages/RiskLimitsPage.tsx";

const queryClient = new QueryClient();

function ThemeBootstrap() {
  useTheme();
  return null;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DemoModeProvider>
          <ThemeBootstrap />
          <Toaster />
          <Sonner />
          <NetworkStatusBanner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/reviewer" element={<ReviewerHubPage />} />
                <Route path="/dashboard" element={<Index />} />
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/market-analysis" element={<MarketAnalysisPage />} />
                <Route path="/market-screener" element={<MarketScreenerPage />} />
                <Route path="/backtest" element={<BacktestPage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/accuracy" element={<AccuracyPage />} />
                <Route path="/rules" element={<RulesPage />} />
                <Route path="/journal" element={<JournalPage />} />
                <Route path="/calculator" element={<PositionCalculatorPage />} />
                <Route path="/correlation" element={<CorrelationPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/disclaimer" element={<DisclaimerPage />} />
                <Route path="/api-permissions" element={<ApiPermissionsPage />} />
                <Route path="/risk-limits" element={<RiskLimitsPage />} />
                {/* Legacy redirects */}
                <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
                <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />
                <Route path="/login" element={<Navigate to="/dashboard" replace />} />
                <Route path="/signup" element={<Navigate to="/dashboard" replace />} />
                <Route path="/trade" element={<Navigate to="/dashboard" replace />} />
                <Route path="/auto-trade" element={<Navigate to="/dashboard" replace />} />
                <Route path="/history" element={<Navigate to="/portfolio" replace />} />
                <Route path="/api-keys" element={<Navigate to="/settings" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </DemoModeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
