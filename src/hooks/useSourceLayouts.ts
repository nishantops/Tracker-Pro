/**
 * useSourceLayouts — persists drag/resize layout of source cards to Supabase.
 *
 * Mirrors usePlanLayouts but for upsc_source_layouts table.
 * Positions are stored in react-grid-layout grid units (screen-size agnostic).
 * Saves are debounced after the last layout change.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LayoutItem } from 'react-grid-layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ENV } from '../lib/env';

const COLS             = ENV.SOURCE_GRID_COLS;
const DEFAULT_W        = ENV.SOURCE_CARD_DEFAULT_W;
const DEFAULT_H        = ENV.SOURCE_CARD_DEFAULT_H;
const SAVE_DEBOUNCE_MS = ENV.SOURCE_LAYOUT_DEBOUNCE_MS;
const DB_TABLE         = ENV.SOURCE_LAYOUT_DB_TABLE;

function defaultItem(sourceId: string, idx: number): LayoutItem {
  const perRow = Math.floor(COLS / DEFAULT_W);
  return {
    i: sourceId,
    x: (idx % perRow) * DEFAULT_W,
    y: Math.floor(idx / perRow) * DEFAULT_H,
    w: DEFAULT_W,
    h: DEFAULT_H,
    minW: ENV.SOURCE_CARD_MIN_W,
    minH: ENV.SOURCE_CARD_MIN_H,
  };
}

export function useSourceLayouts(sourceIds: string[]) {
  const { user } = useAuth();
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedKey = useRef('');

  useEffect(() => {
    if (!user || sourceIds.length === 0) {
      setLayout([]);
      setLoaded(true);
      return;
    }
    const key = sourceIds.slice().sort().join(',');
    if (key === loadedKey.current) return;
    loadedKey.current = key;

    const load = async () => {
      const { data } = await supabase
        .from(DB_TABLE)
        .select('source_id, col, row_pos, col_span, row_span')
        .eq('user_id', user.id)
        .in('source_id', sourceIds);

      const savedMap = new Map(
        (data ?? []).map((r) => [
          r.source_id,
          { x: r.col, y: r.row_pos, w: r.col_span, h: r.row_span },
        ]),
      );

      const result: LayoutItem[] = sourceIds.map((id, idx) => {
        const saved = savedMap.get(id);
        return saved
          ? { i: id, ...saved, minW: ENV.SOURCE_CARD_MIN_W, minH: ENV.SOURCE_CARD_MIN_H }
          : defaultItem(id, idx);
      });

      setLayout(result);
      setLoaded(true);
    };

    load();
  }, [user, sourceIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveLayout = useCallback(
    (newLayout: LayoutItem[]) => {
      setLayout(newLayout);
      if (!user) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const rows = newLayout.map((item) => ({
          user_id:   user.id,
          source_id: item.i,
          col:       item.x,
          row_pos:   item.y,
          col_span:  item.w,
          row_span:  item.h,
          updated_at: new Date().toISOString(),
        }));
        await supabase
          .from(DB_TABLE)
          .upsert(rows, { onConflict: 'user_id,source_id' });
      }, SAVE_DEBOUNCE_MS);
    },
    [user],
  );

  const removeLayout = useCallback(
    async (sourceId: string) => {
      setLayout((prev) => prev.filter((l) => l.i !== sourceId));
      if (!user) return;
      await supabase
        .from(DB_TABLE)
        .delete()
        .eq('user_id', user.id)
        .eq('source_id', sourceId);
    },
    [user],
  );

  const resetLayout = useCallback(
    async () => {
      const fresh = sourceIds.map((id, idx) => defaultItem(id, idx));
      setLayout(fresh);
      if (!user) return;
      await supabase.from(DB_TABLE).delete().eq('user_id', user.id);
      const rows = fresh.map((item) => ({
        user_id:   user.id,
        source_id: item.i,
        col:       item.x,
        row_pos:   item.y,
        col_span:  item.w,
        row_span:  item.h,
        updated_at: new Date().toISOString(),
      }));
      await supabase.from(DB_TABLE).upsert(rows, { onConflict: 'user_id,source_id' });
    },
    [user, sourceIds],
  );

  return { layout, saveLayout, removeLayout, resetLayout, loaded };
}
