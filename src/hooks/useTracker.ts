import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface ProgressRow {
  id: string;
  is_checked: boolean;
  topic_note: string;
}

type ProgressMap = Map<string, ProgressRow>;

export function useTracker() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<ProgressMap>(new Map());
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'offline'>('synced');
  const [loading, setLoading] = useState(true);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Load all progress from DB ──────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('upsc_tracker_progress')
          .select('id, is_checked, topic_note')
          .eq('user_id', user.id);

        if (error) throw error;

        const map: ProgressMap = new Map();
        (data ?? []).forEach((row) => {
          // Only load syllabus topics (uid-*), not plan or pyq/ts items
          if (row.id.startsWith('uid-') || row.id.startsWith('custom_')) {
            map.set(row.id, {
              id: row.id,
              is_checked: row.is_checked ?? false,
              topic_note: row.topic_note ?? '',
            });
          }
        });
        setProgress(map);
        setSyncStatus('synced');
      } catch {
        setSyncStatus('offline');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  // ── Upsert a single row ────────────────────────────────────────────────
  const pushToCloud = useCallback(
    async (id: string, is_checked: boolean, topic_note: string) => {
      if (!user) return;
      try {
        setSyncStatus('saving');
        const { error } = await supabase.from('upsc_tracker_progress').upsert(
          {
            id,
            user_id: user.id,
            is_checked,
            topic_note,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id,user_id' },
        );
        if (error) throw error;
        setSyncStatus('synced');
      } catch {
        setSyncStatus('offline');
      }
    },
    [user],
  );

  // ── Toggle checkbox ────────────────────────────────────────────────────
  const toggleCheck = useCallback(
    (id: string) => {
      setProgress((prev) => {
        const next = new Map(prev);
        const existing = next.get(id);
        const newChecked = !(existing?.is_checked ?? false);
        const note = existing?.topic_note ?? '';
        next.set(id, { id, is_checked: newChecked, topic_note: note });
        pushToCloud(id, newChecked, note);
        return next;
      });
    },
    [pushToCloud],
  );

  // ── Update note (debounced) ────────────────────────────────────────────
  const updateNote = useCallback(
    (id: string, note: string) => {
      setProgress((prev) => {
        const next = new Map(prev);
        const existing = next.get(id);
        next.set(id, { id, is_checked: existing?.is_checked ?? false, topic_note: note });
        return next;
      });

      setSyncStatus('saving');
      if (timers.current[id]) clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(() => {
        const row = progress.get(id);
        pushToCloud(id, row?.is_checked ?? false, note);
        delete timers.current[id];
      }, 1500);
    },
    [pushToCloud, progress],
  );

  // ── Calculate metrics ──────────────────────────────────────────────────
  const getMetrics = useCallback(
    (prefix: string) => {
      let total = 0;
      let checked = 0;
      progress.forEach((row) => {
        if (row.id.includes(`-${prefix}-`)) {
          total++;
          if (row.is_checked) checked++;
        }
      });
      return { total, checked, pct: total > 0 ? Math.round((checked / total) * 100) : 0 };
    },
    [progress],
  );

  const getGlobalMetrics = useCallback(() => {
    let total = 0;
    let checked = 0;
    progress.forEach((row) => {
      if (row.id.startsWith('uid-') && !row.id.startsWith('uid-pq') && !row.id.startsWith('uid-qg') &&
          !row.id.startsWith('uid-qa') && !row.id.startsWith('uid-tp') && !row.id.startsWith('uid-tg') &&
          !row.id.startsWith('uid-te') && !row.id.startsWith('uid-ta')) {
        total++;
        if (row.is_checked) checked++;
      }
    });
    return { total, checked, pct: total > 0 ? parseFloat(((checked / total) * 100).toFixed(1)) : 0 };
  }, [progress]);

  return { progress, loading, syncStatus, toggleCheck, updateNote, getMetrics, getGlobalMetrics };
}
