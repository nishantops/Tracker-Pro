import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  rows: [] as { focus_date: string; total_seconds: number }[],
  user: { id: 'u1' },
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => {
      const b: Record<string, unknown> = {
        select: () => b, eq: () => b, gte: () => b,
        then: (res: (v: unknown) => unknown) => res({ data: h.rows, error: null }),
      };
      return b;
    },
  },
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('../../lib/cloudPrefs', () => ({ loadCloudPref: h.load, saveCloudPref: h.save }));

import { StudyActivity } from './StudyActivity';
import { istToday } from '../../lib/studyStats';

const ymdAgo = (n: number) => new Date(new Date(`${istToday()}T00:00:00Z`).getTime() - n * 86_400_000).toISOString().slice(0, 10);

beforeEach(() => {
  localStorage.clear();
  h.rows = [];
  h.load.mockReset().mockResolvedValue({ ok: true, found: false, value: null });
  h.save.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('StudyActivity', () => {
  it('shows the title, default 4h goal, and an empty state', async () => {
    render(<StudyActivity />);
    expect(screen.getByText('Daily Goal & Study Activity')).toBeInTheDocument();
    expect(screen.getByText('Goal: 4h/day ✎')).toBeInTheDocument();
    expect(await screen.findByText('of 4h')).toBeInTheDocument();
    expect(document.querySelectorAll('.study-cell:not(.empty)').length).toBeGreaterThanOrEqual(84);
  });

  it('shows today vs goal, streak and weekly total from the focus data', async () => {
    h.rows = [
      { focus_date: istToday(), total_seconds: 2 * 3600 },
      { focus_date: ymdAgo(1), total_seconds: 3600 },
      { focus_date: ymdAgo(2), total_seconds: 1800 },
    ];
    render(<StudyActivity />);
    expect(await screen.findByText('2h 0m')).toBeInTheDocument();       // today inside the ring
    expect(screen.getByText('🔥 3')).toBeInTheDocument();                // streak
    expect(screen.getByText('3h 30m')).toBeInTheDocument();             // last 7 days
    expect(document.querySelectorAll('.study-heat .study-cell.lv4, .study-heat .study-cell.lv3, .study-heat .study-cell.lv2, .study-heat .study-cell.lv1').length).toBe(3);
  });

  it('says "Goal met" once today reaches the goal', async () => {
    h.rows = [{ focus_date: istToday(), total_seconds: 4 * 3600 }];
    render(<StudyActivity />);
    expect(await screen.findByText('Goal met ✓')).toBeInTheDocument();
  });

  it('refreshes when a focus session is saved', async () => {
    render(<StudyActivity />);
    await screen.findByText('of 4h');
    h.rows = [{ focus_date: istToday(), total_seconds: 3600 }];
    act(() => { window.dispatchEvent(new Event('upsc-focus-saved')); });
    expect(await screen.findByRole('img', { name: 'Today 1h 0m of 4 hours' })).toBeInTheDocument();
  });

  it('the goal can be changed, is saved locally and to the account, and clamped to 0.5–16h', async () => {
    render(<StudyActivity />);
    fireEvent.click(screen.getByText('Goal: 4h/day ✎'));
    const input = screen.getByLabelText('Daily goal in hours');
    fireEvent.change(input, { target: { value: '6' } });
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText('Goal: 6h/day ✎')).toBeInTheDocument();
    expect(localStorage.getItem('upsc_daily_goal_u1')).toBe('6');
    expect(h.save).toHaveBeenLastCalledWith('u1', 'daily_goal', { hours: 6 });
    fireEvent.click(screen.getByText('Goal: 6h/day ✎'));
    fireEvent.change(screen.getByLabelText('Daily goal in hours'), { target: { value: '99' } });
    fireEvent.keyDown(screen.getByLabelText('Daily goal in hours'), { key: 'Enter' });
    expect(screen.getByText('Goal: 16h/day ✎')).toBeInTheDocument();
  });

  it('Escape cancels editing without changing the goal', () => {
    render(<StudyActivity />);
    fireEvent.click(screen.getByText('Goal: 4h/day ✎'));
    fireEvent.keyDown(screen.getByLabelText('Daily goal in hours'), { key: 'Escape' });
    expect(screen.getByText('Goal: 4h/day ✎')).toBeInTheDocument();
  });

  it('uses the goal saved on another device', async () => {
    h.load.mockResolvedValue({ ok: true, found: true, value: { hours: 7 } });
    render(<StudyActivity />);
    expect(await screen.findByText('Goal: 7h/day ✎')).toBeInTheDocument();
    expect(localStorage.getItem('upsc_daily_goal_u1')).toBe('7');
  });

  it('uploads a locally saved goal if the account has none yet', async () => {
    localStorage.setItem('upsc_daily_goal_u1', '5');
    render(<StudyActivity />);
    await waitFor(() => expect(h.save).toHaveBeenCalledWith('u1', 'daily_goal', { hours: 5 }));
    expect(screen.getByText('Goal: 5h/day ✎')).toBeInTheDocument();
  });

  it('heatmap cells have a date + duration tooltip', async () => {
    h.rows = [{ focus_date: ymdAgo(1), total_seconds: 5400 }];
    render(<StudyActivity />);
    await waitFor(() => expect(document.querySelector(`[title="${ymdAgo(1)} — 1h 30m"]`)).toBeInTheDocument());
  });
});
