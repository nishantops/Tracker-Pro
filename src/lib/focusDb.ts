import { supabase } from './supabase';

export type FocusSource = 'timer' | 'manual_add' | 'manual_subtract' | 'recovered';

// Adds seconds to an IST day (negative subtracts, never below zero). Uses the atomic database function from
// migration v12 so two devices cannot overwrite each other; without it, falls back to read-then-write.
export async function addFocusSeconds(userId: string, date: string, delta: number): Promise<boolean> {
  if (!delta) return true;
  try {
    const { error } = await supabase.rpc('upsc_focus_add', { p_date: date, p_secs: delta });
    if (!error) return true;
  } catch { /* function not installed yet */ }

  try {
    const { data: existing, error: readErr } = await supabase
      .from('upsc_focus_daily')
      .select('total_seconds')
      .eq('user_id', userId)
      .eq('focus_date', date)
      .maybeSingle();
    if (readErr) return false;
    const res = existing
      ? await supabase.from('upsc_focus_daily')
        .update({ total_seconds: Math.max(0, (existing.total_seconds as number) + delta), updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('focus_date', date)
      : await supabase.from('upsc_focus_daily').insert({ user_id: userId, focus_date: date, total_seconds: Math.max(0, delta) });
    return !res.error;
  } catch { return false; }
}

export interface FocusLogEntry {
  date: string;
  seconds: number;
  source: FocusSource;
  startedAt?: number;
  endedAt?: number;
}

// Append-only audit trail (table from migration v12). Silently skipped when the table does not exist.
export async function logFocus(userId: string, e: FocusLogEntry): Promise<void> {
  try {
    await supabase.from('upsc_focus_log').insert({
      user_id: userId,
      focus_date: e.date,
      seconds: e.seconds,
      source: e.source,
      started_at: e.startedAt ? new Date(e.startedAt).toISOString() : null,
      ended_at: e.endedAt ? new Date(e.endedAt).toISOString() : null,
    });
  } catch { /* non-critical */ }
}
