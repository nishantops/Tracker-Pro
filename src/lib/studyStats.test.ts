import { describe, it, expect } from 'vitest';
import { buildHeatmap, buildTrend, currentStreak, fmtHM, istToday, lastNDaysTotal, levelFor, trendDelta } from './studyStats';

const H = 3600;

describe('levelFor', () => {
  it('buckets by share of the daily goal', () => {
    expect(levelFor(0, 4 * H)).toBe(0);
    expect(levelFor(0.5 * H, 4 * H)).toBe(1);   // 12.5%
    expect(levelFor(1 * H, 4 * H)).toBe(2);     // 25%
    expect(levelFor(3 * H, 4 * H)).toBe(3);     // 75%
    expect(levelFor(4 * H, 4 * H)).toBe(4);     // goal met
    expect(levelFor(9 * H, 4 * H)).toBe(4);
  });
  it('any study counts as at least level 1 even with no goal', () => {
    expect(levelFor(60, 0)).toBe(4);
  });
});

describe('istToday', () => {
  it('rolls over at 18:30 UTC (midnight IST)', () => {
    expect(istToday(new Date('2026-11-02T18:29:00Z'))).toBe('2026-11-02');
    expect(istToday(new Date('2026-11-02T18:30:00Z'))).toBe('2026-11-03');
  });
});

describe('buildHeatmap', () => {
  const today = '2026-11-02'; // Monday
  it('has 7 rows per column, Monday first, and ends on today', () => {
    const cols = buildHeatmap(new Map(), 4 * H, today, 12);
    expect(cols.every((c) => c.length === 7)).toBe(true);
    const lastCol = cols[cols.length - 1];
    expect(lastCol[0]?.date).toBe('2026-11-02');  // Monday row
    expect(lastCol[1]).toBeNull();                 // future days are blank
  });

  it('covers exactly 84 days', () => {
    const cells = buildHeatmap(new Map(), 4 * H, today, 12).flat().filter(Boolean);
    expect(cells).toHaveLength(84);
    expect(cells[0]!.date).toBe('2026-08-11');
  });

  it('colours cells from the stored seconds', () => {
    const cols = buildHeatmap(new Map([['2026-11-02', 4 * H], ['2026-10-30', 1 * H]]), 4 * H, today, 12);
    const cells = cols.flat().filter(Boolean);
    expect(cells.find((c) => c!.date === '2026-11-02')!.level).toBe(4);
    expect(cells.find((c) => c!.date === '2026-10-30')!.level).toBe(2);
    expect(cells.find((c) => c!.date === '2026-10-31')!.level).toBe(0);
  });
});

describe('currentStreak', () => {
  const today = '2026-11-02';
  it('counts consecutive days ending today', () => {
    expect(currentStreak(new Map([['2026-11-02', 60], ['2026-11-01', 60], ['2026-10-31', 60]]), today)).toBe(3);
  });
  it('does not break the streak just because today has no study yet', () => {
    expect(currentStreak(new Map([['2026-11-01', 60], ['2026-10-31', 60]]), today)).toBe(2);
  });
  it('breaks on a missed day', () => {
    expect(currentStreak(new Map([['2026-11-02', 60], ['2026-10-31', 60]]), today)).toBe(1);
    expect(currentStreak(new Map([['2026-10-30', 60]]), today)).toBe(0);
  });
  it('is 0 with no data', () => expect(currentStreak(new Map(), today)).toBe(0));
});

describe('lastNDaysTotal and fmtHM', () => {
  it('sums the last n days including today', () => {
    const m = new Map([['2026-11-02', 100], ['2026-10-27', 50], ['2026-10-26', 999]]);
    expect(lastNDaysTotal(m, '2026-11-02', 7)).toBe(150);
  });
  it('formats hours and minutes', () => {
    expect(fmtHM(0)).toBe('0m');
    expect(fmtHM(59 * 60)).toBe('59m');
    expect(fmtHM(2 * H + 5 * 60)).toBe('2h 5m');
  });
});

describe('buildTrend', () => {
  const today = '2026-11-04'; // Wednesday
  const goal = () => 4 * H;
  const data = new Map([
    ['2026-11-01', 1 * H], ['2026-11-02', 1 * H], ['2026-11-04', 2 * H], ['2026-11-05', 5 * H], // 5th is in the future
    ['2026-10-27', 3 * H], ['2026-10-31', 2 * H],
  ]);

  it('days: the last 14 days ending today', () => {
    const pts = buildTrend(data, 'days', today, goal);
    expect(pts).toHaveLength(14);
    expect(pts[13]).toMatchObject({ title: '2026-11-04', label: '04', secs: 2 * H, goalSecs: 4 * H });
    expect(pts[0]!.title).toBe('2026-10-22');
  });

  it('weeks: Monday-based, the current week only counts days up to today', () => {
    const pts = buildTrend(data, 'weeks', today, goal);
    expect(pts).toHaveLength(12);
    expect(pts[11]).toMatchObject({ title: 'Week of 2026-11-02', label: '2 Nov', secs: 3 * H, goalSecs: 3 * 4 * H });
    expect(pts[10]).toMatchObject({ title: 'Week of 2026-10-26', secs: 6 * H, goalSecs: 7 * 4 * H }); // Sun 1 Nov belongs to this week
  });

  it('months: 12 months, crossing the year boundary, current month up to today', () => {
    const pts = buildTrend(data, 'months', today, goal);
    expect(pts).toHaveLength(12);
    expect(pts[0]!.title).toBe('Dec 2025');
    expect(pts[11]).toMatchObject({ label: 'Nov', secs: 4 * H, goalSecs: 4 * 4 * H });
    expect(pts[10]).toMatchObject({ label: 'Oct', secs: 5 * H, goalSecs: 31 * 4 * H });
  });

  it('uses each day\'s own goal', () => {
    const weekendHigh = (d: string) => ([0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay()) ? 8 * H : 2 * H);
    const wk = buildTrend(new Map(), 'weeks', '2026-11-08', weekendHigh); // Sunday: full week Mon–Sun
    expect(wk[11]!.goalSecs).toBe((5 * 2 + 2 * 8) * H);
  });
});

describe('trendDelta', () => {
  it('compares the latest period with the previous one', () => {
    const p = (secs: number) => ({ label: '', title: '', secs, goalSecs: 0 });
    expect(trendDelta([p(0), p(4 * H), p(6 * H)])).toEqual({ current: 6 * H, previous: 4 * H, pct: 50 });
    expect(trendDelta([p(2 * H), p(1 * H)]).pct).toBe(-50);
    expect(trendDelta([p(0), p(3 * H)]).pct).toBeNull();
    expect(trendDelta([])).toEqual({ current: 0, previous: 0, pct: null });
  });
});