export type Level = 0 | 1 | 2 | 3 | 4;
export interface Cell { date: string; secs: number; level: Level }

// "Today" in IST, matching how focus time is stored (upsc_focus_daily.focus_date)
export const istToday = (now = new Date()) => new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);

const addDays = (ymd: string, n: number) => new Date(new Date(`${ymd}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
// Monday = 0 … Sunday = 6
const weekdayIdx = (ymd: string) => (new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7;

export function levelFor(secs: number, goalSecs: number): Level {
  if (secs <= 0) return 0;
  const r = goalSecs > 0 ? secs / goalSecs : 1;
  return r < 0.25 ? 1 : r < 0.5 ? 2 : r < 1 ? 3 : 4;
}

// weeks × 7 grid (Mon..Sun rows). Cells before the first day / after today are null.
export function buildHeatmap(secsByDate: Map<string, number>, goalSecs: number, today: string, weeks = 12): (Cell | null)[][] {
  const totalDays = weeks * 7;
  const first = addDays(today, -(totalDays - 1));
  const lead = weekdayIdx(first);
  const flat: (Cell | null)[] = Array(lead).fill(null);
  for (let i = 0; i < totalDays; i++) {
    const date = addDays(first, i);
    const secs = secsByDate.get(date) ?? 0;
    flat.push({ date, secs, level: levelFor(secs, goalSecs) });
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
