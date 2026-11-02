import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  ackToday, buildAlerts, DEFAULT_PREFS, fetchNotifData, REMINDER_IDS, snooze,
  type Alert, type NotifData,
} from '../lib/notifEngine';
import { markRevised } from '../lib/revision';
import { alertsToPush, pushAlerts } from '../lib/browserPush';

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
  const alertsRef = useRef<Alert[]>([]);
  alertsRef.current = alerts;

  const recompute = useCallback(() => {
    const cached = dataRef.current;
    if (!cached) return;
    const next = buildAlerts(cached.data, progressRef.current);
    setAlerts(next);
    setRepeatMinutes(cached.data.prefs.repeatMinutes);
    // OS-level push only while the tab is in the background (the on-page toasts cover the foreground)
    if (cached.data.prefs.browserPush && document.visibilityState === 'hidden') {
      void pushAlerts(alertsToPush(next, cached.data.prefs.repeatMinutes));
    }
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

  // hours omitted: reminders count as attended for today, revision alerts mark their topics as revised, others snooze
  const dismiss = useCallback((id: string, hours?: number) => {
    const revisions = hours === undefined && id === 'revision_due' ? alertsRef.current.find((a) => a.id === id)?.revisions : undefined;
    if (revisions) markRevised(revisions);
    else if (hours === undefined && REMINDER_IDS.includes(id)) ackToday(id);
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
