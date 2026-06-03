import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress benign ResizeObserver loop warnings emitted by recharts/lightweight-charts
// in some browsers — these don't indicate real bugs.
const RO_MSG = 'ResizeObserver loop';
window.addEventListener('error', (e) => {
  if (e.message && e.message.includes(RO_MSG)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});
window.addEventListener('unhandledrejection', (e) => {
  if (typeof e.reason?.message === 'string' && e.reason.message.includes(RO_MSG)) {
    e.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
