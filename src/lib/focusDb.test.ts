import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  existing: null as { total_seconds: number } | null,
  readError: null as unknown,
  writeError: null as unknown,
  writes: [] as { table: string; op: string; payload: unknown }[],
  hasRpc: true,
}));

vi.mock('./supabase', () => ({
  get supabase() {
    return {
      ...(h.hasRpc ? { rpc: h.rpc } : {}),
      from: (table: string) => {
        let op = 'select';
        const b: Record<string, unknown> = {
          select: () => b,
          eq: () => b,
          maybeSingle: () => Promise.resolve({ data: h.existing, error: h.readError }),
          update: (p: unknown) => { op = 'update'; h.writes.push({ table, op, payload: p }); return b; },
          insert: (p: unknown) => { op = 'insert'; h.writes.push({ table, op, payload: p }); return b; },
          then: (res: (v: unknown) => unknown) => res({ data: null, error: op === 'select' ? null : h.writeError }),
        };
        return b;
      },
    };
  },
}));

import { addFocusSeconds, logFocus } from './focusDb';

beforeEach(() => {
  h.rpc.mockReset().mockResolvedValue({ data: 1, error: null });
  h.existing = null; h.readError = null; h.writeError = null; h.writes = []; h.hasRpc = true;
});

describe('addFocusSeconds', () => {
  it('uses the atomic database function when it exists', async () => {
    expect(await addFocusSeconds('u1', '2026-11-22', 600)).toBe(true);
    expect(h.rpc).toHaveBeenCalledWith('upsc_focus_add', { p_date: '2026-11-22', p_secs: 600 });
    expect(h.writes).toEqual([]);
  });

  it('does nothing for a zero change', async () => {
    expect(await addFocusSeconds('u1', '2026-11-22', 0)).toBe(true);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['the function returns an error (migration not run)', () => h.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })],
    ['the function call throws', () => h.rpc.mockRejectedValue(new Error('network'))],
    ['the client has no rpc at all', () => { h.hasRpc = false; }],
  ])('falls back to read-then-write when %s', async (_name, arrange) => {
    arrange();
    h.existing = { total_seconds: 3600 };
    expect(await addFocusSeconds('u1', '2026-11-22', 600)).toBe(true);
    expect(h.writes).toEqual([{ table: 'upsc_focus_daily', op: 'update', payload: expect.objectContaining({ total_seconds: 4200 }) }]);
  });

  it('fallback inserts a new day and never stores a negative total', async () => {
    h.hasRpc = false;
    expect(await addFocusSeconds('u1', '2026-11-22', 600)).toBe(true);
    expect(h.writes[0]).toEqual({ table: 'upsc_focus_daily', op: 'insert', payload: { user_id: 'u1', focus_date: '2026-11-22', total_seconds: 600 } });
    h.writes = []; h.existing = { total_seconds: 300 };
    await addFocusSeconds('u1', '2026-11-22', -900);
    expect(h.writes[0]!.payload).toMatchObject({ total_seconds: 0 });
  });

  it('reports failure when the read or the write fails', async () => {
    h.hasRpc = false;
    h.readError = { message: 'rls' };
    expect(await addFocusSeconds('u1', '2026-11-22', 60)).toBe(false);
    h.readError = null; h.writeError = { message: 'rls' };
    expect(await addFocusSeconds('u1', '2026-11-22', 60)).toBe(false);
  });
});

describe('logFocus', () => {
  it('appends one row describing the change', async () => {
    await logFocus('u1', { date: '2026-11-22', seconds: -600, source: 'manual_subtract' });
    expect(h.writes).toEqual([{
      table: 'upsc_focus_log', op: 'insert',
      payload: { user_id: 'u1', focus_date: '2026-11-22', seconds: -600, source: 'manual_subtract', started_at: null, ended_at: null },
    }]);
  });

  it('stores session start and end times', async () => {
    await logFocus('u1', { date: '2026-11-22', seconds: 3600, source: 'timer', startedAt: Date.parse('2026-11-22T10:00:00Z'), endedAt: Date.parse('2026-11-22T11:00:00Z') });
    expect(h.writes[0]!.payload).toMatchObject({ started_at: '2026-11-22T10:00:00.000Z', ended_at: '2026-11-22T11:00:00.000Z', source: 'timer' });
  });

  it('never throws, even if the table is missing', async () => {
    h.writeError = { message: 'relation does not exist' };
    await expect(logFocus('u1', { date: '2026-11-22', seconds: 1, source: 'timer' })).resolves.toBeUndefined();
  });
});
