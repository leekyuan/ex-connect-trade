import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileTabBar } from "./MobileTabBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FearGreedBadge } from "@/components/common/FearGreedBadge";
import { CommandPalette, useCommandPalette } from "@/components/global/CommandPalette";
import { KeyboardShortcutsModal } from "@/components/global/KeyboardShortcutsModal";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { Button } from "@/components/ui/button";
import { Search, Keyboard } from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_KEY = "cryptoedge-sidebar-open";

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const palette = useCommandPalette();
  const [helpOpen, setHelpOpen] = useState(false);
  useGlobalShortcuts(() => setHelpOpen(true));

  // 사이드바 collapse 상태 localStorage 저장
  const initialOpen = (() => {
    try { const v = localStorage.getItem(SIDEBAR_KEY); return v == null ? true : v === "1"; } catch { return true; }
  })();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(initialOpen);
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? "1" : "0"); } catch {}
  }, [sidebarOpen]);

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <div className="min-h-screen flex w-full">
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border px-4 shrink-0">
            <div className="hidden md:block">
              <SidebarTrigger className="shrink-0" />
            </div>
            <div className="flex-1 min-w-0 flex items-center">
              <h2 className="text-sm font-bold text-foreground truncate">
                CryptoEdge AI · 통합 매매 신호
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex h-8 text-xs gap-2 text-muted-foreground"
              onClick={() => palette.setOpen(true)}
            >
              <Search className="h-3.5 w-3.5" /> 검색
              <kbd className="font-mono text-[10px] border border-border rounded px-1 py-0">⌘K</kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hidden md:inline-flex"
              onClick={() => setHelpOpen(true)}
              title="키보드 단축키 (?)"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
            <FearGreedBadge />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-4 pb-20 md:pb-4">
            {children}
          </main>
        </div>

        <MobileTabBar />

        <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
        <KeyboardShortcutsModal open={helpOpen} onOpenChange={setHelpOpen} />
      </div>
    </SidebarProvider>
  );
}
