import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { loadCloudPref, saveCloudPref } from '../lib/cloudPrefs';
import { addFocusSeconds, logFocus, type FocusSource } from '../lib/focusDb';
import { istDayOf, istToday } from '../lib/studyStats';
import {
  applyBaseline, focusTotals, parseBaseline, planOpenSession,
  type ClearBaseline, type DailyFocus, type OpenSessionPlan,
} from '../lib/focusStats';

export type { DailyFocus };

// Keep old interface for backward compat (tests etc)
export interface FocusSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

const BEAT_MS = 30_000;          // checkpoint to the database this often while running
const SLEEP_GAP_MS = 150_000;    // a longer silence between ticks means the machine slept or the tab was frozen
const baselineKey = (uid: string) => `upsc_focus_cleared_${uid}`;

interface Live {
  id: string;
  start: number;        // ms epoch the current stretch began (advanced at every checkpoint)
  accumulated: number;  // seconds already counted before `start`
  day: string;          // IST day the session began; the whole session is credited to it
  origin: number;       // ms epoch the session really began
}

function readBaseline(uid: string | undefined): ClearBaseline | null {
  if (!uid) return null;
  try { return parseBaseline(JSON.parse(localStorage.getItem(baselineKey(uid)) ?? 'null')); } catch { return null; }
}

export function useFocus() {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rawDaily, setRawDaily] = useState<DailyFocus[]>([]);
  const [baseline, setBaseline] = useState<ClearBaseline | null>(() => readBaseline(user?.id));
  const sessionRef = useRef<Live | null>(null);
  const pausedRef = useRef(false);
  const lastTickRef = useRef(0);
  const lastBeatRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // What the Focus panel shows. The database always keeps everything; "clear" only moves this baseline.
  const dailyHistory = useMemo(() => applyBaseline(rawDaily, baseline), [rawDaily, baseline]);
  const totals = focusTotals(dailyHistory, istToday());

  const writeSession = useCallback(async (id: string, patch: Record<string, unknown>) => {
    if (id.startsWith('local-')) return;
    try { await supabase.from('upsc_focus_sessions').update(patch).eq('id', id); } catch { /* non-critical */ }
  }, []);

  // ── Helper: credit seconds to an IST day (atomic when migration v12 is applied) and log it ──
  const addToDailyTotal = useCallback(async (
    userId: string, seconds: number, date: string,
    meta: { source: FocusSource; startedAt?: number; endedAt?: number },
  ) => {
    if (seconds <= 0) return;
    if (await addFocusSeconds(userId, date, seconds)) void logFocus(userId, { date, seconds, ...meta });
  }, []);

  const loadDaily = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('upsc_focus_daily')
      .select('focus_date, total_seconds')
      .eq('user_id', user.id)
      .order('focus_date', { ascending: false })
      .limit(60);
    setRawDaily((data ?? []) as DailyFocus[]);
  }, [user]);

  // ── Ticker: elapsed display, checkpoints, and protection against sleep gaps ──
  const stopTicker = () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };

  const checkpoint = useCallback((now: number) => {
    const s = sessionRef.current;
    if (!s) return;
    const whole = Math.floor((now - s.start) / 1000);
    s.accumulated += whole;
    s.start += whole * 1000;
    lastBeatRef.current = now;
    void writeSession(s.id, { accumulated_seconds: s.accumulated, started_at: new Date(s.start).toISOString() });
  }, [writeSession]);

  const tick = useCallback(() => {
    const s = sessionRef.current;
    if (!s || pausedRef.current) return;
    const now = Date.now();
    if (now - lastTickRef.current > SLEEP_GAP_MS) {
      // Laptop slept / tab frozen: count only up to the last tick we actually saw
      s.accumulated += Math.max(0, Math.floor((lastTickRef.current - s.start) / 1000));
      s.start = now;
      checkpoint(now);
    }
    lastTickRef.current = now;
    setElapsed(s.accumulated + Math.floor((now - s.start) / 1000));
    if (now - lastBeatRef.current >= BEAT_MS) checkpoint(now);
  }, [checkpoint]);

  const startTicker = useCallback(() => {
    stopTicker();
    intervalRef.current = setInterval(tick, 1000);
  }, [tick]);

  // ── Load daily history, the clear baseline, and resume an unstopped session ──
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const adopt = (id: string, plan: OpenSessionPlan, now: number, wasPausedInDb: boolean) => {
      const elapsedNow = plan.running ? plan.accumulated + Math.floor((now - plan.checkpoint) / 1000) : plan.accumulated;
      sessionRef.current = {
        id,
        start: plan.running ? plan.checkpoint : now,
        accumulated: plan.accumulated,
        day: istDayOf(plan.originMs),
        origin: plan.originMs,
      };
      pausedRef.current = !plan.running;
      lastTickRef.current = now;
      lastBeatRef.current = now;
      setActive(true);
      setPaused(!plan.running);
      setElapsed(elapsedNow);
      try { localStorage.setItem('upsc_focus_active', '1'); } catch { /* ignore */ }
      if (plan.running) startTicker();
      else if (!wasPausedInDb) void writeSession(id, { duration_seconds: 1, started_at: new Date(now).toISOString() });
    };

    const load = async () => {
      try {
        const { data: open } = await supabase
          .from('upsc_focus_sessions')
          .select('id, started_at, accumulated_seconds, duration_seconds, created_at')
          .eq('user_id', user.id)
          .is('ended_at', null)
          .order('started_at', { ascending: false });

        const now = Date.now();
        let adopted = false;
        for (const row of open ?? []) {
          const plan = planOpenSession(row, now);
          if (!adopted && plan.kind === 'resume' && !cancelled) {
            adopted = true;
            adopt(row.id, plan, now, row.duration_seconds === 1);
            continue;
          }
          // Extra or abandoned sessions: keep only the time that was really tracked, on the day they began
          if (plan.accumulated > 5) {
            await addToDailyTotal(user.id, plan.accumulated, istDayOf(plan.originMs), { source: 'recovered', startedAt: plan.originMs, endedAt: plan.checkpoint });
          }
          await supabase.from('upsc_focus_sessions').delete().eq('id', row.id);
        }
      } catch { /* non-critical */ }

      if (!cancelled) await loadDaily();
    };
    load();

    setBaseline(readBaseline(user.id));
    loadCloudPref<unknown>(user.id, 'focus_cleared').then((r) => {
      if (cancelled || !r.ok || !r.found) return;
      const b = parseBaseline(r.value);
      if (b) {
        setBaseline(b);
        try { localStorage.setItem(baselineKey(user.id), JSON.stringify(b)); } catch { /* ignore */ }
      } else {
        setBaseline(null);
        try { localStorage.removeItem(baselineKey(user.id)); } catch { /* ignore */ }
      }
    });

    return () => { cancelled = true; };
  }, [user, addToDailyTotal, loadDaily, startTicker, writeSession]);

  // ── Start ──────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (!user || active) return;
    const now = Date.now();
    let sessionId = `local-${now}`;
    let originMs = now;
    try {
      const { data, error } = await supabase
        .from('upsc_focus_sessions')
        .insert({ user_id: user.id, started_at: new Date(now).toISOString(), accumulated_seconds: 0, duration_seconds: 0 })
        .select()
        .single();
      if (!error && data) {
        sessionId = data.id;
        const created = data.created_at ? new Date(data.created_at).getTime() : NaN;
        if (Number.isFinite(created)) originMs = created;
      }
    } catch { /* use local */ }

    sessionRef.current = { id: sessionId, start: now, accumulated: 0, day: istDayOf(originMs), origin: originMs };
    pausedRef.current = false;
    lastTickRef.current = now;
    lastBeatRef.current = now;
    setActive(true);
    setPaused(false);
    setElapsed(0);
    try { localStorage.setItem('upsc_focus_active', '1'); } catch { /* ignore */ }
    try {
      await supabase.from('upsc_user_sessions').upsert(
        { user_id: user.id, focus_active: true },
        { onConflict: 'user_id' },
      );
    } catch { /* non-critical */ }
    startTicker();
  }, [user, active, startTicker]);

  // ── Pause ──────────────────────────────────────────────────────────────
  const pause = useCallback(async () => {
    const s = sessionRef.current;
    if (!user || !s || pausedRef.current) return;
    stopTicker();
    const now = Date.now();
    s.accumulated += Math.floor((now - s.start) / 1000);
    s.start = now;
    pausedRef.current = true;
    setPaused(true);
    setElapsed(s.accumulated);
    // duration_seconds doubles as the paused flag (1 = paused) so a refresh does not count break time
    await writeSession(s.id, { accumulated_seconds: s.accumulated, started_at: new Date(now).toISOString(), duration_seconds: 1 });
  }, [user, writeSession]);

  // ── Resume (from pause) ────────────────────────────────────────────────
  const resume = useCallback(async () => {
    const s = sessionRef.current;
    if (!user || !s || !pausedRef.current) return;
    const now = Date.now();
    s.start = now;
    pausedRef.current = false;
    lastTickRef.current = now;
    lastBeatRef.current = now;
    setPaused(false);
    startTicker();
    await writeSession(s.id, { started_at: new Date(now).toISOString(), duration_seconds: 0 });
  }, [user, startTicker, writeSession]);

  // ── Stop ───────────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    const s = sessionRef.current;
    if (!user || !s) return;
    stopTicker();
    const now = Date.now();
    const totalDur = s.accumulated + (pausedRef.current ? 0 : Math.floor((now - s.start) / 1000));

    // The whole session belongs to the day it began, even if it runs past midnight
    await addToDailyTotal(user.id, totalDur, s.day, { source: 'timer', startedAt: s.origin, endedAt: now });
    window.dispatchEvent(new Event('upsc-focus-saved'));

    // Delete the active session row (only daily totals persist)
    if (!s.id.startsWith('local-')) {
      try { await supabase.from('upsc_focus_sessions').delete().eq('id', s.id); } catch { /* */ }
    }

    sessionRef.current = null;
    pausedRef.current = false;
    setActive(false);
    setPaused(false);
    setElapsed(0);
    try { localStorage.removeItem('upsc_focus_active'); } catch { /* ignore */ }
    try {
      await supabase.from('upsc_user_sessions').upsert(
        { user_id: user.id, focus_active: false },
        { onConflict: 'user_id' },
      );
    } catch { /* non-critical */ }
    try { localStorage.setItem('upsc_last_focus_ts', String(Date.now())); } catch { /* ignore */ }

    await loadDaily();
    return totalDur;
  }, [user, addToDailyTotal, loadDaily]);

  // ── Clear history: hides it in this panel only; nothing is deleted anywhere ──
  const clearHistory = useCallback(async () => {
    if (!user) return;
    const today = istToday();
    const next: ClearBaseline = { before: today, secs: focusTotals(rawDaily, today).today };
    setBaseline(next);
    try { localStorage.setItem(baselineKey(user.id), JSON.stringify(next)); } catch { /* ignore */ }
    saveCloudPref(user.id, 'focus_cleared', next);
  }, [user, rawDaily]);

  // Bring the hidden history back (it was never deleted)
  const restoreHistory = useCallback(() => {
    if (!user) return;
    setBaseline(null);
    try { localStorage.removeItem(baselineKey(user.id)); } catch { /* ignore */ }
    saveCloudPref(user.id, 'focus_cleared', {});
  }, [user]);

  // Auto-stop on logout
  useEffect(() => {
    const handleLogout = () => { if (sessionRef.current) stop(); };
    window.addEventListener('upsc-logout', handleLogout);
    return () => window.removeEventListener('upsc-logout', handleLogout);
  }, [stop]);

  // Cleanup interval on unmount (session stays in DB for resume)
  useEffect(() => stopTicker, []);

  return {
    active, paused, elapsed, dailyHistory,
    todayTotal: totals.today, weekTotal: totals.week, lastWeekTotal: totals.lastWeek,
    start, stop, pause, resume, clearHistory, restoreHistory, historyHidden: baseline !== null,
  };
}

export function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDurationShort(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
