import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ cb: null as null | ((e: string, s: unknown) => void) }));

vi.mock('../lib/supabase', () => {
  const q: unknown = new Proxy({}, {
    get: (_t, p) => (p === 'then'
      ? (res: (v: unknown) => unknown) => res({ data: null, error: null })
      : () => q),
  });
  return {
    supabase: {
      from: () => q,
      auth: {
        getSession: async () => ({ data: { session: null } }),
        onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
          h.cb = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        },
        signOut: vi.fn(),
      },
    },
  };
});

import { AuthProvider, useAuth } from './AuthContext';

const seen: unknown[] = [];
function Probe() {
  const { user } = useAuth();
  seen.push(user);
  return <div>{user ? user.id : 'none'}</div>;
}

const sessionFor = (id: string, extra = {}) => ({ user: { id, email: `${id}@x.y`, ...extra }, access_token: Math.random().toString() });

beforeEach(() => { seen.length = 0; h.cb = null; });

describe('AuthProvider user reference stability (prevents refetch/remount on tab refocus)', () => {
  it('keeps the same user object when the same user is re-announced (SIGNED_IN / TOKEN_REFRESHED)', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(h.cb).not.toBeNull());
    act(() => h.cb!('SIGNED_IN', sessionFor('u1')));
    const first = seen[seen.length - 1];
    expect(first).toMatchObject({ id: 'u1' });
    act(() => h.cb!('TOKEN_REFRESHED', sessionFor('u1')));
    act(() => h.cb!('SIGNED_IN', sessionFor('u1')));
    expect(seen[seen.length - 1]).toBe(first);
  });

  it('replaces the user object on USER_UPDATED', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(h.cb).not.toBeNull());
    act(() => h.cb!('SIGNED_IN', sessionFor('u1')));
    const first = seen[seen.length - 1];
    act(() => h.cb!('USER_UPDATED', sessionFor('u1', { phone: '1' })));
    expect(seen[seen.length - 1]).not.toBe(first);
    expect(seen[seen.length - 1]).toMatchObject({ phone: '1' });
  });

  it('switches to the new user when a different user signs in', async () => {
    const { getByText } = render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(h.cb).not.toBeNull());
    act(() => h.cb!('SIGNED_IN', sessionFor('u1')));
    act(() => h.cb!('SIGNED_IN', sessionFor('u2')));
    expect(getByText('u2')).toBeInTheDocument();
  });

  it('clears the user on SIGNED_OUT', async () => {
    const { getByText } = render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(h.cb).not.toBeNull());
    act(() => h.cb!('SIGNED_IN', sessionFor('u1')));
    act(() => h.cb!('SIGNED_OUT', null));
    expect(getByText('none')).toBeInTheDocument();
  });
});
