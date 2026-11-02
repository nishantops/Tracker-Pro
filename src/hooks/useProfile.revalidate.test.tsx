import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ rows: [] as unknown[], resolve: null as null | (() => void) }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => {
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        maybeSingle: () => new Promise((res) => {
          const next = h.rows.shift() ?? null;
          res({ data: next, error: null });
        }),
        upsert: async () => ({ error: null }),
      };
      return b;
    },
  },
}));

const user = { id: 'u1', email: 'a@b.c' };
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user }) }));

import { useProfile } from './useProfile';

const row = { user_id: 'u1', display_name: 'Nishant', age: 25, attempt: 3, optional_subject: 'anthropology' };

beforeEach(() => { localStorage.clear(); h.rows = []; });

describe('useProfile loading behaviour', () => {
  it('is loading on first fetch and then finishes with the profile', async () => {
    h.rows = [row];
    const { result } = renderHook(() => useProfile());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile?.display_name).toBe('Nishant');
  });

  it('refetch revalidates silently: no loading flash that would unmount the app', async () => {
    h.rows = [row, { ...row, display_name: 'Updated' }];
    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const states: boolean[] = [];
    let p: Promise<void>;
    act(() => { p = result.current.refetch(); });
    states.push(result.current.loading);
    await act(async () => { await p; });
    states.push(result.current.loading);
    expect(states).toEqual([false, false]);
    expect(result.current.profile?.display_name).toBe('Updated');
  });

  it('serves a cached profile immediately and does not show loading', async () => {
    localStorage.setItem('upsc_profile_u1', JSON.stringify(row));
    h.rows = [row];
    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.profile?.display_name).toBe('Nishant'));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});
