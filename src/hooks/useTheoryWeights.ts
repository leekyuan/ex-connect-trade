import { useEffect, useState, useCallback } from 'react';

export const THEORY_KEYS = [
  'elliott',
  'dow',
  'wyckoff',
  'gann',
  'fibonacci',
  'ict',
  'fundamental',
] as const;
export type TheoryKey = typeof THEORY_KEYS[number];

export const THEORY_LABELS: Record<TheoryKey, string> = {
  elliott: '엘리어트 파동',
  dow: '다우 이론',
  wyckoff: '와이코프',
  gann: '갠 이론',
  fibonacci: '피보나치',
  ict: 'ICT (스마트머니)',
  fundamental: '기본적 분석',
};

export type TheoryWeights = Record<TheoryKey, number>;

const STORAGE_KEY = 'cryptoedge-theory-weights-v2';
const DEFAULT_WEIGHTS: TheoryWeights = {
  elliott: 1, dow: 1, wyckoff: 1, gann: 1, fibonacci: 1, ict: 1, fundamental: 1,
};

function load(): TheoryWeights {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WEIGHTS };
    const parsed = JSON.parse(raw);
    const out: TheoryWeights = { ...DEFAULT_WEIGHTS };
    for (const k of THEORY_KEYS) {
      const v = Number(parsed?.[k]);
      if (isFinite(v) && v >= 0 && v <= 5) out[k] = v;
    }
    return out;
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

export function useTheoryWeights() {
  const [weights, setWeights] = useState<TheoryWeights>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
    } catch { /* ignore */ }
  }, [weights]);

  const set = useCallback((k: TheoryKey, v: number) => {
    setWeights(p => ({ ...p, [k]: Math.max(0, Math.min(5, v)) }));
  }, []);
  const reset = useCallback(() => setWeights({ ...DEFAULT_WEIGHTS }), []);

  return { weights, set, reset };
}

export function getStoredWeights(): TheoryWeights {
  return load();
}
