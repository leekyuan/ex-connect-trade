import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ROUTES: Record<string, string> = {
  d: '/dashboard',
  m: '/market-screener',
  a: '/market-analysis',
  b: '/backtest',
  p: '/portfolio',
  n: '/alerts',
};

export function useGlobalShortcuts(onHelp: () => void) {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable;
      if (isEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?') {
        e.preventDefault();
        onHelp();
        return;
      }
      const k = e.key.toLowerCase();
      if (ROUTES[k]) {
        e.preventDefault();
        navigate(ROUTES[k]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, onHelp]);
}
