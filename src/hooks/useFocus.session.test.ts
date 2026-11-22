import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  user: { id: 'u1' },
  db: { upsc_focus_sessions: [] as Row[], upsc_focus_daily: [] as Row[], upsc_focus_log: [] as Row[] } as Record<string, Row[]>,
  deletes: [] as string[],
  cloud: vi.fn(),
  saveCloud: vi.fn(),
}));

vi.mock('../lib/supabase', () => {
  const from = (table: string) => {
    let op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
    let payload: Row = {};
    const filters: [string, unknown][] = [];
    let onlyOpen = false;
    let inserted: Row | null = null;
    const match = (r: Row) => filters.every(([k, v]) => r[k] === v) && (!onlyOpen || r.ended_at == null);
    const rows = () => (h.db[table] ?? []);
    const run = () => {
      const store = h.db[table];
      if (op === 'insert' && store) { inserted = { id: `row${store.length + 1}`, created_at: new Date().toISOString(), ...payload }; store.push(inserted); }
      else if (op === 'update' && store) store.filter(match).forEach((r) => Object.assign(r, payload));
      else if (op === 'delete' && store) {
        h.deletes.push(table);
        h.db[table] = store.filter((r) => !match(r));
      }
      return { data: op === 'select' ? rows().filter(match) : inserted, error: null };
    };
    const b: Record<string, unknown> = {
      select: () => b,
      eq: (k: string, v: unknown) => { filters.push([k, v]); return b; },
      is: () => { onlyOpen = true; return b; },
      order: () => b,
      limit: () => b,
      insert: (p: Row) => { op = 'insert'; payload = p; return b; },
      update: (p: Row) => { op = 'update'; payload = p; return b; },
      delete: () => { op = 'delete'; return b; },
      upsert: () => { op = 'upsert'; return b; },
      single: () => Promise.resolve(run()),
      maybeSingle: () => Promise.resolve({ data: rows().find(match) ?? null, error: null }),
      then: (res: (v: unknown) => unknown) => res(run()),
    };
    return b;
  };
  return { supabase: { from } };
});
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('../lib/cloudPrefs', () => ({ loadCloudPref: h.cloud, saveCloudPref: h.saveCloud }));

import { useFocus } from './useFocus';

const HOUR = 3_600_000;
// 23:00 IST on Mon 2 Nov 2026
const T0 = new Date('2026-11-02T17:30:00Z').getTime();

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const daily = () => h.db.upsc_focus_daily.map((r) => `${r.focus_date}:${r.total_seconds}`);

beforeEach(() => {
  vi.useFakeTimers({ now: T0, toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  h.db.upsc_focus_sessions = [];
  h.db.upsc_focus_daily = [];
  h.db.upsc_focus_log = [];
  h.deletes = [];
  h.cloud.mockReset().mockResolvedValue({ ok: true, found: false, value: null });
  h.saveCloud.mockReset();
  localStorage.clear();
});
afterEach(() => { vi.useRealTimers(); });

describe('useFocus: which day a session belongs to', () => {
  it('a session that starts at 11 PM and ends after midnight is credited to the day it started', async () => {
    const { result } = renderHook(() => useFocus());
    await flush();
    await act(async () => { await result.current.start(); });
    await advance(2.5 * HOUR); // now 01:30 IST on 3 Nov
    await act(async () => { await result.current.stop(); });
    expect(daily()).toEqual(['2026-11-02:9000']);
  });

  it('a session that runs while paused over midnight still belongs to its start day', async () => {
    const { result } = renderHook(() => useFocus());
    await flush();
    await act(async () => { await result.current.start(); });
    await advance(0.5 * HOUR);
    await act(async () => { await result.current.pause(); });
    await advance(3 * HOUR);
    await act(async () => { await result.current.resume(); });
    await advance(0.5 * HOUR);
    await act(async () => { await result.current.stop(); });
    expect(daily()).toEqual(['2026-11-02:3600']);
  });
});

describe('useFocus: only real study time is counted', () => {
  it('pause time is not counted', async () => {
    const { result } = renderHook(() => useFocus());
    await flush();
    await act(async () => { await result.current.start(); });
    await advance(1 * HOUR);
    await act(async () => { await result.current.pause(); });
    expect(result.current.paused).toBe(true);
    await advance(2 * HOUR);
    expect(result.current.elapsed).toBe(3600);
    await act(async () => { await result.current.resume(); });
    await advance(1 * HOUR);
    await act(async () => { await result.current.stop(); });
    expect(daily()).toEqual(['2026-11-02:7200']);
  });

  it('a laptop sleeping with the tab open does not add the sleep time', async () => {
    const { result } = renderHook(() => useFocus());
    await flush();
    await act(async () => { await result.current.start(); });
    await advance(600_000);
    vi.setSystemTime(Date.now() + 3 * HOUR); // slept for 3 hours, no ticks fired
    await advance(1000);
    expect(result.current.elapsed).toBeLessThan(700);
    expect(result.current.elapsed).toBeGreaterThanOrEqual(600);
  });

  it('checkpoints progress to the database while running', async () => {
    const { result } = renderHook(() => useFocus());
    await flush();
    await act(async () => { await result.current.start(); });
    await advance(65_000);
    const row = h.db.upsc_focus_sessions[0]!;
    expect(row.accumulated_seconds).toBeGreaterThanOrEqual(60);
    expect(row.accumulated_seconds).toBeLessThanOrEqual(65);
  });
});

describe('useFocus: coming back to an unstopped session', () => {
  const open = (over: Row) => h.db.upsc_focus_sessions.push({
    id: 'old', user_id: 'u1', ended_at: null, duration_seconds: 0, accumulated_seconds: 0,
    created_at: new Date(T0 - 6 * HOUR).toISOString(), started_at: new Date(T0 - 6 * HOUR).toISOString(), ...over,
  });

  it('a recent checkpoint keeps running without losing a second', async () => {
    open({ started_at: new Date(T0 - 60_000).toISOString(), accumulated_seconds: 600 });
    const { result } = renderHook(() => useFocus());
    await flush();
    expect(result.current.active).toBe(true);
    expect(result.current.paused).toBe(false);
    expect(result.current.elapsed).toBe(660);
  });

  it('a session whose tab was closed for hours comes back paused with only the tracked time', async () => {
    open({ started_at: new Date(T0 - 5 * HOUR).toISOString(), accumulated_seconds: 3600 });
    const { result } = renderHook(() => useFocus());
    await flush();
    expect(result.current.active).toBe(true);
    expect(result.current.paused).toBe(true);
    expect(result.current.elapsed).toBe(3600);
  });

  it('a paused session stays paused after a reload and does not tick', async () => {
    open({ started_at: new Date(T0 - 20_000).toISOString(), accumulated_seconds: 1800, duration_seconds: 1 });
    const { result } = renderHook(() => useFocus());
    await flush();
    expect(result.current.paused).toBe(true);
    await advance(60_000);
    expect(result.current.elapsed).toBe(1800);
  });

  it('a session abandoned for more than a day is closed with its tracked time on the day it began', async () => {
    const created = new Date('2026-10-30T10:00:00Z').toISOString();
    open({ created_at: created, started_at: created, accumulated_seconds: 5400 });
    const { result } = renderHook(() => useFocus());
    await flush();
    expect(result.current.active).toBe(false);
    expect(daily()).toEqual(['2026-10-30:5400']);
    expect(h.db.upsc_focus_sessions).toHaveLength(0);
  });
});

describe('useFocus: clearing history never touches the data', () => {
  it('hides the list but keeps every row in the database and the totals the goal card reads', async () => {
    h.db.upsc_focus_daily = [
      { user_id: 'u1', focus_date: '2026-11-02', total_seconds: 3600 },
      { user_id: 'u1', focus_date: '2026-11-01', total_seconds: 7200 },
    ];
    const { result } = renderHook(() => useFocus());
    await flush();
    expect(result.current.dailyHistory).toHaveLength(2);
    await act(async () => { await result.current.clearHistory(); });
    expect(result.current.dailyHistory).toHaveLength(0);
    expect(result.current.todayTotal).toBe(0);
    expect(h.deletes).not.toContain('upsc_focus_daily');
    expect(h.db.upsc_focus_daily).toHaveLength(2);
    expect(h.saveCloud).toHaveBeenCalledWith('u1', 'focus_cleared', { before: '2026-11-02', secs: 3600 });
  });

  it('time studied after the clear shows up again, earlier days stay hidden', async () => {
    h.db.upsc_focus_daily = [
      { user_id: 'u1', focus_date: '2026-11-02', total_seconds: 3600 },
      { user_id: 'u1', focus_date: '2026-11-01', total_seconds: 7200 },
    ];
    const { result } = renderHook(() => useFocus());
    await flush();
    await act(async () => { await result.current.clearHistory(); });
    await act(async () => { await result.current.start(); });
    await advance(1800_000);
    await act(async () => { await result.current.stop(); });
    expect(result.current.todayTotal).toBe(1800);
    expect(result.current.dailyHistory.map((d) => d.focus_date)).toEqual(['2026-11-02']);
    expect(h.db.upsc_focus_daily.find((r) => r.focus_date === '2026-11-02')!.total_seconds).toBe(3600 + 1800);
  });
});

describe('useFocus: audit log and restoring history', () => {
  it('stop writes one log row with the session length and its real start and end', async () => {
    const { result } = renderHook(() => useFocus());
    await flush();
    await act(async () => { await result.current.start(); });
    await advance(0.5 * HOUR);
    await act(async () => { await result.current.stop(); });
    expect(h.db.upsc_focus_log).toHaveLength(1);
    expect(h.db.upsc_focus_log[0]).toMatchObject({
      user_id: 'u1', focus_date: '2026-11-02', seconds: 1800, source: 'timer',
      started_at: new Date(T0).toISOString(), ended_at: new Date(T0 + 0.5 * HOUR).toISOString(),
    });
  });

  it('an abandoned session that is closed on load is logged as recovered', async () => {
    const created = new Date('2026-10-30T10:00:00Z').toISOString();
    h.db.upsc_focus_sessions.push({ id: 'old', user_id: 'u1', ended_at: null, duration_seconds: 0, accumulated_seconds: 5400, created_at: created, started_at: created });
    renderHook(() => useFocus());
    await flush();
    expect(h.db.upsc_focus_log[0]).toMatchObject({ focus_date: '2026-10-30', seconds: 5400, source: 'recovered' });
  });

  it('restoreHistory shows the cleared list again and syncs that', async () => {
    h.db.upsc_focus_daily = [{ user_id: 'u1', focus_date: '2026-11-01', total_seconds: 7200 }];
    const { result } = renderHook(() => useFocus());
    await flush();
    await act(async () => { await result.current.clearHistory(); });
    expect(result.current.historyHidden).toBe(true);
    expect(result.current.dailyHistory).toHaveLength(0);
    act(() => { result.current.restoreHistory(); });
    expect(result.current.historyHidden).toBe(false);
    expect(result.current.dailyHistory).toHaveLength(1);
    expect(h.saveCloud).toHaveBeenLastCalledWith('u1', 'focus_cleared', {});
    expect(localStorage.getItem('upsc_focus_cleared_u1')).toBeNull();
  });

  it('a cleared marker removed on another device is honoured here', async () => {
    localStorage.setItem('upsc_focus_cleared_u1', JSON.stringify({ before: '2026-11-02', secs: 0 }));
    h.db.upsc_focus_daily = [{ user_id: 'u1', focus_date: '2026-11-01', total_seconds: 7200 }];
    h.cloud.mockResolvedValue({ ok: true, found: true, value: {} });
    const { result } = renderHook(() => useFocus());
    await flush();
    expect(result.current.historyHidden).toBe(false);
    expect(result.current.dailyHistory).toHaveLength(1);
  });
});