import { useCallback, useEffect, useRef, useState } from 'react';

export interface BoxSize { w: number | null; h: number | null }
export type BoxDir = 'e' | 's' | 'se';

export const BOX_MIN_W = 360;
export const BOX_MIN_H = 220;

function read(key: string | null): BoxSize {
  if (!key) return { w: null, h: null };
  try {
    const s = JSON.parse(localStorage.getItem(key) ?? 'null') as BoxSize | null;
    const ok = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : null);
    if (s) return { w: ok(s.w), h: ok(s.h) };
  } catch { /* ignore */ }
  return { w: null, h: null };
}

// Free-ratio width/height resize for an in-flow box anchored at its top-left corner.
export function useBoxResize(storageKey: string | null, locked: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<BoxSize>(() => read(storageKey));

  useEffect(() => { setSize(read(storageKey)); }, [storageKey]);

  const persist = useCallback((s: BoxSize) => {
    if (!storageKey) return;
    try {
      if (s.w == null && s.h == null) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(s));
    } catch { /* ignore */ }
  }, [storageKey]);

  const startResize = useCallback((e: React.PointerEvent, dir: BoxDir) => {
    if (locked || e.button > 0) return;
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    e.preventDefault();
    e.stopPropagation();

    const r = el.getBoundingClientRect();
    const pw = parent.getBoundingClientRect().width;
    const maxW = pw > 0 ? pw : Infinity;
    const sx = e.clientX;
    const sy = e.clientY;
    let cur: BoxSize = { w: size.w ?? r.width, h: size.h ?? r.height };
    setSize(cur);

    const onMove = (ev: PointerEvent) => {
      const next: BoxSize = { ...cur };
      if (dir.includes('e')) next.w = Math.min(maxW, Math.max(BOX_MIN_W, r.width + (ev.clientX - sx)));
      if (dir.includes('s')) next.h = Math.max(BOX_MIN_H, r.height + (ev.clientY - sy));
      cur = next;
      setSize(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      persist(cur);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [locked, size, persist]);

  const clear = useCallback(() => { setSize({ w: null, h: null }); persist({ w: null, h: null }); }, [persist]);

  return { ref, size, startResize, clear };
}
