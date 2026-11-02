import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as unknown },
  upsert: vi.fn(async () => ({ error: null })),
  throwOnSelect: false,
  filters: [] as [string, unknown][],
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => {
        const b: Record<string, unknown> = {
          eq: (k: string, v: unknown) => { h.filters.push([k, v]); return b; },
          maybeSingle: async () => { if (h.throwOnSelect) throw new Error('boom'); return h.result; },
        };
        return b;
      },
      upsert: h.upsert,
    }),
  },
}));

import { loadCloudPref, saveCloudPref } from './cloudPrefs';

beforeEach(() => {
  h.result = { data: null, error: null };
  h.throwOnSelect = false;
  h.filters = [];
  h.upsert.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('loadCloudPref', () => {
  it('returns the stored value for the user and key', async () => {
    h.result = { data: { value: { x: 1 } }, error: null };
    const r = await loadCloudPref<{ x: number }>('u1', 'sw_geom');
    expect(r).toEqual({ ok: true, found: true, value: { x: 1 } });
    expect(h.filters).toEqual([['user_id', 'u1'], ['pref_key', 'sw_geom']]);
  });

  it('reports "not found" without an error when there is no row', async () => {
    expect(await loadCloudPref('u1', 'k')).toEqual({ ok: true, found: false, value: null });
  });

  it('reports not-ok (never throws) when the table is missing or the call fails', async () => {
    h.result = { data: null, error: { message: 'relation does not exist' } };
    expect(await loadCloudPref('u1', 'k')).toEqual({ ok: false, found: false, value: null });
    h.throwOnSelect = true;
    expect(await loadCloudPref('u1', 'k')).toEqual({ ok: false, found: false, value: null });
  });
});

describe('saveCloudPref', () => {
  it('debounces rapid saves of the same key into one upsert with the last value', async () => {
    vi.useFakeTimers();
    saveCloudPref('u1', 'pie_size', { w: 1, h: 1 });
    saveCloudPref('u1', 'pie_size', { w: 2, h: 2 });
    saveCloudPref('u1', 'pie_size', { w: 3, h: 3 });
    expect(h.upsert).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(700);
    expect(h.upsert).toHaveBeenCalledTimes(1);
    const [row, opts] = h.upsert.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>];
    expect(row).toMatchObject({ user_id: 'u1', pref_key: 'pie_size', value: { w: 3, h: 3 } });
    expect(opts).toEqual({ onConflict: 'user_id,pref_key' });
  });

  it('different keys save independently', async () => {
    vi.useFakeTimers();
    saveCloudPref('u1', 'a', 1);
    saveCloudPref('u1', 'b', 2);
    await vi.advanceTimersByTimeAsync(700);
    expect(h.upsert).toHaveBeenCalledTimes(2);
  });

  it('swallows save errors', async () => {
    vi.useFakeTimers();
    h.upsert.mockRejectedValueOnce(new Error('offline'));
    saveCloudPref('u1', 'k', 1);
    await expect(vi.advanceTimersByTimeAsync(700)).resolves.not.toThrow();
  });
});
