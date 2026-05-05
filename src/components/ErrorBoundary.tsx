import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  async componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
    try {
      const { data } = await supabase.auth.getUser();
      await supabase.from("error_logs").insert({
        user_id: data?.user?.id ?? null,
        message: error.message,
        stack: error.stack ?? info.componentStack ?? null,
        url: window.location.href,
        user_agent: navigator.userAgent,
      });
    } catch (e) {
      console.error("[ErrorBoundary] failed to log", e);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-card rounded-2xl border border-border p-6 text-center space-y-4 shadow-lg">
            <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">문제가 발생했습니다</h2>
              <p className="text-xs text-muted-foreground break-words">
                {this.state.error?.message ?? "알 수 없는 오류"}
              </p>
            </div>
            <Button onClick={this.handleReload} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              새로고침
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
