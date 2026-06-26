/**
 * Tests for PlanDrawer.tsx — pure logic functions extracted for testing
 */
import { describe, it, expect } from 'vitest';

// ── Replicate btoa-based task ID logic from PlanDrawer.tsx ───────────────────

function encodeTaskId(label: string): string {
  return btoa(unescape(encodeURIComponent(label)));
}

function decodeTaskId(encoded: string): string {
  return decodeURIComponent(escape(atob(encoded)));
}

// ── Replicate generateAutoTasks logic ────────────────────────────────────────

interface TaskRow {
  id: string;
  text: string;
  done: boolean;
  note: string;
}

function generateAutoTasks(startDate: string, endDate: string): TaskRow[] {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
  const newTasks: TaskRow[] = [];

  if (days > 60) {
    const current = new Date(start);
    while (current <= end) {
      const monthName = current.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      const label = `Month: ${monthName}`;
      const encoded = btoa(unescape(encodeURIComponent(label)));
      newTasks.push({ id: encoded, text: label, done: false, note: '' });
      current.setMonth(current.getMonth() + 1);
    }
  } else if (days > 13) {
    const current = new Date(start);
    let weekNum = 1;
    while (current <= end) {
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > end) weekEnd.setTime(end.getTime());
      const label = `Week ${weekNum}: ${current.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} → ${weekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
      const encoded = btoa(unescape(encodeURIComponent(label)));
      newTasks.push({ id: encoded, text: label, done: false, note: '' });
      current.setDate(current.getDate() + 7);
      weekNum++;
    }
  } else {
    const current = new Date(start);
    while (current <= end) {
      const label = `Day: ${current.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`;
      const encoded = btoa(unescape(encodeURIComponent(label)));
      newTasks.push({ id: encoded, text: label, done: false, note: '' });
      current.setDate(current.getDate() + 1);
    }
  }
  return newTasks;
}

describe('Task ID encoding (btoa round-trip)', () => {
  it('encodes a simple label to base64', () => {
    const id = encodeTaskId('Week 1: Review');
    expect(id).toBeTruthy();
    expect(id).not.toBe('Week 1: Review');
  });

  it('decodes back to original label', () => {
    const label = 'Week 1: Review';
    const id = encodeTaskId(label);
    expect(decodeTaskId(id)).toBe(label);
  });

  it('handles labels with unicode characters', () => {
    const label = 'Day: Mon, 1 Jan → 7 Jan';
    const id = encodeTaskId(label);
    expect(decodeTaskId(id)).toBe(label);
  });

  it('handles labels with special chars (→ arrow)', () => {
    const label = 'Week 1: 1 Jun → 7 Jun';
    const id = encodeTaskId(label);
    expect(decodeTaskId(id)).toBe(label);
  });

  it('two different labels produce different IDs', () => {
    const id1 = encodeTaskId('Week 1');
    const id2 = encodeTaskId('Week 2');
    expect(id1).not.toBe(id2);
  });

  it('IDs do NOT start with "auto_" (new format)', () => {
    const id = encodeTaskId('Week 1');
    expect(id).not.toMatch(/^auto_/);
  });

  it('legacy auto_ IDs show placeholder text', () => {
    const legacyId = 'auto_1784140200000';
    const decodePart = legacyId.startsWith('auto_') ? '' : legacyId;
    const text = decodePart ? decodeTaskId(decodePart) : '(legacy task — use ⟳ Generate to refresh)';
    expect(text).toBe('(legacy task — use ⟳ Generate to refresh)');
  });
});

describe('generateAutoTasks() — daily (≤13 days)', () => {
  it('generates 7 daily tasks for a 7-day period', () => {
    const tasks = generateAutoTasks('2026-06-01', '2026-06-07');
    expect(tasks).toHaveLength(7);
  });

  it('generates 1 task for a 1-day period', () => {
    const tasks = generateAutoTasks('2026-06-01', '2026-06-01');
    expect(tasks).toHaveLength(1);
  });

  it('generates 13 tasks for 13-day period', () => {
    const tasks = generateAutoTasks('2026-06-01', '2026-06-13');
    expect(tasks).toHaveLength(13);
  });

  it('each task text starts with "Day:"', () => {
    const tasks = generateAutoTasks('2026-06-01', '2026-06-03');
    for (const t of tasks) {
      expect(t.text).toMatch(/^Day:/);
    }
  });

  it('all tasks start as not done', () => {
    const tasks = generateAutoTasks('2026-06-01', '2026-06-03');
    for (const t of tasks) {
      expect(t.done).toBe(false);
    }
  });

  it('all task IDs are base64 decodable back to their text', () => {
    const tasks = generateAutoTasks('2026-06-01', '2026-06-03');
    for (const t of tasks) {
      expect(decodeTaskId(t.id)).toBe(t.text);
    }
  });
});

describe('generateAutoTasks() — weekly (14-60 days)', () => {
  it('generates weekly tasks for a 28-day period (4 weeks)', () => {
    const tasks = generateAutoTasks('2026-06-01', '2026-06-28');
    expect(tasks).toHaveLength(4);
  });

  it('each weekly task text starts with "Week"', () => {
    const tasks = generateAutoTasks('2026-06-01', '2026-06-28');
    for (const t of tasks) {
      expect(t.text).toMatch(/^Week \d/);
    }
  });

  it('weekly task texts contain arrow separator', () => {
    const tasks = generateAutoTasks('2026-06-01', '2026-06-28');
    for (const t of tasks) {
      expect(t.text).toContain('→');
    }
  });

  it('week numbers are sequential starting from 1', () => {
    const tasks = generateAutoTasks('2026-06-01', '2026-06-28');
    expect(tasks[0].text).toContain('Week 1:');
    expect(tasks[1].text).toContain('Week 2:');
    expect(tasks[2].text).toContain('Week 3:');
    expect(tasks[3].text).toContain('Week 4:');
  });

  it('all task IDs decode back to their text', () => {
    const tasks = generateAutoTasks('2026-06-01', '2026-06-28');
    for (const t of tasks) {
      expect(decodeTaskId(t.id)).toBe(t.text);
    }
  });
});

describe('generateAutoTasks() — monthly (>60 days)', () => {
  it('generates monthly tasks for a 90-day period (~3 months)', () => {
    const tasks = generateAutoTasks('2026-06-01', '2026-08-31');
    expect(tasks).toHaveLength(3);
  });

  it('each monthly task text starts with "Month:"', () => {
    const tasks = generateAutoTasks('2026-06-01', '2026-08-31');
    for (const t of tasks) {
      expect(t.text).toMatch(/^Month:/);
    }
  });

  it('all task IDs decode back to their text in monthly mode', () => {
    const tasks = generateAutoTasks('2026-06-01', '2026-08-31');
    for (const t of tasks) {
      expect(decodeTaskId(t.id)).toBe(t.text);
    }
  });
});

describe('DrawerTab initial state logic', () => {
  it('content_type="tables" sets initial tab to "table"', () => {
    const plan = { content_type: 'tables' };
    const initialTab = plan.content_type === 'tables' ? 'table' : 'tasks';
    expect(initialTab).toBe('table');
  });

  it('content_type="tasks" sets initial tab to "tasks"', () => {
    const plan = { content_type: 'tasks' };
    const initialTab = plan.content_type === 'tables' ? 'table' : 'tasks';
    expect(initialTab).toBe('tasks');
  });

  it('content_type="both" sets initial tab to "tasks"', () => {
    const plan = { content_type: 'both' };
    const initialTab = plan.content_type === 'tables' ? 'table' : 'tasks';
    expect(initialTab).toBe('tasks');
  });

  it('undefined content_type defaults to "tasks"', () => {
    const plan = {};
    const ct = (plan as Record<string, string>).content_type;
    const initialTab = ct === 'tables' ? 'table' : 'tasks';
    expect(initialTab).toBe('tasks');
  });
});

describe('PLAN label maps in PlanDrawer', () => {
  const PLAN_CAT_LABELS: Record<string, string> = {
    common: 'Common', gs1: 'GS 1', gs2: 'GS 2', gs3: 'GS 3', gs4: 'GS 4',
    essay: 'Essay', optional: 'Optional', custom: 'Custom',
  };
  const PLAN_TYPE_LABELS: Record<string, string> = {
    weekly: 'Weekly Sprint', monthly: 'Monthly',
    custom_block: 'Custom Block', daily: 'Daily Target',
  };
  const PLAN_DIV_LABELS: Record<string, string> = {
    both: 'P + M', prelims: 'Prelims', mains: 'Mains',
  };

  it('gs1 → GS 1 (not GS-I)', () => expect(PLAN_CAT_LABELS.gs1).toBe('GS 1'));
  it('weekly → Weekly Sprint', () => expect(PLAN_TYPE_LABELS.weekly).toBe('Weekly Sprint'));
  it('both → P + M', () => expect(PLAN_DIV_LABELS.both).toBe('P + M'));
  it('custom_block → Custom Block', () => expect(PLAN_TYPE_LABELS.custom_block).toBe('Custom Block'));
});
