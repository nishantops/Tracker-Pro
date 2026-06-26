import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ENV } from '../lib/env';
import { STAGES, CA_SECTION } from '../data/syllabus';

export interface ProgressRow {
  id: string;
  is_checked: boolean;
  topic_note: string;
}

type ProgressMap = Map<string, ProgressRow>;

// ── Module-level SWR cache (survives tab switches, cleared on sign-out) ──────────────
const TRACKER_CACHE_TTL = ENV.TRACKER_CACHE_TTL_MS;
const _trackerCache = new Map<string, { data: ProgressMap; ts: number }>();

export function clearTrackerCache(userId?: string) {
  if (userId) _trackerCache.delete(userId);
  else _trackerCache.clear();
}

export function useTracker() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<ProgressMap>(new Map());
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'offline'>('synced');
  const [loading, setLoading] = useState(true);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Load all progress from DB ──────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const fetchFromDB = async (): Promise<ProgressMap | null> => {
      try {
        const { data, error } = await supabase
          .from('upsc_tracker_progress')
          .select('id, is_checked, topic_note')
          .eq('user_id', user.id)
          .limit(5000);
        if (error) throw error;
        const map: ProgressMap = new Map();
        (data ?? []).forEach((row) => {
          if (row.id.startsWith('uid-') || row.id.startsWith('custom_')) {
            map.set(row.id, { id: row.id, is_checked: row.is_checked ?? false, topic_note: row.topic_note ?? '' });
          }
        });
        _trackerCache.set(user.id, { data: map, ts: Date.now() });
        return map;
      } catch {
        return null;
      }
    };

    const load = async () => {
      const cached = _trackerCache.get(user.id);
      if (cached) {
        // Serve from cache immediately (no loading spinner)
        setProgress(cached.data);
        setLoading(false);
        setSyncStatus('synced');
        // Revalidate silently if stale
        if (Date.now() - cached.ts > TRACKER_CACHE_TTL) {
          const fresh = await fetchFromDB();
          if (fresh) setProgress(fresh);
        }
        return;
      }
      // No cache — fetch and show loading
      const map = await fetchFromDB();
      if (map) { setProgress(map); setSyncStatus('synced'); }
      else setSyncStatus('offline');
      setLoading(false);
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
          { id, user_id: user.id, is_checked, topic_note, updated_at: new Date().toISOString() },
          { onConflict: 'id,user_id' },
        );
        if (error) throw error;
        setSyncStatus('synced');
        // Update cache in-place so next mount doesn't need a re-fetch
        const cached = _trackerCache.get(user.id);
        if (cached) {
          const updated = new Map(cached.data);
          updated.set(id, { id, is_checked, topic_note });
          _trackerCache.set(user.id, { data: updated, ts: cached.ts });
        }
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
        const isChecked = existing?.is_checked ?? false;
        next.set(id, { id, is_checked: isChecked, topic_note: note });

        // Debounce cloud push
        if (timers.current[id]) clearTimeout(timers.current[id]);
        timers.current[id] = setTimeout(() => {
          setSyncStatus('saving');
          pushToCloud(id, isChecked, note);
          delete timers.current[id];
        }, 1500);

        return next;
      });
    },
    [pushToCloud],
  );

  // ── Mapping from section key to old app box ID (for custom topic matching) ─
  const SECTION_BOX_MAP: Record<string, string> = {
    p1: 'box-prelims-gs', p2: 'box-prelims-csat',
    gs1: 'box-mains-gs1', gs2: 'box-mains-gs2', gs3: 'box-mains-gs3', gs4: 'box-mains-gs4',
    es: 'box-mains-essay', la: 'box-mains-lang-a', lb: 'box-mains-lang-b',
    a1: 'box-anthro-p1', a2: 'box-anthro-p2', ca: 'box-ca',
  };

  // ── Calculate metrics ──────────────────────────────────────────────────
  const getMetrics = useCallback(
    (prefix: string) => {
      // Total from syllabus data definition
      let total = 0;
      for (const stage of STAGES) {
        for (const sec of stage.sections) {
          if (sec.key === prefix) total += sec.topics.length;
        }
      }
      if (prefix === 'ca') total = CA_SECTION.topics.length;
      // Also count custom topics for this section (using old app box ID format)
      const boxName = SECTION_BOX_MAP[prefix] || prefix;
      progress.forEach((row) => {
        if (row.id.startsWith('custom_') && row.id.includes(boxName)) total++;
      });
      // Checked count from progress map
      let checked = 0;
      progress.forEach((row) => {
        if (row.id.startsWith(`uid-${prefix}-`) && row.is_checked) checked++;
        if (row.id.startsWith('custom_') && row.id.includes(boxName) && row.is_checked) checked++;
      });
      return { total, checked, pct: total > 0 ? Math.round((checked / total) * 100) : 0 };
    },
    [progress],
  );

  const getGlobalMetrics = useCallback(() => {
    // Total from all syllabus data
    let total = 0;
    for (const stage of STAGES) {
      for (const sec of stage.sections) {
        total += sec.topics.length;
      }
    }
    total += CA_SECTION.topics.length;
    // Also count custom topics (exclude PYQ/TS custom entries)
    progress.forEach((row) => {
      if (row.id.startsWith('custom_') && !row.id.includes('box-pyq') && !row.id.includes('box-ts')) total++;
    });
    // Checked count from progress (matching old app exclusions exactly)
    let checked = 0;
    progress.forEach((row) => {
      if (row.id.startsWith('uid-') &&
          !row.id.startsWith('uid-pyq') && !row.id.startsWith('uid-ts') &&
          !row.id.startsWith('uid-pq') && !row.id.startsWith('uid-qg') &&
          !row.id.startsWith('uid-qa') && !row.id.startsWith('uid-tp') &&
          !row.id.startsWith('uid-tg') && !row.id.startsWith('uid-te') &&
          !row.id.startsWith('uid-ta')) {
        if (row.is_checked) checked++;
      }
      if (row.id.startsWith('custom_') && !row.id.includes('box-pyq') && !row.id.includes('box-ts') && row.is_checked) checked++;
    });
    return { total, checked, pct: total > 0 ? parseFloat(((checked / total) * 100).toFixed(1)) : 0 };
  }, [progress]);

  // ── Clear all progress (uncheck all, preserve notes) ───────────────────
  const clearAllProgress = useCallback(async () => {
    if (!user) return;
    setProgress((prev) => {
      const next = new Map(prev);
      next.forEach((row, id) => {
        if (row.is_checked) {
          next.set(id, { ...row, is_checked: false });
        }
      });
      return next;
    });
    // Bulk update in cloud — only clear syllabus rows (uid-* and custom-*), NOT plan tasks / PYQ / CA
    setSyncStatus('saving');
    try {
      await Promise.all([
        supabase.from('upsc_tracker_progress')
          .update({ is_checked: false, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .like('id', 'uid-%'),
        supabase.from('upsc_tracker_progress')
          .update({ is_checked: false, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .like('id', 'custom_%'),
      ]);
      setSyncStatus('synced');
    } catch {
      setSyncStatus('offline');
    }
  }, [user]);

  // ── Add custom topic to local progress map (after DB insert) ───────────
  const addCustomTopic = useCallback((id: string) => {
    setProgress((prev) => {
      const next = new Map(prev);
      next.set(id, { id, is_checked: false, topic_note: '' });
      return next;
    });
  }, []);

  // ── Delete a custom topic ──────────────────────────────────────────────
  const deleteCustomTopic = useCallback(async (id: string) => {
    if (!user) return;
    setProgress((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    await supabase.from('upsc_tracker_progress').delete().eq('id', id).eq('user_id', user.id);
  }, [user]);

  // ── Get custom topics for a section ────────────────────────────────────
  const getCustomTopics = useCallback((sectionKey: string) => {
    const boxName = SECTION_BOX_MAP[sectionKey] || sectionKey;
    const topics: { id: string; text: string; is_checked: boolean; topic_note: string }[] = [];
    progress.forEach((row) => {
      if (row.id.startsWith('custom_') && row.id.includes(boxName)) {
        // Decode text from ID: custom_<boxId>_<base64text>
        const afterPrefix = row.id.replace(`custom_${boxName}_`, '');
        let text = afterPrefix;
        try { text = decodeURIComponent(escape(atob(afterPrefix))); } catch { /* use raw */ }
        topics.push({ id: row.id, text, is_checked: row.is_checked, topic_note: row.topic_note });
      }
    });
    return topics;
  }, [progress]);

  return { progress, loading, syncStatus, toggleCheck, updateNote, getMetrics, getGlobalMetrics, clearAllProgress, addCustomTopic, deleteCustomTopic, getCustomTopics };
}

