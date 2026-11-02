import { describe, it, expect, beforeEach } from 'vitest';
import type { SyllabusStage } from '../data/syllabus';
import { dueRevisions, loadRevisionDone, markRevised, revisionAlertParts } from './revision';
import { buildAlerts, DEFAULT_PREFS } from './notifEngine';
import { STAGES } from '../data/syllabus';

const stages = [{ sections: [{ key: 'pol', label: 'Polity', topics: ['Preamble', 'Fundamental Rights', 'DPSP', 'Parliament'] }] }] as unknown as SyllabusStage[];

const now = new Date(2026, 5, 20, 12, 0, 0);
const daysAgo = (n: number) => new Date(2026, 5, 20 - n, 9, 0, 0).toISOString();

beforeEach(() => localStorage.clear());

describe('dueRevisions', () => {
  it('is not due before 1 day, due on days 1–3, then again at 7 and 30', () => {
    const at = (n: number) => dueRevisions([{ id: 'uid-pol-0', updated_at: daysAgo(n) }], stages, {}, now);
    expect(at(0)).toHaveLength(0);
    expect(at(1)[0]).toMatchObject({ id: 'uid-pol-0', stage: 0, text: 'Preamble' });
    expect(at(3)[0]?.stage).toBe(0);
    expect(at(5)).toHaveLength(0);
    expect(at(7)[0]?.stage).toBe(1);
    expect(at(14)[0]?.stage).toBe(1);
    expect(at(20)).toHaveLength(0);
    expect(at(30)[0]?.stage).toBe(2);
    expect(at(61)).toHaveLength(0);
  });

  it('skips already revised stages', () => {
    const row = { id: 'uid-pol-0', updated_at: daysAgo(2) };
    expect(dueRevisions([row], stages, { 'uid-pol-0': 1 }, now)).toHaveLength(0);
    expect(dueRevisions([{ ...row, updated_at: daysAgo(8) }], stages, { 'uid-pol-0': 1 }, now)[0]?.stage).toBe(1);
    expect(dueRevisions([{ ...row, updated_at: daysAgo(8) }], stages, { 'uid-pol-0': 2 }, now)).toHaveLength(0);
  });

  it('a missed first window moves on to the next stage', () => {
    expect(dueRevisions([{ id: 'uid-pol-1', updated_at: daysAgo(8) }], stages, {}, now)[0]?.stage).toBe(1);
  });

  it('ignores custom/unknown topics and rows without a valid date', () => {
    const rows = [
      { id: 'custom_x', updated_at: daysAgo(2) },
      { id: 'uid-pol-99', updated_at: daysAgo(2) },
      { id: 'uid-pol-0', updated_at: null },
      { id: 'uid-pol-1', updated_at: 'nonsense' },
    ];
    expect(dueRevisions(rows, stages, {}, now)).toEqual([]);
  });

  it('lists the oldest first', () => {
    const rows = [{ id: 'uid-pol-0', updated_at: daysAgo(1) }, { id: 'uid-pol-1', updated_at: daysAgo(3) }];
    expect(dueRevisions(rows, stages, {}, now).map((d) => d.id)).toEqual(['uid-pol-1', 'uid-pol-0']);
  });
});

describe('markRevised', () => {
  it('stores the next stage and never goes backwards', () => {
    markRevised([{ id: 'a', stage: 0 }]);
    expect(loadRevisionDone()).toEqual({ a: 1 });
    markRevised([{ id: 'a', stage: 1 }]);
    markRevised([{ id: 'a', stage: 0 }]);
    expect(loadRevisionDone()).toEqual({ a: 2 });
  });
  it('survives corrupt storage', () => {
    localStorage.setItem('upsc_revision_done', '{nope');
    expect(loadRevisionDone()).toEqual({});
  });
});

describe('revisionAlertParts', () => {
  it('pluralises and abbreviates long lists', () => {
    const d = (t: string) => ({ id: t, text: t, stage: 0, ageDays: 1 });
    expect(revisionAlertParts([d('A')])).toEqual({ message: '🔁 1 topic due for revision', subtext: 'A' });
    const p = revisionAlertParts([d('A'), d('B'), d('C'), d('D'), d('E')]);
    expect(p.message).toBe('🔁 5 topics due for revision');
    expect(p.subtext).toBe('A · B · C · +2 more');
  });
});

describe('buildAlerts — revision', () => {
  const data = (revision: boolean) => ({
    prefs: { ...DEFAULT_PREFS, revision, prelimsCountdown: false, mainsCountdown: false },
    plans: [],
    checked: [{ id: 'uid-polity-0', updated_at: daysAgo(1) }],
  });

  it('does nothing unless the preference is on', () => {
    expect(buildAlerts(data(false), undefined, now).some((a) => a.id === 'revision_due')).toBe(false);
  });

  it('is off by default', () => {
    expect(DEFAULT_PREFS.revision).toBe(false);
  });

  it('emits one aggregated alert carrying the due topics, and respects snooze', () => {
    const key = STAGES[0]!.sections[0]!.key;
    const d = {
      prefs: { ...DEFAULT_PREFS, revision: true, prelimsCountdown: false, mainsCountdown: false },
      plans: [],
      checked: [{ id: `uid-${key}-0`, updated_at: daysAgo(1) }, { id: `uid-${key}-1`, updated_at: daysAgo(2) }],
    };
    const a = buildAlerts(d, undefined, now).find((x) => x.id === 'revision_due');
    expect(a?.message).toBe('🔁 2 topics due for revision');
    expect(a?.revisions).toHaveLength(2);
    localStorage.setItem('upsc_snoozed', JSON.stringify({ revision_due: Date.now() + 60_000 }));
    expect(buildAlerts(d, undefined, now).some((x) => x.id === 'revision_due')).toBe(false);
  });
});
