import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  ackToday, buildAlerts, DEFAULT_PREFS, fetchNotifData, REMINDER_IDS, snooze,
  type Alert, type NotifData,
} from '../lib/notifEngine';

type ProgressLike = Map<string, { id: string; is_checked: boolean }> | undefined;

const TICK_MS = 60_000;
const REFETCH_MS = 5 * 60_000;

// Keeps the alert list up to date in the background (not only while the bell panel is open).
export function useNotifAlerts(user: User | null, progress: ProgressLike) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [repeatMinutes, setRepeatMinutes] = useState(DEFAULT_PREFS.repeatMinutes);
  const dataRef = useRef<{ data: NotifData; ts: number } | null>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const recompute = useCallback(() => {
    const cached = dataRef.current;
    if (!cached) return;
    setAlerts(buildAlerts(cached.data, progressRef.current));
    setRepeatMinutes(cached.data.prefs.repeatMinutes);
  }, []);

  const refresh = useCallback(async (force = false) => {
    if (!user) return;
    const cached = dataRef.current;
    if (force || !cached || Date.now() - cached.ts > REFETCH_MS) {
      try {
        const data = await fetchNotifData(user.id);
        dataRef.current = { data, ts: Date.now() };
        try { localStorage.setItem('upsc_notif_prefs', JSON.stringify(data.prefs)); } catch { /* ignore */ }
      } catch { /* keep the last data */ }
    }
    recompute();
  }, [user, recompute]);

  useEffect(() => {
    if (!user) { setAlerts([]); return; }
    refresh(true);
    const id = setInterval(() => refresh(), TICK_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [user, refresh]);

  // hours omitted: reminders count as attended for today, others snooze for the default duration
  const dismiss = useCallback((id: string, hours?: number) => {
    if (hours === undefined && REMINDER_IDS.includes(id)) ackToday(id);
    else snooze(id, hours ?? dataRef.current?.data.prefs.snoozeDuration ?? DEFAULT_PREFS.snoozeDuration);
    setAlerts((a) => a.filter((x) => x.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    const h = dataRef.current?.data.prefs.snoozeDuration ?? DEFAULT_PREFS.snoozeDuration;
    setAlerts((current) => {
      current.forEach((a) => { if (REMINDER_IDS.includes(a.id)) ackToday(a.id); else snooze(a.id, h); });
      return [];
    });
  }, []);

  return { alerts, repeatMinutes, refresh: () => refresh(true), dismiss, dismissAll };
}
