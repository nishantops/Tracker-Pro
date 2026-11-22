import { describe, it, expect } from 'vitest';
import {
  adjustMode, applyAdjust, applyBaseline, focusTotals, parseBaseline, planOpenSession, GRACE_MS, STALE_MS,
} from './focusStats';
import { istDayOf, weekStartOf } from './studyStats';

const d = (focus_date: string, total_seconds: number) => ({ focus_date, total_seconds });

describe('istDayOf', () => {
  it('uses the Indian calendar day', () => {
    expect(istDayOf('2026-11-02T17:30:00Z')).toBe('2026-11-02'); // 11:00 PM IST
    expect(istDayOf('2026-11-02T18:29:00Z')).toBe('2026-11-02'); // 11:59 PM IST
    expect(istDayOf('2026-11-02T18:30:00Z')).toBe('2026-11-03'); // midnight IST
  });
});

describe('focusTotals (weeks run Monday to Sunday)', () => {
  const days = [
    d('2026-11-22', 1 * 3600),  // Sun (today)
    d('2026-11-16', 2 * 3600),  // Mon, this week
    d('2026-11-15', 4 * 3600),  // Sun, last week
    d('2026-11-09', 8 * 3600),  // Mon, last week
    d('2026-11-08', 16 * 3600), // Sun, two weeks ago
  ];

  it('this week = Monday to today, last week = the previous Monday to Sunday', () => {
    expect(focusTotals(days, '2026-11-22')).toEqual({ today: 3600, week: 3 * 3600, lastWeek: 12 * 3600 });
  });

  it('on a Monday the current week only holds today', () => {
    expect(focusTotals([d('2026-11-23', 600), d('2026-11-22', 3600)], '2026-11-23')).toEqual({ today: 600, week: 600, lastWeek: 3600 });
  });

  it('weekStartOf finds the Monday', () => {
    expect(weekStartOf('2026-11-22')).toBe('2026-11-16');
    expect(weekStartOf('2026-11-16')).toBe('2026-11-16');
  });
});

describe('clear baseline', () => {
  const days = [d('2026-11-02', 5000), d('2026-11-01', 3000), d('2026-10-30', 100)];
  it('hides earlier days and only the pre-clear part of that day', () => {
    expect(applyBaseline(days, { before: '2026-11-02', secs: 3000 })).toEqual([d('2026-11-02', 2000)]);
    expect(applyBaseline(days, { before: '2026-11-02', secs: 5000 })).toEqual([]);
  });
  it('is a no-op without a baseline, and parses defensively', () => {
    expect(applyBaseline(days, null)).toBe(days);
    expect(parseBaseline({ before: '2026-11-02', secs: 12 })).toEqual({ before: '2026-11-02', secs: 12 });
    expect(parseBaseline({ before: 'x' })).toBeNull();
    expect(parseBaseline(null)).toBeNull();
  });
});

describe('planOpenSession', () => {
  const now = Date.parse('2026-11-02T12:00:00Z');
  const row = (over = {}) => ({ id: 'a', started_at: new Date(now - 30_000).toISOString(), accumulated_seconds: 100, duration_seconds: 0, created_at: new Date(now - 3_600_000).toISOString(), ...over });

  it('keeps running when the last checkpoint is recent', () => {
    expect(planOpenSession(row(), now)).toMatchObject({ kind: 'resume', running: true, accumulated: 100 });
  });
  it('comes back paused when the checkpoint is older than the grace period or flagged paused', () => {
    expect(planOpenSession(row({ started_at: new Date(now - GRACE_MS - 1000).toISOString() }), now)).toMatchObject({ kind: 'resume', running: false });
    expect(planOpenSession(row({ duration_seconds: 1 }), now)).toMatchObject({ kind: 'resume', running: false });
  });
  it('is finalised once the checkpoint is more than a day old, remembering the original start', () => {
    const created = new Date(now - STALE_MS - 5 * 3_600_000).toISOString();
    const plan = planOpenSession(row({ started_at: new Date(now - STALE_MS - 1000).toISOString(), created_at: created }), now);
    expect(plan.kind).toBe('finalize');
    expect(plan.originMs).toBe(Date.parse(created));
  });
  it('treats missing created_at as started_at and a bad date as finalise', () => {
    expect(planOpenSession(row({ created_at: null }), now).originMs).toBe(now - 30_000);
    expect(planOpenSession(row({ started_at: 'nope' }), now).kind).toBe('finalize');
  });
});

describe('manual adjustments', () => {
  const today = '2026-11-22';
  it('today can be added to, the two days before can only be reduced, the rest is locked', () => {
    expect(adjustMode('2026-11-22', today)).toBe('add');
    expect(adjustMode('2026-11-21', today)).toBe('subtract');
    expect(adjustMode('2026-11-20', today)).toBe('subtract');
    expect(adjustMode('2026-11-19', today)).toBeNull();
    expect(adjustMode('2026-11-23', today)).toBeNull();
    expect(adjustMode('', today)).toBeNull();
  });
  it('add always works, subtract needs enough logged time and never goes below zero', () => {
    expect(applyAdjust('add', null, 600)).toEqual({ ok: true, total: 600 });
    expect(applyAdjust('add', 600, 600)).toEqual({ ok: true, total: 1200 });
    expect(applyAdjust('subtract', 3600, 600)).toEqual({ ok: true, total: 3000 });
    expect(applyAdjust('subtract', 3600, 3600)).toEqual({ ok: true, total: 0 });
    expect(applyAdjust('subtract', 3600, 3601)).toMatchObject({ ok: false });
    expect(applyAdjust('subtract', null, 60)).toMatchObject({ ok: false });
    expect(applyAdjust('subtract', 0, 60)).toMatchObject({ ok: false });
  });
});
