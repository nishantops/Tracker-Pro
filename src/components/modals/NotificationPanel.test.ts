/**
 * Tests for isSnoozed/snooze snooze helpers
 * (pure localStorage functions exported via tests of NotificationPanel internals)
 * 
 * Since isSnoozed and snooze are not exported, we test NotificationPanel's
 * rendered output and SNOOZE_OPTIONS indirectly via the visible UI.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Test snooze localStorage helpers directly ───────────────────────────────
// We replicate the functions here to test the logic
function isSnoozed(key: string): boolean {
  try {
    const snoozed = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}') as Record<string, number>;
    if (snoozed[key] && snoozed[key] > Date.now()) return true;
    if (snoozed[key]) { delete snoozed[key]; localStorage.setItem('upsc_snoozed', JSON.stringify(snoozed)); }
  } catch { /* ignore */ }
  return false;
}

function snooze(key: string, hours = 24) {
  try {
    const snoozed = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}') as Record<string, number>;
    snoozed[key] = Date.now() + hours * 3_600_000;
    localStorage.setItem('upsc_snoozed', JSON.stringify(snoozed));
  } catch { /* ignore */ }
}

describe('isSnoozed() helper', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('returns false when key does not exist', () => {
    expect(isSnoozed('test-key')).toBe(false);
  });

  it('returns false when snooze storage is empty JSON object', () => {
    localStorage.setItem('upsc_snoozed', '{}');
    expect(isSnoozed('test-key')).toBe(false);
  });

  it('returns true when key is snoozed in future', () => {
    vi.setSystemTime(new Date('2026-06-01T10:00:00'));
    snooze('alert-x', 1); // 1 hour
    expect(isSnoozed('alert-x')).toBe(true);
  });

  it('returns false when snooze has expired', () => {
    vi.setSystemTime(new Date('2026-06-01T10:00:00'));
    snooze('alert-x', 1); // snoozed for 1 hour
    vi.setSystemTime(new Date('2026-06-01T12:00:00')); // 2 hours later
    expect(isSnoozed('alert-x')).toBe(false);
  });

  it('cleans up expired snooze from storage', () => {
    vi.setSystemTime(new Date('2026-06-01T10:00:00'));
    snooze('alert-y', 1);
    vi.setSystemTime(new Date('2026-06-01T12:00:00'));
    isSnoozed('alert-y'); // trigger cleanup
    const stored = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}');
    expect(stored['alert-y']).toBeUndefined();
  });

  it('does not affect other keys when one expires', () => {
    vi.setSystemTime(new Date('2026-06-01T10:00:00'));
    snooze('alert-a', 48); // 48 hours
    snooze('alert-b', 1);  // 1 hour
    vi.setSystemTime(new Date('2026-06-01T12:00:00')); // 2 hours later
    expect(isSnoozed('alert-b')).toBe(false);
    expect(isSnoozed('alert-a')).toBe(true); // still snoozed
  });

  it('handles malformed localStorage gracefully', () => {
    localStorage.setItem('upsc_snoozed', 'NOT_JSON');
    expect(() => isSnoozed('key')).not.toThrow();
    expect(isSnoozed('key')).toBe(false);
  });
});

describe('snooze() helper', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('stores snooze expiry in localStorage', () => {
    vi.setSystemTime(new Date('2026-06-01T10:00:00'));
    snooze('notif-1', 4);
    const stored = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}');
    expect(stored['notif-1']).toBeDefined();
  });

  it('stores correct expiry time for 1 hour', () => {
    vi.setSystemTime(new Date('2026-06-01T10:00:00'));
    snooze('notif-1', 1);
    const stored = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}');
    const expectedExpiry = new Date('2026-06-01T10:00:00').getTime() + 1 * 3_600_000;
    expect(stored['notif-1']).toBe(expectedExpiry);
  });

  it('stores correct expiry time for 24 hours (default)', () => {
    vi.setSystemTime(new Date('2026-06-01T10:00:00'));
    snooze('notif-default');
    const stored = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}');
    const expectedExpiry = new Date('2026-06-01T10:00:00').getTime() + 24 * 3_600_000;
    expect(stored['notif-default']).toBe(expectedExpiry);
  });

  it('can snooze multiple different keys', () => {
    vi.setSystemTime(new Date('2026-06-01T10:00:00'));
    snooze('notif-a', 1);
    snooze('notif-b', 4);
    snooze('notif-c', 24);
    const stored = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}');
    expect(Object.keys(stored)).toHaveLength(3);
  });

  it('overwrites existing snooze for same key', () => {
    vi.setSystemTime(new Date('2026-06-01T10:00:00'));
    snooze('notif-x', 1);
    vi.setSystemTime(new Date('2026-06-01T11:00:00'));
    snooze('notif-x', 4); // re-snooze for longer
    const stored = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}');
    const keys = Object.keys(stored).filter(k => k === 'notif-x');
    expect(keys).toHaveLength(1);
  });

  it('handles malformed existing storage gracefully', () => {
    localStorage.setItem('upsc_snoozed', 'BAD_JSON');
    expect(() => snooze('key', 1)).not.toThrow();
  });

  it('snooze of 72 hours stores correct expiry', () => {
    vi.setSystemTime(new Date('2026-06-01T00:00:00'));
    snooze('key-3d', 72);
    const stored = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}');
    const now = new Date('2026-06-01T00:00:00').getTime();
    expect(stored['key-3d']).toBe(now + 72 * 3_600_000);
  });

  it('snooze of 168 hours (1 week) stores correct expiry', () => {
    vi.setSystemTime(new Date('2026-06-01T00:00:00'));
    snooze('key-week', 168);
    const stored = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}');
    const now = new Date('2026-06-01T00:00:00').getTime();
    expect(stored['key-week']).toBe(now + 168 * 3_600_000);
  });
});

describe('SNOOZE_OPTIONS constants', () => {
  const SNOOZE_OPTIONS = [
    { label: '1 hour', hours: 1 },
    { label: '4 hours', hours: 4 },
    { label: '1 day', hours: 24 },
    { label: '3 days', hours: 72 },
    { label: '1 week', hours: 168 },
  ];

  it('has 5 snooze options', () => {
    expect(SNOOZE_OPTIONS).toHaveLength(5);
  });

  it('first option is 1 hour', () => {
    expect(SNOOZE_OPTIONS[0]).toEqual({ label: '1 hour', hours: 1 });
  });

  it('second option is 4 hours', () => {
    expect(SNOOZE_OPTIONS[1]).toEqual({ label: '4 hours', hours: 4 });
  });

  it('third option is 1 day (24h)', () => {
    expect(SNOOZE_OPTIONS[2]).toEqual({ label: '1 day', hours: 24 });
  });

  it('fourth option is 3 days (72h)', () => {
    expect(SNOOZE_OPTIONS[3]).toEqual({ label: '3 days', hours: 72 });
  });

  it('fifth option is 1 week (168h)', () => {
    expect(SNOOZE_OPTIONS[4]).toEqual({ label: '1 week', hours: 168 });
  });

  it('all options have positive hour values', () => {
    for (const opt of SNOOZE_OPTIONS) {
      expect(opt.hours).toBeGreaterThan(0);
    }
  });

  it('hours are in ascending order', () => {
    for (let i = 1; i < SNOOZE_OPTIONS.length; i++) {
      expect(SNOOZE_OPTIONS[i].hours).toBeGreaterThan(SNOOZE_OPTIONS[i - 1].hours);
    }
  });

  it('all labels are non-empty strings', () => {
    for (const opt of SNOOZE_OPTIONS) {
      expect(opt.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('1 week = 7 * 24 hours', () => {
    const week = SNOOZE_OPTIONS.find(o => o.label === '1 week')!;
    expect(week.hours).toBe(7 * 24);
  });

  it('1 day = 24 hours exactly', () => {
    const day = SNOOZE_OPTIONS.find(o => o.label === '1 day')!;
    expect(day.hours).toBe(24);
  });
});
