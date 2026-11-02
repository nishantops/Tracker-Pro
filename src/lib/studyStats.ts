export type Level = 0 | 1 | 2 | 3 | 4;
export interface Cell { date: string; secs: number; level: Level }

// "Today" in IST, matching how focus time is stored (upsc_focus_daily.focus_date)
export const istToday = (now = new Date()) => new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);

export const addDays = (ymd: string, n: number) => new Date(new Date(`${ymd}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
// Monday = 0 … Sunday = 6
const weekdayIdx = (ymd: string) => (new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7;

export function levelFor(secs: number, goalSecs: number): Level {
  if (secs <= 0) return 0;
  const r = goalSecs > 0 ? secs / goalSecs : 1;
  return r < 0.25 ? 1 : r < 0.5 ? 2 : r < 1 ? 3 : 4;
}

export const isWeekend = (ymd: string) => { const d = new Date(`${ymd}T00:00:00Z`).getUTCDay(); return d === 0 || d === 6; };

export interface DailyGoal { weekday: number; weekend: number }
export const goalHoursFor = (g: DailyGoal, ymd: string) => (isWeekend(ymd) ? g.weekend : g.weekday);

// weeks × 7 grid (Mon..Sun rows). Cells before the first day / after today are null.
export function buildHeatmap(secsByDate: Map<string, number>, goalSecs: number | ((ymd: string) => number), today: string, weeks = 12): (Cell | null)[][] {
  const totalDays = weeks * 7;
  const first = addDays(today, -(totalDays - 1));
  const lead = weekdayIdx(first);
  const flat: (Cell | null)[] = Array(lead).fill(null);
  for (let i = 0; i < totalDays; i++) {
    const date = addDays(first, i);
    const secs = secsByDate.get(date) ?? 0;
    flat.push({ date, secs, level: levelFor(secs, typeof goalSecs === 'function' ? goalSecs(date) : goalSecs) });
  }
  while (flat.length % 7 !== 0) flat.push(null);
  const cols: (Cell | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) cols.push(flat.slice(i, i + 7));
  return cols;
}

// Consecutive study days ending today; a day without study yet today does not break the streak.
export function currentStreak(secsByDate: Map<string, number>, today: string): number {
  let day = (secsByDate.get(today) ?? 0) > 0 ? today : addDays(today, -1);
  let n = 0;
  while ((secsByDate.get(day) ?? 0) > 0) { n++; day = addDays(day, -1); }
  return n;
}

export function lastNDaysTotal(secsByDate: Map<string, number>, today: string, n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += secsByDate.get(addDays(today, -i)) ?? 0;
  return sum;
}

export const fmtHM = (secs: number) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Trend (days / weeks / months) ────────────────────────────────────────
export type TrendMode = 'days' | 'weeks' | 'months';
export interface TrendPoint { label: string; title: string; secs: number; goalSecs: number }

export const TREND_LENGTH: Record<TrendMode, number> = { days: 14, weeks: 12, months: 12 };
// Days of history needed to draw every mode
export const TREND_HISTORY_DAYS = 372;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function sumRange(secsByDate: Map<string, number>, goalFor: (ymd: string) => number, from: string, to: string) {
  let secs = 0, goalSecs = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) { secs += secsByDate.get(d) ?? 0; goalSecs += goalFor(d); }
  return { secs, goalSecs };
}

// Oldest first. The last point is the current (still running) day / week / month; days after today count for nothing.
export function buildTrend(secsByDate: Map<string, number>, mode: TrendMode, today: string, goalFor: (ymd: string) => number): TrendPoint[] {
  const n = TREND_LENGTH[mode];
  const out: TrendPoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    if (mode === 'days') {
      const d = addDays(today, -i);
      out.push({ label: d.slice(8), title: d, secs: secsByDate.get(d) ?? 0, goalSecs: goalFor(d) });
    } else if (mode === 'weeks') {
      const start = addDays(addDays(today, -weekdayIdx(today)), -7 * i);
      const end = addDays(start, 6) > today ? today : addDays(start, 6);
      const label = `${parseInt(start.slice(8), 10)} ${MONTHS[parseInt(start.slice(5, 7), 10) - 1]}`;
      out.push({ label, title: `Week of ${start}`, ...sumRange(secsByDate, goalFor, start, end) });
    } else {
      const y = parseInt(today.slice(0, 4), 10);
      const m0 = parseInt(today.slice(5, 7), 10) - 1 - i;
      const yy = y + Math.floor(m0 / 12);
      const mm = ((m0 % 12) + 12) % 12;
      const first = `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
      const last = addDays(`${mm === 11 ? yy + 1 : yy}-${String(((mm + 1) % 12) + 1).padStart(2, '0')}-01`, -1);
      out.push({ label: MONTHS[mm]!, title: `${MONTHS[mm]} ${yy}`, ...sumRange(secsByDate, goalFor, first, last > today ? today : last) });
    }
  }
  return out;
}

// Latest period vs the one before it (null when there is nothing to compare against)
export function trendDelta(points: TrendPoint[]): { current: number; previous: number; pct: number | null } {
  const current = points[points.length - 1]?.secs ?? 0;
  const previous = points[points.length - 2]?.secs ?? 0;
  return { current, previous, pct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null };
}