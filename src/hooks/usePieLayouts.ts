import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ENV } from '../lib/env';

// ── Types ─────────────────────────────────────────────────────────────────────
// Matches react-grid-layout's Layout type exactly so we can pass directly to RGL.
export interface PieGridItem {
  i: string;   // card key ('p1', 'gs1', 'ca', …)
  x: number;   // grid column (0-based integer)
  y: number;   // grid row    (0-based integer)
  w: number;   // column span (integer ≥ 1)
  h: number;   // row span    (integer ≥ 1)
}

// ── Defaults ──────────────────────────────────────────────────────────────────
// 5-column default grid, 2 rows — GS-wise order: mains first, then prelims, optional, essay, CA.
export const DEFAULT_PIE_LAYOUT: PieGridItem[] = [
  { i: 'gs1', x: 0, y: 0, w: 1, h: 1 },
  { i: 'gs2', x: 1, y: 0, w: 1, h: 1 },
  { i: 'gs3', x: 2, y: 0, w: 1, h: 1 },
  { i: 'gs4', x: 3, y: 0, w: 1, h: 1 },
  { i: 'es',  x: 4, y: 0, w: 1, h: 1 },
  { i: 'a1',  x: 0, y: 1, w: 1, h: 1 },
  { i: 'a2',  x: 1, y: 1, w: 1, h: 1 },
  { i: 'p1',  x: 2, y: 1, w: 1, h: 1 },
  { i: 'p2',  x: 3, y: 1, w: 1, h: 1 },
  { i: 'ca',  x: 4, y: 1, w: 1, h: 1 },
];

const DB_TABLE = ENV.PIE_LAYOUT_DB_TABLE;
const LS_KEY   = ENV.PIE_LAYOUT_LS_KEY;

// ── Helpers ───────────────────────────────────────────────────────────────────
function mergeWithDefaults(stored: PieGridItem[], keys: string[]): PieGridItem[] {
  const map = new Map(stored.map(item => [item.i, item]));
  // Include any key from the full default layout that is also in keys,
  // plus any stored key not in the default layout (user-custom future cards).
  const merged = DEFAULT_PIE_LAYOUT
    .filter(d => keys.includes(d.i))
    .map(d => map.get(d.i) ?? d);
  // Add keys present in stored but not in DEFAULT_PIE_LAYOUT
  for (const item of stored) {
    if (!DEFAULT_PIE_LAYOUT.find(d => d.i === item.i) && keys.includes(item.i)) {
      merged.push(item);
    }
  }
  return merged;
}

function loadFromLS(keys: string[]): PieGridItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return mergeWithDefaults(JSON.parse(raw) as PieGridItem[], keys);
  } catch { /* ignore */ }
  return DEFAULT_PIE_LAYOUT.filter(d => keys.includes(d.i));
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function usePieLayouts(keys: string[]) {
  const { user } = useAuth();
  const [layout, setLayout] = useState<PieGridItem[]>(() => loadFromLS(keys));
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // DB debounce timer
  const dbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch from Supabase on sign-in ────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from(DB_TABLE)
      .select('card_key, x, y, w, h')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (cancelled || error || !data || data.length === 0) return;
        const fromDB = data.map(row => ({
          i: row.card_key as string,
          x: Math.round(row.x as number),
          y: Math.round(row.y as number),
          w: Math.max(1, Math.round(row.w as number)),
          h: Math.max(1, Math.round(row.h as number)),
        }));
        const merged = mergeWithDefaults(fromDB, keys);
        setLayout(merged);
        try { localStorage.setItem(LS_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
      });
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist (localStorage instant + Supabase debounced) ──────────────────
  const persist = useCallback((next: PieGridItem[]) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    if (!user?.id) return;
    const userId = user.id;
    if (dbTimerRef.current) clearTimeout(dbTimerRef.current);
    dbTimerRef.current = setTimeout(async () => {
      const rows = next.map(({ i, x, y, w, h }) => ({
        user_id: userId, card_key: i, x, y, w, h,
        updated_at: new Date().toISOString(),
      }));
      await supabase.from(DB_TABLE).upsert(rows, { onConflict: 'user_id,card_key' });
    }, 500);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Called by RGL's onLayoutChange ────────────────────────────────────────
  const onLayoutChange = useCallback((newLayout: PieGridItem[]) => {
    setLayout(newLayout);
    persist(newLayout);
  }, [persist]);

  // ── Reset to default ──────────────────────────────────────────────────────
  const reset = useCallback(() => {
    const def = DEFAULT_PIE_LAYOUT.filter(d => keys.includes(d.i));
    setLayout(def);
    persist(def);
  }, [keys, persist]); // eslint-disable-line react-hooks/exhaustive-deps

  return { layout, onLayoutChange, reset };
}

