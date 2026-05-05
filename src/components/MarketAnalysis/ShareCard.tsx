import { forwardRef } from "react";
import type { CoinAnalysis } from "@/hooks/useMarketAnalysis";

interface Props {
  analysis: CoinAnalysis;
}

const SIGNAL_COLORS = {
  LONG: { bg: "#10b981", label: "LONG" },
  SHORT: { bg: "#ef4444", label: "SHORT" },
  WATCH: { bg: "#6b7280", label: "관망" },
};

function fmt(n: number) {
  const d = n < 1 ? 6 : n < 100 ? 4 : 2;
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export const ShareCard = forwardRef<HTMLDivElement, Props>(({ analysis }, ref) => {
  const { coin, signal, confidence, longEntry, shortEntry, stopLoss, tp1, tp2, reasoning } =
    analysis;
  const sigColor = SIGNAL_COLORS[signal];
  const entry = signal === "LONG" ? longEntry : signal === "SHORT" ? shortEntry : longEntry ?? coin.price;
  const date = new Date().toLocaleDateString("ko-KR");

  return (
    <div
      ref={ref}
      id="share-card"
      style={{
        width: 400,
        background: "#0f172a",
        color: "#f1f5f9",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 24,
        borderRadius: 16,
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#3b82f6" }}>CryptoEdge AI</div>
        <div style={{ fontSize: 11, color: "#64748b" }}>{date}</div>
      </div>

      {/* Coin */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{coin.symbol}/USDT</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{coin.name}</div>
          </div>
          <div
            style={{
              background: sigColor.bg,
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              padding: "6px 12px",
              borderRadius: 8,
            }}
          >
            {sigColor.label} {confidence}%
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>${fmt(coin.price)}</div>
      </div>

      {/* Confidence bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>
          <span>신뢰도</span>
          <span>{confidence}%</span>
        </div>
        <div style={{ height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${confidence}%`, background: sigColor.bg }} />
        </div>
      </div>

      {/* Prices */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        <PriceBox label="진입가" value={entry} color="#3b82f6" />
        <PriceBox label="손절 (SL)" value={stopLoss} color="#ef4444" />
        <PriceBox label="TP1" value={tp1} color="#10b981" />
        <PriceBox label="TP2" value={tp2} color="#10b981" />
      </div>

      {/* Reasoning */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>분석 근거</div>
        {reasoning.slice(0, 3).map((r, i) => (
          <div key={i} style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 3, lineHeight: 1.5 }}>
            • {r}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid #1e293b",
          paddingTop: 12,
          fontSize: 10,
          color: "#475569",
          textAlign: "center",
        }}
      >
        CryptoEdge AI • cryptoedge.ai
      </div>
    </div>
  );
});

ShareCard.displayName = "ShareCard";

function PriceBox({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div style={{ background: "#1e293b", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "JetBrains Mono, monospace" }}>
        {value !== null && value !== undefined ? `$${fmt(value)}` : "—"}
      </div>
    </div>
  );
}
