import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface FocusSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

export function useFocus() {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState<FocusSession[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [weekTotal, setWeekTotal] = useState(0);
  const sessionRef = useRef<{ id: string; start: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load history + totals ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('upsc_focus_sessions')
        .select('id, started_at, ended_at, duration_seconds')
        .eq('user_id', user.id)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(30);

      const sessions = (data ?? []) as FocusSession[];
      setHistory(sessions);

      // Totals
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

      let td = 0, wd = 0;
      sessions.forEach((s) => {
        const dur = s.duration_seconds ?? 0;
        if (s.started_at.slice(0, 10) === todayStr) td += dur;
        if (new Date(s.started_at) >= weekAgo) wd += dur;
      });
      setTodayTotal(td);
      setWeekTotal(wd);
    };
    load();
  }, [user]);

  // ── Start ──────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (!user || active) return;
    const now = new Date();
    try {
      const { data, error } = await supabase
        .from('upsc_focus_sessions')
        .insert({ user_id: user.id, started_at: now.toISOString() })
        .select()
        .single();
      if (error) throw error;
      sessionRef.current = { id: data.id, start: now.getTime() };
    } catch {
      sessionRef.current = { id: `local-${Date.now()}`, start: now.getTime() };
    }
    setActive(true);
    setElapsed(0);
    intervalRef.current = setInterval(() => {
      if (sessionRef.current) {
        setElapsed(Math.floor((Date.now() - sessionRef.current.start) / 1000));
      }
    }, 1000);
  }, [user, active]);

  // ── Stop ───────────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    if (!user || !sessionRef.current) return;
    if (intervalRef.current) clearInterval(intervalRef.current);

    const { id, start } = sessionRef.current;
    const dur = Math.max(1, Math.floor((Date.now() - start) / 1000));
    const endTime = new Date();

    if (!id.startsWith('local-')) {
      await supabase
        .from('upsc_focus_sessions')
        .update({ ended_at: endTime.toISOString(), duration_seconds: dur })
        .eq('id', id)
        .eq('user_id', user.id);
    }

    const newSession: FocusSession = {
      id,
      started_at: new Date(start).toISOString(),
      ended_at: endTime.toISOString(),
      duration_seconds: dur,
    };
    setHistory((prev) => [newSession, ...prev].slice(0, 30));
    setTodayTotal((t) => t + dur);
    setWeekTotal((t) => t + dur);
    sessionRef.current = null;
    setActive(false);
    setElapsed(0);

    return dur;
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { active, elapsed, history, todayTotal, weekTotal, start, stop };
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
