import { addDays, weekStartOf } from './studyStats';

export interface DailyFocus { focus_date: string; total_seconds: number }

// "Clear history" only hides what the Focus panel shows; upsc_focus_daily is never modified.
export interface ClearBaseline { before: string; secs: number }

export function parseBaseline(v: unknown): ClearBaseline | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as { before?: unknown; secs?: unknown };
  if (typeof o.before !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.before)) return null;
  return { before: o.before, secs: typeof o.secs === 'number' && o.secs > 0 ? o.secs : 0 };
}

// Days before the clear date are hidden; the clear day only shows time logged after the clear.
export function applyBaseline(days: DailyFocus[], baseline: ClearBaseline | null): DailyFocus[] {
  if (!baseline) return days;
  return days
    .filter((d) => d.focus_date >= baseline.before)
    .map((d) => (d.focus_date === baseline.before ? { ...d, total_seconds: Math.max(0, d.total_seconds - baseline.secs) } : d))
    .filter((d) => d.total_seconds > 0);
}

// Weeks run Monday to Sunday (IST days). "week" is Monday up to today; "lastWeek" is the full previous Monday-Sunday.
export function focusTotals(days: DailyFocus[], today: string) {
  const weekStart = weekStartOf(today);
  const lastStart = addDays(weekStart, -7);
  let todaySecs = 0, week = 0, lastWeek = 0;
  for (const d of days) {
    if (d.focus_date === today) todaySecs += d.total_seconds;
    if (d.focus_date >= weekStart && d.focus_date <= today) week += d.total_seconds;
    else if (d.focus_date >= lastStart && d.focus_date < weekStart) lastWeek += d.total_seconds;
  }
  return { today: todaySecs, week, lastWeek };
}

// ── Open (unstopped) sessions ────────────────────────────────────────────
// While running, the hook checkpoints started_at/accumulated_seconds every ~30s. created_at is the original start,
// duration_seconds doubles as the paused flag (1 = paused). Time between the last checkpoint and "now" is only trusted
// when it is short; a closed tab or a sleeping laptop never inflates the total.
export const GRACE_MS = 180_000;
export const STALE_MS = 24 * 3_600_000;

export interface OpenSessionRow {
  id: string;
  started_at: string;
  accumulated_seconds: number | null;
  duration_seconds?: number | null;
  created_at?: string | null;
}

export interface OpenSessionPlan {
  kind: 'resume' | 'finalize';
  running: boolean;       // resume only: keeps ticking (otherwise it comes back paused)
  accumulated: number;    // seconds counted so far (excludes untrusted gaps)
  checkpoint: number;     // ms epoch of the last checkpoint
  originMs: number;       // when the session really began (decides which day it belongs to)
}

export function planOpenSession(row: OpenSessionRow, now: number): OpenSessionPlan {
  const checkpoint = new Date(row.started_at).getTime();
  const acc = Math.max(0, row.accumulated_seconds ?? 0);
  const origin = row.created_at ? new Date(row.created_at).getTime() : checkpoint;
  const originMs = Number.isFinite(origin) ? Math.min(origin, checkpoint) : checkpoint;
  const gap = now - checkpoint;
  const paused = row.duration_seconds === 1;
  if (!Number.isFinite(checkpoint) || gap > STALE_MS) return { kind: 'finalize', running: false, accumulated: acc, checkpoint, originMs };
  const running = !paused && gap >= 0 && gap <= GRACE_MS;
  return { kind: 'resume', running, accumulated: acc, checkpoint, originMs };
}

// ── Manual corrections to daily totals ────────────────────────────────────
// Today can only be added to; yesterday and the day before can only be reduced; older days are locked.
export type AdjustKind = 'add' | 'subtract';

export function adjustMode(date: string, today: string): AdjustKind | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (date === today) return 'add';
  if (date === addDays(today, -1) || date === addDays(today, -2)) return 'subtract';
  return null;
}

export function applyAdjust(kind: AdjustKind, existing: number | null, secs: number): { ok: true; total: number } | { ok: false; error: string } {
  if (kind === 'add') return { ok: true, total: (existing ?? 0) + secs };
  if (!existing || existing <= 0) return { ok: false, error: 'Nothing is logged on that day to subtract from.' };
  if (secs > existing) return { ok: false, error: 'You can\u2019t subtract more than was logged that day.' };
  return { ok: true, total: existing - secs };
}