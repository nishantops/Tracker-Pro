import { useCallback, useEffect, useRef, useState } from 'react';

export interface Geom { x: number; y: number; w: number; h: number }
export type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const MIN_W = 224;
export const MIN_H = 120;
export const WIDE_QUERY = '(min-width: 960px)';

const isWide = () => (typeof window.matchMedia === 'function' ? window.matchMedia(WIDE_QUERY).matches : true);

// The panel's positioning container: nearest positioned ancestor (the Home view), else the parent.
const boundsOf = (el: HTMLElement | null): HTMLElement | null =>
  (el?.offsetParent as HTMLElement | null) ?? el?.parentElement ?? null;

function read(key: string | null): Geom | null {
  if (!key) return null;
  try {
    const g = JSON.parse(localStorage.getItem(key) ?? 'null') as Geom | null;
    if (g && [g.x, g.y, g.w, g.h].every((n) => typeof n === 'number' && Number.isFinite(n))) return g;
  } catch { /* ignore */ }
  return null;
}

// Free move + free-ratio resize inside the parent element. null geometry = docked in the normal layout.
export function useFloatingPanel(storageKey: string | null, locked: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [geom, setGeom] = useState<Geom | null>(() => read(storageKey));
  const [wide, setWide] = useState(isWide);

  useEffect(() => { setGeom(read(storageKey)); }, [storageKey]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(WIDE_QUERY);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const persist = useCallback((g: Geom | null) => {
    if (!storageKey) return;
    try {
      if (g) localStorage.setItem(storageKey, JSON.stringify(g));
      else localStorage.removeItem(storageKey);
    } catch { /* ignore */ }
  }, [storageKey]);

  const startGesture = useCallback((e: React.PointerEvent, mode: Handle) => {
    if (locked || !wide || e.button > 0) return;
    const el = ref.current;
    const parent = boundsOf(el);
    if (!el || !parent) return;
    e.preventDefault();
    e.stopPropagation();

    const pr = parent.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const start: Geom = geom ?? { x: r.left - pr.left, y: r.top - pr.top, w: r.width, h: r.height };
    const sx = e.clientX;
    const sy = e.clientY;
    let cur = start;
    setGeom(start);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      let { x, y, w, h } = start;
      if (mode === 'move') {
        x = Math.min(Math.max(0, start.x + dx), Math.max(0, pr.width - w));
        y = Math.max(0, start.y + dy);
      } else {
        if (mode.includes('e')) w = Math.max(MIN_W, start.w + dx);
        if (mode.includes('s')) h = Math.max(MIN_H, start.h + dy);
        if (mode.includes('w')) { const nw = Math.max(MIN_W, start.w - dx); x = start.x + (start.w - nw); w = nw; }
        if (mode.includes('n')) { const nh = Math.max(MIN_H, start.h - dy); y = start.y + (start.h - nh); h = nh; }
        if (x < 0) { w += x; x = 0; }
        if (y < 0) { h += y; y = 0; }
        if (x + w > pr.width) w = Math.max(MIN_W, pr.width - x);
      }
      cur = { x, y, w, h };
      setGeom(cur);
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
  }, [geom, locked, wide, persist]);

  const dock = useCallback(() => { setGeom(null); persist(null); }, [persist]);

  const floating = !!geom && wide;

  // Keep the panel inside the page if the window is narrowed after it was placed.
  const [pw, setPw] = useState(0);
  useEffect(() => {
    const parent = boundsOf(ref.current);
    if (!floating || !parent || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setPw(parent.getBoundingClientRect().width));
    ro.observe(parent);
    return () => ro.disconnect();
  }, [floating]);

  const style: React.CSSProperties | undefined = floating && geom
    ? (() => {
        const w = pw > 0 ? Math.min(geom.w, pw) : geom.w;
        const x = pw > 0 ? Math.max(0, Math.min(geom.x, pw - w)) : geom.x;
        return { left: `${x}px`, top: `${geom.y}px`, width: `${w}px`, height: `${geom.h}px` };
      })()
    : undefined;

  return { ref, geom, floating, style, startGesture, dock, canDrag: !locked && wide };
}
