import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface DemoModeCtx {
  demo: boolean;
  setDemo: (v: boolean) => void;
  toggle: () => void;
}

const KEY = "cryptoedge-demo-mode";
const Ctx = createContext<DemoModeCtx | undefined>(undefined);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [demo, setDemoState] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v == null ? true : v === "1"; // default ON
    } catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, demo ? "1" : "0"); } catch {}
  }, [demo]);

  const setDemo = (v: boolean) => setDemoState(v);
  const toggle = () => setDemoState(v => !v);

  return <Ctx.Provider value={{ demo, setDemo, toggle }}>{children}</Ctx.Provider>;
}

export function useDemoMode() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDemoMode must be inside DemoModeProvider");
  return c;
}

export function isDemoMode(): boolean {
  try { return (localStorage.getItem(KEY) ?? "1") === "1"; } catch { return true; }
}
