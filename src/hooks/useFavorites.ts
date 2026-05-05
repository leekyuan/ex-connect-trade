import { useEffect, useState, useCallback } from 'react';

const KEY = 'cryptoedge-favorites';

export function useFavorites() {
  const [favs, setFavs] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify([...favs])); } catch {}
  }, [favs]);

  const toggle = useCallback((sym: string) => {
    setFavs(prev => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym); else next.add(sym);
      return next;
    });
  }, []);

  const has = useCallback((sym: string) => favs.has(sym), [favs]);

  return { favs, toggle, has };
}
