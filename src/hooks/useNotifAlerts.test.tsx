import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  plans: [] as unknown[],
  user: { id: 'u1' },
  calls: 0,
}));

vi.mock('../lib/env', () => ({ ENV: { PRELIMS_DATE: 'May 23 2027', MAINS_DATE: 'Aug 20 2027', SUPABASE_URL: '', SUPABASE_ANON_KEY: '' } }));
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      h.calls++;
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        maybeSingle: async () => ({ data: { notif_settings: h.settings }, error: null }),
        then: (res: (v: unknown) => unknown) => res({ data: table === 'upsc_custom_plans' ? h.plans : null, error: null }),
      };
      return b;
    },
  },
}));

import { useNotifAlerts } from './useNotifAlerts';

beforeEach(() => {
  localStorage.clear();
  h.settings = { enabled: true, daily: true, dailyTime: '00:00', prelimsCountdown: false, mainsCountdown: false, streak: false, repeatMinutes: 15 };
  h.plans = [];
  h.calls = 0;
});
afterEach(() => vi.useRealTimers());

const setup = () => renderHook(() => useNotifAlerts(h.user as never, undefined));

describe('useNotifAlerts', () => {
  it('computes due alerts in the background and exposes the repeat interval', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.alerts.map((a) => a.id)).toEqual(['daily_reminder']));
    expect(result.current.repeatMinutes).toBe(15);
  });

  it('dismissing a reminder marks it attended for today (it does not come back)', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.alerts).toHaveLength(1));
    act(() => result.current.dismiss('daily_reminder'));
    expect(result.current.alerts).toHaveLength(0);
    await act(async () => { await result.current.refresh(); });
    expect(result.current.alerts).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('upsc_notif_ack')!).daily_reminder).toBeTruthy();
  });

  it('choosing a snooze duration snoozes instead (even for reminders)', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.alerts).toHaveLength(1));
    act(() => result.current.dismiss('daily_reminder', 4));
    const snoozed = JSON.parse(localStorage.getItem('upsc_snoozed')!);
    expect(snoozed.daily_reminder).toBeGreaterThan(Date.now() + 3 * 3_600_000);
    expect(localStorage.getItem('upsc_notif_ack')).toBeNull();
  });

  it('dismiss-all clears every alert', async () => {
    h.settings = { ...h.settings, evening: true, eveningTime: '00:00' };
    const { result } = setup();
    await waitFor(() => expect(result.current.alerts).toHaveLength(2));
    act(() => result.current.dismissAll());
    expect(result.current.alerts).toHaveLength(0);
  });

  it('re-evaluates every minute without re-querying the database each time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = setup();
    await waitFor(() => expect(result.current.alerts).toHaveLength(1));
    const callsAfterFirst = h.calls;
    await act(async () => { vi.advanceTimersByTime(3 * 60_000); });
    expect(h.calls).toBe(callsAfterFirst);
  });

  it('no alerts and no queries when signed out', () => {
    const { result } = renderHook(() => useNotifAlerts(null, undefined));
    expect(result.current.alerts).toEqual([]);
    expect(h.calls).toBe(0);
  });

  it('the master switch removes everything', async () => {
    h.settings = { ...h.settings, enabled: false };
    const { result } = setup();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.alerts).toEqual([]);
  });
});
