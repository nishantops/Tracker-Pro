import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  rows: [] as { focus_date: string; total_seconds: number }[],
  user: { id: 'u1' },
  load: vi.fn(),
  save: vi.fn(),
  writes: [] as { op: string; payload: unknown }[],
  writeError: null as unknown,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => {
      let op = 'select';
      let date = '';
      const b: Record<string, unknown> = {
        select: () => b, eq: (k: string, v: string) => { if (k === 'focus_date') date = v; return b; }, gte: () => b,
        maybeSingle: () => Promise.resolve({ data: h.rows.find((r) => r.focus_date === date) ?? null, error: null }),
        update: (p: unknown) => { op = 'update'; h.writes.push({ op, payload: p }); return b; },
        insert: (p: unknown) => { op = 'insert'; h.writes.push({ op, payload: p }); return b; },
        then: (res: (v: unknown) => unknown) => res(op === 'select' ? { data: h.rows, error: null } : { data: null, error: h.writeError }),
      };
      return b;
    },
  },
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('../../lib/cloudPrefs', () => ({ loadCloudPref: h.load, saveCloudPref: h.save }));

import { StudyActivity } from './StudyActivity';
import { istToday, isWeekend } from '../../lib/studyStats';

const ymdAgo = (n: number) => new Date(new Date(`${istToday()}T00:00:00Z`).getTime() - n * 86_400_000).toISOString().slice(0, 10);

beforeEach(() => {
  localStorage.clear();
  h.rows = [];
  h.writes = [];
  h.writeError = null;
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
    fireEvent.change(screen.getByLabelText('Weekday goal in hours'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Weekend goal in hours'), { target: { value: '6' } });
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText('Goal: 6h/day ✎')).toBeInTheDocument();
    expect(localStorage.getItem('upsc_daily_goal_u1')).toBe('6');
    expect(h.save).toHaveBeenLastCalledWith('u1', 'daily_goal', { hours: 6 });
    fireEvent.click(screen.getByText('Goal: 6h/day ✎'));
    fireEvent.change(screen.getByLabelText('Weekday goal in hours'), { target: { value: '99' } });
    fireEvent.keyDown(screen.getByLabelText('Weekday goal in hours'), { key: 'Enter' });
    expect(screen.getByText('Goal: 16h weekdays · 6h weekends ✎')).toBeInTheDocument();
  });

  it('Escape cancels editing without changing the goal', () => {
    render(<StudyActivity />);
    fireEvent.click(screen.getByText('Goal: 4h/day ✎'));
    fireEvent.keyDown(screen.getByLabelText('Weekday goal in hours'), { key: 'Escape' });
    expect(screen.getByText('Goal: 4h/day ✎')).toBeInTheDocument();
  });

  describe('weekday / weekend goals', () => {
    const setSplit = (wd: string, we: string) => {
      fireEvent.click(screen.getByRole('button', { name: /^Goal:/ }));
      fireEvent.change(screen.getByLabelText('Weekday goal in hours'), { target: { value: wd } });
      fireEvent.change(screen.getByLabelText('Weekend goal in hours'), { target: { value: we } });
      fireEvent.click(screen.getByText('Save'));
    };

    it('saves separate hours locally and to the account', () => {
      render(<StudyActivity />);
      setSplit('3', '6');
      expect(screen.getByText('Goal: 3h weekdays · 6h weekends ✎')).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem('upsc_daily_goal_u1')!)).toEqual({ weekday: 3, weekend: 6 });
      expect(h.save).toHaveBeenLastCalledWith('u1', 'daily_goal', { weekday: 3, weekend: 6 });
    });

    it('the ring uses today\'s goal and heatmap levels use each day\'s own goal', async () => {
      const days = Array.from({ length: 14 }, (_, i) => ymdAgo(i + 1));
      const wkend = days.find((d) => isWeekend(d))!;
      const wkday = days.find((d) => !isWeekend(d))!;
      h.rows = [{ focus_date: wkend, total_seconds: 3 * 3600 }, { focus_date: wkday, total_seconds: 3 * 3600 }];
      render(<StudyActivity />);
      setSplit('3', '6');
      await waitFor(() => expect(document.querySelector(`[title^="${wkday} "]`)).toHaveClass('lv4')); // 3h of 3h
      expect(document.querySelector(`[title^="${wkend} "]`)).toHaveClass('lv3');                       // 3h of 6h
      expect(screen.getByText(`of ${isWeekend(istToday()) ? 6 : 3}h`)).toBeInTheDocument();
    });

    it('reads a split goal from the account and from older single-number storage', async () => {
      h.load.mockResolvedValue({ ok: true, found: true, value: { weekday: 2.5, weekend: 5 } });
      render(<StudyActivity />);
      expect(await screen.findByText('Goal: 2.5h weekdays · 5h weekends ✎')).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem('upsc_daily_goal_u1')!)).toEqual({ weekday: 2.5, weekend: 5 });
    });

    it('ignores corrupt stored goals', () => {
      localStorage.setItem('upsc_daily_goal_u1', '{nope');
      render(<StudyActivity />);
      expect(screen.getByText('Goal: 4h/day ✎')).toBeInTheDocument();
    });
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

  describe('manual study time', () => {
    const open = async () => {
      render(<StudyActivity />);
      await screen.findByText('of 4h');
      fireEvent.click(screen.getByText('+ Add study time'));
    };
    const fill = (hh: string, mm: string) => {
      fireEvent.change(screen.getByLabelText('Hours'), { target: { value: hh } });
      fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: mm } });
    };

    it('inserts a new day total (default date is today) and refreshes', async () => {
      await open();
      expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe(istToday());
      fill('1', '30');
      fireEvent.click(screen.getByText('Add'));
      await waitFor(() => expect(h.writes).toEqual([{ op: 'insert', payload: { user_id: 'u1', focus_date: istToday(), total_seconds: 5400 } }]));
      await waitFor(() => expect(screen.queryByLabelText('Hours')).not.toBeInTheDocument());
    });

    it('adds onto an existing day for a past date', async () => {
      h.rows = [{ focus_date: ymdAgo(2), total_seconds: 3600 }];
      await open();
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: ymdAgo(2) } });
      fill('', '45');
      fireEvent.click(screen.getByText('Add'));
      await waitFor(() => expect(h.writes[0]).toMatchObject({ op: 'update', payload: { total_seconds: 3600 + 2700 } }));
    });

    it('rejects empty, over-24h and future entries without writing', async () => {
      await open();
      fireEvent.click(screen.getByText('Add'));
      expect(screen.getByRole('alert')).toHaveTextContent('between 1 minute and 24 hours');
      fill('25', '0');
      fireEvent.click(screen.getByText('Add'));
      expect(screen.getByRole('alert')).toHaveTextContent('between 1 minute and 24 hours');
      fill('1', '0');
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2999-01-01' } });
      fireEvent.click(screen.getByText('Add'));
      expect(screen.getByRole('alert')).toHaveTextContent('today or an earlier date');
      expect(h.writes).toEqual([]);
    });

    it('shows an error and stays open if saving fails', async () => {
      h.writeError = { message: 'rls' };
      await open();
      fill('1', '0');
      fireEvent.click(screen.getByText('Add'));
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
      expect(screen.getByLabelText('Hours')).toBeInTheDocument();
    });
  });
});
