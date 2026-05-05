import { Wifi, WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function NetworkStatusBanner() {
  const { isOnline, justRecovered } = useNetworkStatus();

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2 shadow-md">
        <WifiOff className="h-4 w-4" />
        인터넷 연결이 끊겼습니다
      </div>
    );
  }

  if (justRecovered) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] bg-success text-success-foreground py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2 shadow-md animate-in slide-in-from-top">
        <Wifi className="h-4 w-4" />
        연결이 복구됐습니다
      </div>
    );
  }

  return null;
}
