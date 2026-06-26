/**
 * usePlanLayouts — persists drag/resize layout of plan cards to Supabase.
 *
 * Positions are stored in react-grid-layout grid units (col 0-11, row 0+,
 * colSpan 1-12, rowSpan 1+) which are screen-size agnostic: the grid
 * scales proportionally to the container width on every device.
 *
 * Saves are debounced 600ms after the last layout change to avoid hammering
 * the DB during continuous drag/resize interactions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LayoutItem } from 'react-grid-layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ENV } from '../lib/env';

const COLS             = ENV.PLAN_GRID_COLS;
const DEFAULT_W        = ENV.PLAN_CARD_DEFAULT_W;
const DEFAULT_H        = ENV.PLAN_CARD_DEFAULT_H;
const SAVE_DEBOUNCE_MS = ENV.PLAN_LAYOUT_DEBOUNCE_MS;
const DB_TABLE         = ENV.PLAN_LAYOUT_DB_TABLE;

/** Generate a default grid position for a plan by its index. */
function defaultItem(planId: string, idx: number): LayoutItem {
  const perRow = COLS / DEFAULT_W; // 3
  return {
    i: planId,
    x: (idx % perRow) * DEFAULT_W,
    y: Math.floor(idx / perRow) * DEFAULT_H,
    w: DEFAULT_W,
    h: DEFAULT_H,
    minW: ENV.PLAN_CARD_MIN_W,
    minH: ENV.PLAN_CARD_MIN_H,
  };
}

export function usePlanLayouts(planIds: string[]) {
  const { user } = useAuth();
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track which plan IDs we've loaded for (to re-load when plans change)
  const loadedKey = useRef('');

  useEffect(() => {
    if (!user || planIds.length === 0) {
      setLayout([]);
      setLoaded(true);
      return;
    }
    const key = planIds.slice().sort().join(',');
    if (key === loadedKey.current) return;
    loadedKey.current = key;

    const load = async () => {
      const { data } = await supabase
        .from(DB_TABLE)
        .select('plan_id, col, row_pos, col_span, row_span')
        .eq('user_id', user.id)
        .in('plan_id', planIds);

      const savedMap = new Map(
        (data ?? []).map((r) => [
          r.plan_id,
          { x: r.col, y: r.row_pos, w: r.col_span, h: r.row_span },
        ]),
      );

      const result: LayoutItem[] = planIds.map((id, idx) => {
        const saved = savedMap.get(id);
        return saved
          ? { i: id, ...saved, minW: ENV.PLAN_CARD_MIN_W, minH: ENV.PLAN_CARD_MIN_H }
          : defaultItem(id, idx);
      });

      setLayout(result);
      setLoaded(true);
    };

    load();
  }, [user, planIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Called by ReactGridLayout on every drag/resize change. */
  const saveLayout = useCallback(
    (newLayout: LayoutItem[]) => {
      setLayout(newLayout);
      if (!user) return;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const rows = newLayout.map((item) => ({
          user_id: user.id,
          plan_id: item.i,
          col: item.x,
          row_pos: item.y,
          col_span: item.w,
          row_span: item.h,
          updated_at: new Date().toISOString(),
        }));
        await supabase
          .from(DB_TABLE)
          .upsert(rows, { onConflict: 'user_id,plan_id' });
      }, SAVE_DEBOUNCE_MS);
    },
    [user],
  );

  /** Remove layout entry for a deleted plan. */
  const removeLayout = useCallback(
    async (planId: string) => {
      setLayout((prev: LayoutItem[]) => prev.filter((l: LayoutItem) => l.i !== planId));
      if (!user) return;
      await supabase
        .from(DB_TABLE)
        .delete()
        .eq('user_id', user.id)
        .eq('plan_id', planId);
    },
    [user],
  );

  return { layout, saveLayout, removeLayout, loaded };
}
