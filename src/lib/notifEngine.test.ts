import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./env', () => ({ ENV: { PRELIMS_DATE: 'May 23 2027', MAINS_DATE: 'Aug 20 2027', SUPABASE_URL: '', SUPABASE_ANON_KEY: '' } }));

import {
  ackToday, buildAlerts, DEFAULT_PREFS, isAckedToday, isSnoozed, snooze, sortAlerts,
  type NotifData, type NotifPrefs, type PlanRow,
} from './notifEngine';

const base = (over: Partial<NotifPrefs> = {}, plans: PlanRow[] = []): NotifData => ({
  prefs: { ...DEFAULT_PREFS, prelimsCountdown: false, mainsCountdown: false, planStart: false, planEnd: false, overdue: false, streak: false, ...over },
  plans,
});
const at = (h: number, m = 0, day = 2) => new Date(2026, 10, day, h, m, 0);
const ids = (d: NotifData, now: Date, progress?: Parameters<typeof buildAlerts>[1]) => buildAlerts(d, progress, now).map((a) => a.id);

beforeEach(() => localStorage.clear());

describe('time reminders (daily / evening / custom)', () => {
  it('are not due before the set time', () => {
    expect(ids(base({ daily: true, dailyTime: '09:00' }), at(8, 59))).toEqual([]);
  });

  it('become due exactly at the set time', () => {
    expect(ids(base({ daily: true, dailyTime: '09:00' }), at(9, 0))).toEqual(['daily_reminder']);
  });

  it('stay due for the rest of the day until attended (no 60-minute cutoff)', () => {
    const d = base({ daily: true, dailyTime: '09:00' });
    expect(ids(d, at(10, 30))).toEqual(['daily_reminder']);
    expect(ids(d, at(23, 59))).toEqual(['daily_reminder']);
  });

  it('are suppressed once attended today, and come back the next day', () => {
    const d = base({ evening: true, eveningTime: '21:00' });
    ackToday('evening_reminder', at(21, 5, 2));
    expect(ids(d, at(22, 0, 2))).toEqual([]);
    expect(ids(d, at(21, 0, 3))).toEqual(['evening_reminder']);
  });

  it('respect a snooze', () => {
    const d = base({ daily: true, dailyTime: '00:00' });
    snooze('daily_reminder', 4);
    expect(isSnoozed('daily_reminder')).toBe(true);
    expect(ids(d, new Date())).toEqual([]);
  });

  it('custom reminder needs text, shows it with the 💬 prefix', () => {
    expect(ids(base({ customReminder: true, customTime: '14:00', customText: '   ' }), at(15))).toEqual([]);
    const a = buildAlerts(base({ customReminder: true, customTime: '14:00', customText: 'Revise Polity' }), undefined, at(15));
    expect(a).toHaveLength(1);
    expect(a[0].message).toBe('💬 Revise Polity');
  });

  it('keeps the original wording of the daily and evening messages', () => {
    const a = buildAlerts(base({ daily: true, dailyTime: '00:00', evening: true, eveningTime: '00:00' }), undefined, at(12));
    expect(a.find((x) => x.id === 'daily_reminder')!.message).toBe('🌅 Good morning! Time to study. Consistency beats intensity every day.');
    expect(a.find((x) => x.id === 'evening_reminder')!.message).toBe("🌙 Evening check-in: review today's notes and plan tomorrow's targets!");
  });

  it('isAckedToday only matches the same calendar day', () => {
    ackToday('k', at(10, 0, 2));
    expect(isAckedToday('k', at(23, 0, 2))).toBe(true);
    expect(isAckedToday('k', at(0, 5, 3))).toBe(false);
  });
});

describe('master switch', () => {
  it('returns nothing when notifications are disabled', () => {
    expect(ids(base({ enabled: false, daily: true, dailyTime: '00:00' }), at(12))).toEqual([]);
  });
});

describe('plan alerts', () => {
  const plan = (over: Partial<PlanRow> = {}): PlanRow => ({ plan_id: 'p1', plan_title: 'Polity Sprint', start_date: null, end_date: null, notif_enabled: true, ...over });

  it('start alert today / tomorrow with original wording', () => {
    const d = base({ planStart: true, planStartDays: 1 }, [plan({ start_date: '2026-11-03' })]);
    expect(buildAlerts(d, undefined, at(10, 0, 2))[0].message).toBe('📋 "Polity Sprint" starts in 1 day');
    expect(buildAlerts(d, undefined, at(10, 0, 3))[0].message).toBe('📋 "Polity Sprint" starts today');
    expect(ids(d, at(10, 0, 5))).toEqual([]);
  });

  it('end alert and overdue alert', () => {
    const end = base({ planEnd: true, planEndDays: 2 }, [plan({ end_date: '2026-11-04' })]);
    expect(buildAlerts(end, undefined, at(9, 0, 2))[0].message).toBe('⏰ "Polity Sprint" ends in 2 days');
    const od = base({ overdue: true }, [plan({ end_date: '2026-10-30' })]);
    expect(buildAlerts(od, undefined, at(9, 0, 2))[0].message).toBe('🔴 "Polity Sprint" is 3 days overdue');
  });

  it('skips plans with notifications off and snoozed alerts', () => {
    const off = base({ planStart: true }, [plan({ start_date: '2026-11-02', notif_enabled: false })]);
    expect(ids(off, at(9))).toEqual([]);
    const on = base({ planStart: true }, [plan({ start_date: '2026-11-02' })]);
    snooze('plan_start_p1', 24);
    expect(ids(on, new Date(2026, 10, 2, 9))).toEqual([]);
  });
});

describe('exam, absorption and streak alerts', () => {
  it('prelims countdown within the window only', () => {
    const d = base({ prelimsCountdown: true, prelimsDays: 30 });
    const t = (days: number) => new Date(new Date('May 23 2027').getTime() - days * 86_400_000);
    expect(buildAlerts(d, undefined, t(10))[0].message).toMatch(/^🎯 Prelims in 10 days/);
    expect(ids(d, t(40))).toEqual([]);
    expect(ids(d, t(-1))).toEqual([]);
  });

  it('low absorption alert uses uid-/custom_ rows only', () => {
    const d = base({ lowAbsorption: true, absorptionPct: 50 });
    const progress = new Map([
      ['uid-a', { id: 'uid-a', is_checked: true }], ['uid-b', { id: 'uid-b', is_checked: false }],
      ['uid-c', { id: 'uid-c', is_checked: false }], ['other', { id: 'other', is_checked: true }],
    ]);
    const a = buildAlerts(d, progress, at(9));
    expect(a[0].message).toBe('⚠️ Absorption at 33.3% — below your 50% target!');
    expect(ids(d, at(9), new Map())).toEqual([]);
  });

  it('streak nudge after the configured days without focus', () => {
    const d = base({ streak: true, streakDays: 1 });
    localStorage.setItem('upsc_last_focus_ts', String(at(9, 0, 2).getTime()));
    expect(ids(d, at(12, 0, 2))).toEqual([]);
    expect(buildAlerts(d, undefined, at(10, 0, 4))[0].message).toBe('🔥 No focus session for 2 days. Keep the momentum going!');
  });
});

describe('sortAlerts', () => {
  it('puts time reminders first, then overdue, plan, exam', () => {
    const sorted = sortAlerts([
      { id: 'a', type: 'exam', message: '' }, { id: 'b', type: 'plan', message: '' },
      { id: 'c', type: 'overdue', message: '' }, { id: 'd', type: 'info', message: '' },
    ]).map((x) => x.id);
    expect(sorted).toEqual(['d', 'c', 'b', 'a']);
  });
});
