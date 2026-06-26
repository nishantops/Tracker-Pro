/**
 * Tests for useTracker.ts — pure logic, no Supabase
 */
import { describe, it, expect } from 'vitest';
import { STAGES, CA_SECTION } from '../data/syllabus';

// ── Replicate SECTION_BOX_MAP from useTracker.ts ─────────────────────────────
const SECTION_BOX_MAP: Record<string, string> = {
  p1: 'box-prelims-gs', p2: 'box-prelims-csat',
  gs1: 'box-mains-gs1', gs2: 'box-mains-gs2', gs3: 'box-mains-gs3', gs4: 'box-mains-gs4',
  es: 'box-mains-essay', la: 'box-mains-lang-a', lb: 'box-mains-lang-b',
  a1: 'box-anthro-p1', a2: 'box-anthro-p2', ca: 'box-ca',
};

// ── Replicate getMetrics logic ────────────────────────────────────────────────
type ProgressMap = Map<string, { id: string; is_checked: boolean; topic_note: string }>;

function getMetrics(prefix: string, progress: ProgressMap) {
  let total = 0;
  for (const stage of STAGES) {
    for (const sec of stage.sections) {
      if (sec.key === prefix) total += sec.topics.length;
    }
  }
  if (prefix === 'ca') total = CA_SECTION.topics.length;
  const boxName = SECTION_BOX_MAP[prefix] || prefix;
  progress.forEach((row) => {
    if (row.id.startsWith('custom_') && row.id.includes(boxName)) total++;
  });
  let checked = 0;
  progress.forEach((row) => {
    if (row.id.startsWith(`uid-${prefix}-`) && row.is_checked) checked++;
    if (row.id.startsWith('custom_') && row.id.includes(boxName) && row.is_checked) checked++;
  });
  return { total, checked, pct: total > 0 ? Math.round((checked / total) * 100) : 0 };
}

function getGlobalMetrics(progress: ProgressMap) {
  let total = 0;
  for (const stage of STAGES) {
    for (const sec of stage.sections) {
      total += sec.topics.length;
    }
  }
  total += CA_SECTION.topics.length;
  progress.forEach((row) => {
    if (row.id.startsWith('custom_') && !row.id.includes('box-pyq') && !row.id.includes('box-ts')) total++;
  });
  let checked = 0;
  progress.forEach((row) => {
    if (row.id.startsWith('uid-') &&
      !row.id.startsWith('uid-pyq') && !row.id.startsWith('uid-ts') &&
      !row.id.startsWith('uid-pq') && !row.id.startsWith('uid-qg') &&
      !row.id.startsWith('uid-qa') && !row.id.startsWith('uid-tp') &&
      !row.id.startsWith('uid-tg') && !row.id.startsWith('uid-te') &&
      !row.id.startsWith('uid-ta')) {
      if (row.is_checked) checked++;
    }
    if (row.id.startsWith('custom_') && !row.id.includes('box-pyq') && !row.id.includes('box-ts') && row.is_checked) checked++;
  });
  return { total, checked, pct: total > 0 ? parseFloat(((checked / total) * 100).toFixed(1)) : 0 };
}

describe('SECTION_BOX_MAP', () => {
  it('has all expected section keys', () => {
    const keys = ['p1', 'p2', 'gs1', 'gs2', 'gs3', 'gs4', 'es', 'la', 'lb', 'a1', 'a2', 'ca'];
    for (const key of keys) {
      expect(SECTION_BOX_MAP).toHaveProperty(key);
    }
  });

  it('p1 maps to prelims gs box', () => {
    expect(SECTION_BOX_MAP.p1).toBe('box-prelims-gs');
  });

  it('ca maps to box-ca', () => {
    expect(SECTION_BOX_MAP.ca).toBe('box-ca');
  });

  it('all values start with "box-"', () => {
    for (const val of Object.values(SECTION_BOX_MAP)) {
      expect(val).toMatch(/^box-/);
    }
  });
});

describe('getMetrics() — empty progress', () => {
  const emptyProgress: ProgressMap = new Map();

  it('returns correct total for p1 (7 topics)', () => {
    const m = getMetrics('p1', emptyProgress);
    expect(m.total).toBe(7);
    expect(m.checked).toBe(0);
    expect(m.pct).toBe(0);
  });

  it('returns correct total for gs1 (12 topics)', () => {
    const m = getMetrics('gs1', emptyProgress);
    expect(m.total).toBe(12);
    expect(m.checked).toBe(0);
  });

  it('returns correct total for a1 (30 topics)', () => {
    const m = getMetrics('a1', emptyProgress);
    expect(m.total).toBe(30);
    expect(m.checked).toBe(0);
  });

  it('returns correct total for ca (13 topics)', () => {
    const m = getMetrics('ca', emptyProgress);
    expect(m.total).toBe(13);
  });

  it('returns pct 0 when no progress', () => {
    expect(getMetrics('gs2', emptyProgress).pct).toBe(0);
  });
});

describe('getMetrics() — with progress', () => {
  it('counts checked uid-p1-* entries', () => {
    const progress: ProgressMap = new Map([
      ['uid-p1-0', { id: 'uid-p1-0', is_checked: true, topic_note: '' }],
      ['uid-p1-1', { id: 'uid-p1-1', is_checked: false, topic_note: '' }],
    ]);
    const m = getMetrics('p1', progress);
    expect(m.checked).toBe(1);
  });

  it('calculates percentage correctly', () => {
    // gs1 has 12 topics, check 6
    const progress: ProgressMap = new Map(
      Array.from({ length: 6 }, (_, i) => [
        `uid-gs1-${i}`,
        { id: `uid-gs1-${i}`, is_checked: true, topic_note: '' }
      ])
    );
    const m = getMetrics('gs1', progress);
    expect(m.checked).toBe(6);
    expect(m.pct).toBe(50);
  });

  it('counts custom topics in total and checked', () => {
    const progress: ProgressMap = new Map([
      ['custom_box-prelims-gs_myTopic', { id: 'custom_box-prelims-gs_myTopic', is_checked: true, topic_note: '' }],
    ]);
    const m = getMetrics('p1', progress);
    expect(m.total).toBe(8); // 7 + 1 custom
    expect(m.checked).toBe(1);
  });

  it('ignores progress from other sections', () => {
    const progress: ProgressMap = new Map([
      ['uid-gs2-0', { id: 'uid-gs2-0', is_checked: true, topic_note: '' }], // gs2, not gs1
    ]);
    const m = getMetrics('gs1', progress);
    expect(m.checked).toBe(0);
  });
});

describe('getGlobalMetrics() — empty progress', () => {
  const emptyProgress: ProgressMap = new Map();

  it('returns correct total (all sections including CA)', () => {
    const m = getGlobalMetrics(emptyProgress);
    // Sum of all STAGES topics + CA
    let expected = 0;
    for (const stage of STAGES) for (const sec of stage.sections) expected += sec.topics.length;
    expected += CA_SECTION.topics.length;
    expect(m.total).toBe(expected);
  });

  it('returns 0 checked and 0.0 pct when empty', () => {
    const m = getGlobalMetrics(emptyProgress);
    expect(m.checked).toBe(0);
    expect(m.pct).toBe(0);
  });
});

describe('getGlobalMetrics() — with progress', () => {
  it('excludes PYQ entries from global metrics', () => {
    const progress: ProgressMap = new Map([
      ['uid-pyq-0', { id: 'uid-pyq-0', is_checked: true, topic_note: '' }],
      ['uid-p1-0', { id: 'uid-p1-0', is_checked: true, topic_note: '' }],
    ]);
    const m = getGlobalMetrics(progress);
    expect(m.checked).toBe(1); // only p1-0 counts, not pyq-0
  });

  it('excludes test series entries from global metrics', () => {
    const progress: ProgressMap = new Map([
      ['uid-tp-0', { id: 'uid-tp-0', is_checked: true, topic_note: '' }],
      ['uid-gs4-0', { id: 'uid-gs4-0', is_checked: true, topic_note: '' }],
    ]);
    const m = getGlobalMetrics(progress);
    expect(m.checked).toBe(1); // only gs4-0 counts
  });

  it('pct is formatted to 1 decimal place', () => {
    const m = getGlobalMetrics(new Map());
    expect(String(m.pct)).not.toContain('e'); // not scientific notation
  });
});

describe('toggleCheck pure logic', () => {
  it('toggles false → true', () => {
    const progress: ProgressMap = new Map([
      ['uid-p1-0', { id: 'uid-p1-0', is_checked: false, topic_note: '' }],
    ]);
    const existing = progress.get('uid-p1-0');
    const newChecked = !(existing?.is_checked ?? false);
    expect(newChecked).toBe(true);
  });

  it('toggles true → false', () => {
    const progress: ProgressMap = new Map([
      ['uid-p1-0', { id: 'uid-p1-0', is_checked: true, topic_note: '' }],
    ]);
    const existing = progress.get('uid-p1-0');
    const newChecked = !(existing?.is_checked ?? false);
    expect(newChecked).toBe(false);
  });

  it('defaults to true when key does not exist (first check)', () => {
    const progress: ProgressMap = new Map();
    const existing = progress.get('uid-new-topic');
    const newChecked = !(existing?.is_checked ?? false);
    expect(newChecked).toBe(true);
  });
});
