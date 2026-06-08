/**
 * Seeds localStorage with realistic demo data so reviewers see a populated app
 * without any real exchange/API connection.
 */
const SEED_KEY = "cryptoedge-demo-seeded-v1";

const COINS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "LINK", "AVAX", "MATIC"];
const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export interface DemoTrade {
  id: string; symbol: string; side: "BUY" | "SELL"; entry: number; exit: number;
  qty: number; pnl: number; pnlPct: number; openedAt: number; closedAt: number;
}

export interface DemoAlert {
  id: string; symbol: string; condition: "above" | "below"; target: number; createdAt: number;
}

export interface DemoRule { id: string; text: string; category: string; active: boolean; }
export interface DemoJournal {
  id: string; symbol: string; side: "long" | "short"; review: string;
  emotion: number; pnlPct: number; createdAt: number;
}

function mkTrades(n: number): DemoTrade[] {
  const out: DemoTrade[] = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const sym = pick(COINS);
    const side: "BUY" | "SELL" = Math.random() > 0.5 ? "BUY" : "SELL";
    const entry = +rand(20, 70000).toFixed(2);
    const dir = side === "BUY" ? 1 : -1;
    const pnlPct = +rand(-3, 5).toFixed(2);
    const exit = +(entry * (1 + (pnlPct / 100) * dir)).toFixed(2);
    const qty = +rand(0.01, 1).toFixed(3);
    const pnl = +((exit - entry) * qty * dir).toFixed(2);
    const openedAt = now - (n - i) * 86_400_000 + rand(0, 80_000_000);
    out.push({
      id: `demo-${i}-${sym}`, symbol: sym, side, entry, exit, qty, pnl, pnlPct,
      openedAt, closedAt: openedAt + rand(60_000, 6 * 3600_000),
    });
  }
  return out;
}

const DEMO_RULES: DemoRule[] = [
  { id: "r1", text: "1회 거래당 최대 손실 1.5% 이내", category: "리스크", active: true },
  { id: "r2", text: "동시 보유 포지션 3개 초과 금지", category: "리스크", active: true },
  { id: "r3", text: "EMA200 위에서만 롱, 아래에서만 숏", category: "진입", active: true },
  { id: "r4", text: "RSI 75 초과 시 추격 매수 금지", category: "진입", active: true },
  { id: "r5", text: "주요 경제지표 발표 ±30분 거래 중단", category: "타이밍", active: true },
  { id: "r6", text: "TP1 도달 시 50% 익절 + SL 본절", category: "익절", active: true },
  { id: "r7", text: "일일 손실 3% 도달 시 즉시 중단", category: "리스크", active: true },
  { id: "r8", text: "감정적 매매(복수/홧김) 절대 금지", category: "심리", active: true },
];

function mkAlerts(n: number): DemoAlert[] {
  return Array.from({ length: n }, (_, i) => {
    const sym = pick(COINS);
    return {
      id: `a-${i}`,
      symbol: sym,
      condition: Math.random() > 0.5 ? "above" : "below",
      target: +rand(20, 70000).toFixed(2),
      createdAt: Date.now() - i * 3600_000,
    };
  });
}

function mkJournal(n: number): DemoJournal[] {
  const reviews = [
    "계획대로 진입했으나 너무 빨리 익절함. 다음엔 TP2까지 보유.",
    "FOMO 매수. 다음에 동일 셋업이면 진입 안 한다.",
    "원칙대로 손절. 잘 지킴.",
    "뉴스에 흔들려서 SL 옮긴 게 패착.",
    "EMA200 + 와이코프 스프링 완벽 셋업.",
  ];
  return Array.from({ length: n }, (_, i) => ({
    id: `j-${i}`, symbol: pick(COINS),
    side: Math.random() > 0.5 ? "long" : "short",
    review: pick(reviews), emotion: Math.ceil(rand(3, 9)),
    pnlPct: +rand(-2, 4).toFixed(2),
    createdAt: Date.now() - i * 86_400_000,
  }));
}

export function seedDemoData(force = false) {
  try {
    if (!force && localStorage.getItem(SEED_KEY)) return false;
    localStorage.setItem("demo-trades", JSON.stringify(mkTrades(50)));
    localStorage.setItem("demo-alerts", JSON.stringify(mkAlerts(5)));
    localStorage.setItem("demo-rules", JSON.stringify(DEMO_RULES));
    localStorage.setItem("demo-journal", JSON.stringify(mkJournal(10)));
    localStorage.setItem(SEED_KEY, String(Date.now()));
    return true;
  } catch { return false; }
}

export function clearDemoData() {
  try {
    ["demo-trades", "demo-alerts", "demo-rules", "demo-journal", SEED_KEY].forEach(k => localStorage.removeItem(k));
    return true;
  } catch { return false; }
}

export function getDemoTrades(): DemoTrade[] {
  try { return JSON.parse(localStorage.getItem("demo-trades") ?? "[]"); } catch { return []; }
}
export function getDemoAlerts(): DemoAlert[] {
  try { return JSON.parse(localStorage.getItem("demo-alerts") ?? "[]"); } catch { return []; }
}
export function getDemoRules(): DemoRule[] {
  try { return JSON.parse(localStorage.getItem("demo-rules") ?? "[]"); } catch { return []; }
}
export function getDemoJournal(): DemoJournal[] {
  try { return JSON.parse(localStorage.getItem("demo-journal") ?? "[]"); } catch { return []; }
}
