import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  tables: {} as Record<string, { select?: unknown; error?: unknown; upsertError?: unknown; updateError?: unknown }>,
  calls: [] as { table: string; op: string; payload?: unknown }[],
  toast: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const t = h.tables[table] ?? {};
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: t.select ?? null, error: t.error ?? null }),
        upsert: async (payload: unknown) => { h.calls.push({ table, op: 'upsert', payload }); return { error: t.upsertError ?? null }; },
        update: (payload: unknown) => ({
          eq: async () => { h.calls.push({ table, op: 'update', payload }); return { error: t.updateError ?? null }; },
        }),
      };
      return builder;
    },
  },
}));
const stableUser = vi.hoisted(() => ({ id: 'u1' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: stableUser }) }));
vi.mock('../common/Toast', () => ({ useToast: () => ({ showToast: h.toast }) }));

import { SWWidget } from './SWWidget';

beforeEach(() => {
  h.tables = {};
  h.calls = [];
  h.toast.mockClear();
  localStorage.clear();
});

describe('SWWidget — load', () => {
  it('shows saved strengths and weaknesses from upsc_user_sw', async () => {
    h.tables.upsc_user_sw = { select: { strengths: [{ id: 's1', text: 'Polity', ts: 1 }], weaknesses: [{ id: 'w1', text: 'Maths', ts: 2 }], show_sw: true } };
    render(<SWWidget />);
    expect(await screen.findByText('Polity')).toBeInTheDocument();
    expect(screen.getByText('Maths')).toBeInTheDocument();
    expect(screen.getByText(/STRENGTHS/)).toBeInTheDocument();
    expect(screen.getByText(/WEAKNESSES/)).toBeInTheDocument();
  });

  it('falls back to the legacy profile_data copy when the new table has no row', async () => {
    h.tables.upsc_user_profiles = { select: { profile_data: { strengths: [{ id: 's', text: 'Legacy strength', ts: 1 }], weaknesses: [], show_sw: true } } };
    render(<SWWidget />);
    expect(await screen.findByText('Legacy strength')).toBeInTheDocument();
  });

  it('renders instantly from the local cache', () => {
    localStorage.setItem('upsc_sw_u1', JSON.stringify({ strengths: [{ id: 'c', text: 'Cached', ts: 1 }], weaknesses: [], show_sw: true }));
    render(<SWWidget />);
    expect(screen.getByText('Cached')).toBeInTheDocument();
  });

  it('hides itself when show_sw is false', async () => {
    h.tables.upsc_user_sw = { select: { strengths: [], weaknesses: [], show_sw: false } };
    const { container } = render(<SWWidget />);
    await waitFor(() => expect(container.querySelector('#sw-widget')).toBeNull());
  });
});

describe('SWWidget — save', () => {
  it('delete writes to upsc_user_sw, mirrors to profile_data, and updates the local cache', async () => {
    h.tables.upsc_user_sw = { select: { strengths: [{ id: 's1', text: 'Polity', ts: 1 }], weaknesses: [], show_sw: true } };
    h.tables.upsc_user_profiles = { select: { profile_data: { other: 'keep-me' } } };
    render(<SWWidget />);
    await screen.findByText('Polity');
    fireEvent.click(screen.getByTitle('Remove'));
    await waitFor(() => expect(h.calls.some((c) => c.table === 'upsc_user_sw' && c.op === 'upsert')).toBe(true));
    const sw = h.calls.find((c) => c.table === 'upsc_user_sw')!.payload as Record<string, unknown>;
    expect(sw).toMatchObject({ user_id: 'u1', strengths: [], weaknesses: [], show_sw: true });
    await waitFor(() => expect(h.calls.some((c) => c.table === 'upsc_user_profiles' && c.op === 'update')).toBe(true));
    const legacy = h.calls.find((c) => c.table === 'upsc_user_profiles')!.payload as { profile_data: Record<string, unknown> };
    expect(legacy.profile_data).toMatchObject({ other: 'keep-me', strengths: [], weaknesses: [] });
    expect(JSON.parse(localStorage.getItem('upsc_sw_u1')!)).toMatchObject({ strengths: [] });
    expect(h.toast).not.toHaveBeenCalled();
  });

  it('toggling visibility saves show_sw', async () => {
    h.tables.upsc_user_sw = { select: { strengths: [], weaknesses: [], show_sw: true } };
    render(<SWWidget />);
    const toggle = await screen.findByRole('checkbox');
    fireEvent.click(toggle);
    await waitFor(() => {
      const c = h.calls.find((x) => x.table === 'upsc_user_sw');
      expect((c?.payload as Record<string, unknown>)?.show_sw).toBe(false);
    });
  });

  it('shows an error toast only when both the new table and the legacy copy fail', async () => {
    h.tables.upsc_user_sw = { select: { strengths: [{ id: 's1', text: 'Polity', ts: 1 }], weaknesses: [], show_sw: true }, upsertError: { message: 'nope' } };
    h.tables.upsc_user_profiles = { select: { profile_data: {} }, updateError: { message: 'nope2' } };
    render(<SWWidget />);
    await screen.findByText('Polity');
    fireEvent.click(screen.getByTitle('Remove'));
    await waitFor(() => expect(h.toast).toHaveBeenCalledTimes(1));
    expect(h.toast.mock.calls[0][1]).toBe('error');
    expect(localStorage.getItem('upsc_sw_u1')).toBeTruthy();
  });

  it('stays silent when only the new table fails but the legacy copy saves', async () => {
    h.tables.upsc_user_sw = { select: { strengths: [{ id: 's1', text: 'Polity', ts: 1 }], weaknesses: [], show_sw: true }, upsertError: { message: 'nope' } };
    h.tables.upsc_user_profiles = { select: { profile_data: {} } };
    render(<SWWidget />);
    await screen.findByText('Polity');
    fireEvent.click(screen.getByTitle('Remove'));
    await waitFor(() => expect(h.calls.some((c) => c.table === 'upsc_user_profiles')).toBe(true));
    expect(h.toast).not.toHaveBeenCalled();
  });
});

describe('SWWidget — manager', () => {
  it('opens from the Manage button and adds a strength through Save', async () => {
    h.tables.upsc_user_sw = { select: { strengths: [], weaknesses: [], show_sw: true } };
    render(<SWWidget />);
    fireEvent.click(await screen.findByText(/Manage/));
    const input = await screen.findByPlaceholderText(/Describe your strength or weakness/);
    fireEvent.change(input, { target: { value: 'Ethics case studies' } });
    fireEvent.click(screen.getAllByText('+ Add').find((b) => b.tagName === 'BUTTON' && b.closest('div[style*="position: relative"]'))!);
    expect(await screen.findAllByText('Ethics case studies')).not.toHaveLength(0);
  });

  it('opens when externalOpen is set', async () => {
    h.tables.upsc_user_sw = { select: { strengths: [], weaknesses: [], show_sw: true } };
    const onClose = vi.fn();
    render(<SWWidget externalOpen onExternalClose={onClose} />);
    expect(await screen.findByPlaceholderText(/Describe your strength or weakness/)).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });
});
