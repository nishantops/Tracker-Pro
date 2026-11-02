import { describe, it, expect } from 'vitest';
import { buildHeatmap, currentStreak, fmtHM, istToday, lastNDaysTotal, levelFor } from './studyStats';

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
