/**
 * Tests for usePlans.ts label maps and utility functions
 * Hooks themselves require Supabase mocking — tested via pure exports
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PLAN_CAT_LABELS,
  PLAN_DIV_LABELS,
  PLAN_TYPE_LABELS,
  PLAN_CAT_COLORS,
  PLAN_CAT_ORDER,
  daysLeft,
} from './usePlans';

describe('PLAN_CAT_LABELS', () => {
  it('has 8 entries', () => {
    expect(Object.keys(PLAN_CAT_LABELS)).toHaveLength(8);
  });

  it('common maps to "Common"', () => expect(PLAN_CAT_LABELS.common).toBe('Common'));
  it('gs1 maps to "GS 1" (old app format)', () => expect(PLAN_CAT_LABELS.gs1).toBe('GS 1'));
  it('gs2 maps to "GS 2"', () => expect(PLAN_CAT_LABELS.gs2).toBe('GS 2'));
  it('gs3 maps to "GS 3"', () => expect(PLAN_CAT_LABELS.gs3).toBe('GS 3'));
  it('gs4 maps to "GS 4"', () => expect(PLAN_CAT_LABELS.gs4).toBe('GS 4'));
  it('essay maps to "Essay"', () => expect(PLAN_CAT_LABELS.essay).toBe('Essay'));
  it('optional maps to "Optional"', () => expect(PLAN_CAT_LABELS.optional).toBe('Optional'));
  it('custom maps to "Custom"', () => expect(PLAN_CAT_LABELS.custom).toBe('Custom'));

  it('does NOT have "GS-I" style labels (old bug)', () => {
    const values = Object.values(PLAN_CAT_LABELS);
    expect(values.every(v => !v.includes('-'))).toBe(true);
  });
});

describe('PLAN_DIV_LABELS', () => {
  it('has 3 entries', () => {
    expect(Object.keys(PLAN_DIV_LABELS)).toHaveLength(3);
  });

  it('both maps to "Prelims + Mains"', () => expect(PLAN_DIV_LABELS.both).toBe('Prelims + Mains'));
  it('prelims maps to "Prelims Only"', () => expect(PLAN_DIV_LABELS.prelims).toBe('Prelims Only'));
  it('mains maps to "Mains Only"', () => expect(PLAN_DIV_LABELS.mains).toBe('Mains Only'));

  it('keys are lowercase (matching DB values)', () => {
    for (const key of Object.keys(PLAN_DIV_LABELS)) {
      expect(key).toBe(key.toLowerCase());
    }
  });
});

describe('PLAN_TYPE_LABELS', () => {
  it('has 4 entries', () => {
    expect(Object.keys(PLAN_TYPE_LABELS)).toHaveLength(4);
  });

  it('weekly maps to "Weekly Sprint"', () => expect(PLAN_TYPE_LABELS.weekly).toBe('Weekly Sprint'));
  it('monthly maps to "Monthly"', () => expect(PLAN_TYPE_LABELS.monthly).toBe('Monthly'));
  it('custom_block maps to "Custom Block"', () => expect(PLAN_TYPE_LABELS.custom_block).toBe('Custom Block'));
  it('daily maps to "Daily Target"', () => expect(PLAN_TYPE_LABELS.daily).toBe('Daily Target'));

  it('keys are DB-compatible (lowercase with underscore)', () => {
    for (const key of Object.keys(PLAN_TYPE_LABELS)) {
      expect(key).toMatch(/^[a-z_]+$/);
    }
  });

  it('does NOT use old "Sprint/Revision/Test/Custom" values', () => {
    const keys = Object.keys(PLAN_TYPE_LABELS);
    expect(keys).not.toContain('Sprint');
    expect(keys).not.toContain('Revision');
    expect(keys).not.toContain('Test');
    expect(keys).not.toContain('Custom');
  });
});

describe('PLAN_CAT_ORDER', () => {
  it('has entries for 8 categories', () => {
    expect(Object.keys(PLAN_CAT_ORDER)).toHaveLength(8);
  });

  it('gs1 has highest priority (1)', () => expect(PLAN_CAT_ORDER.gs1).toBe(1));
  it('gs2 is priority 2', () => expect(PLAN_CAT_ORDER.gs2).toBe(2));
  it('gs3 is priority 3', () => expect(PLAN_CAT_ORDER.gs3).toBe(3));
  it('gs4 is priority 4', () => expect(PLAN_CAT_ORDER.gs4).toBe(4));
  it('essay is priority 5', () => expect(PLAN_CAT_ORDER.essay).toBe(5));
  it('optional is priority 6', () => expect(PLAN_CAT_ORDER.optional).toBe(6));
  it('common is priority 7', () => expect(PLAN_CAT_ORDER.common).toBe(7));
  it('custom is priority 8', () => expect(PLAN_CAT_ORDER.custom).toBe(8));

  it('gs papers are ordered before common/custom', () => {
    expect(PLAN_CAT_ORDER.gs1).toBeLessThan(PLAN_CAT_ORDER.common);
    expect(PLAN_CAT_ORDER.gs4).toBeLessThan(PLAN_CAT_ORDER.common);
  });
});

describe('PLAN_CAT_COLORS', () => {
  it('has entries for all 8 categories', () => {
    const cats = ['common', 'gs1', 'gs2', 'gs3', 'gs4', 'essay', 'optional', 'custom'];
    for (const cat of cats) {
      expect(PLAN_CAT_COLORS).toHaveProperty(cat);
    }
  });

  it('all colors are valid hex strings', () => {
    for (const color of Object.values(PLAN_CAT_COLORS)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('common is indigo/violet', () => {
    expect(PLAN_CAT_COLORS.common).toContain('#6366');
  });

  it('optional is fuchsia/pink', () => {
    expect(PLAN_CAT_COLORS.optional).toContain('#d946ef');
  });
});

describe('daysLeft()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when endDate is null', () => {
    expect(daysLeft(null)).toBeNull();
  });

  it('returns null when endDate is empty string', () => {
    expect(daysLeft('')).toBeNull();
  });

  it('returns "Xd left" with days-ok class for future dates > 7 days', () => {
    vi.setSystemTime(new Date('2026-06-01'));
    const result = daysLeft('2026-07-01');
    expect(result).not.toBeNull();
    expect(result!.label).toMatch(/d left/);
    expect(result!.cls).toBe('days-ok');
  });

  it('returns "Xd left" with days-warn class for ≤ 7 days away', () => {
    vi.setSystemTime(new Date('2026-06-25'));
    const result = daysLeft('2026-06-30');
    expect(result).not.toBeNull();
    expect(result!.label).toMatch(/d left/);
    expect(result!.cls).toBe('days-warn');
  });

  it('returns "Due today" when endDate is today', () => {
    vi.setSystemTime(new Date('2026-06-25T12:00:00'));
    const result = daysLeft('2026-06-25');
    expect(result).not.toBeNull();
    expect(result!.label).toBe('Due today');
    expect(result!.cls).toBe('days-warn');
  });

  it('returns "Xd over" with days-over class for past dates', () => {
    vi.setSystemTime(new Date('2026-07-01'));
    const result = daysLeft('2026-06-20');
    expect(result).not.toBeNull();
    expect(result!.label).toMatch(/d over/);
    expect(result!.cls).toBe('days-over');
  });

  it('shows exact day count for future dates', () => {
    vi.setSystemTime(new Date('2026-06-01T00:00:00'));
    const result = daysLeft('2026-06-11');
    expect(result!.label).toBe('10d left');
  });

  it('shows exact day count for past dates', () => {
    vi.setSystemTime(new Date('2026-06-11T00:00:00'));
    const result = daysLeft('2026-06-01');
    expect(result!.label).toBe('10d over');
  });

  it('1 day left is days-warn', () => {
    vi.setSystemTime(new Date('2026-06-24T00:00:00'));
    const result = daysLeft('2026-06-25');
    expect(result!.cls).toBe('days-warn');
  });

  it('7 days left is days-warn boundary', () => {
    vi.setSystemTime(new Date('2026-06-18T00:00:00'));
    const result = daysLeft('2026-06-25');
    expect(result!.cls).toBe('days-warn');
  });

  it('8 days left is days-ok', () => {
    vi.setSystemTime(new Date('2026-06-17T00:00:00'));
    const result = daysLeft('2026-06-25');
    expect(result!.cls).toBe('days-ok');
  });
});
