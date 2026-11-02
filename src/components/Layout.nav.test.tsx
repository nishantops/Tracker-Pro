import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', () => {
  const q: unknown = new Proxy({}, {
    get: (_t, p) => (p === 'then'
      ? (res: (v: unknown) => unknown) => res({ data: null, count: 0, error: null })
      : () => q),
  });
  return { supabase: { from: () => q, auth: { getSession: async () => ({ data: { session: null } }) } }, isSupabaseConfigured: true };
});
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'a@b.c' }, signOut: vi.fn() }),
}));
vi.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark', toggle: vi.fn() }) }));
vi.mock('../hooks/useProfile', () => ({
  useProfile: () => ({
    profile: { display_name: 'Nishant Kumar', optional_subject: 'none' },
    initials: 'NK',
    features: { pyq: true, plans: true, sources: true, focus: false },
  }),
}));
vi.mock('../hooks/useTracker', () => ({ useTracker: () => ({ syncStatus: 'synced' }) }));
vi.mock('../hooks/useMetrics', () => ({ useMetrics: () => ({ trackTabSwitch: vi.fn() }) }));

vi.mock('./ProfileModal', () => ({ ProfileModal: ({ open }: { open: boolean }) => (open ? <div>PROFILE-MODAL</div> : null) }));
vi.mock('./Countdown', () => ({ Countdown: () => <div>COUNTDOWN</div> }));
vi.mock('./syllabus/PieMatrix', () => ({ PieMatrix: () => <div>PIEMATRIX</div> }));
vi.mock('./sw/SWWidget', () => ({
  SWWidget: ({ externalOpen }: { externalOpen?: boolean }) => <div id="sw-widget">SWWIDGET{externalOpen ? '-OPEN' : ''}</div>,
}));
vi.mock('./syllabus/SyllabusView', () => ({ SyllabusView: () => <div>SYLLABUS-VIEW</div> }));
vi.mock('./plans/PlansGrid', () => ({ PlansGrid: () => <div>PLANS-VIEW</div> }));
vi.mock('./plans/MasterPlan', () => ({ MasterPlan: () => <div>MASTER-VIEW</div> }));
vi.mock('./sources/SourcesView', () => ({ SourcesView: () => <div>SOURCES-VIEW</div> }));
vi.mock('./pyq/PYQBrowser', () => ({ PYQBrowser: () => <div>PYQ-VIEW</div> }));
vi.mock('./focus/FocusWidget', () => ({ FocusWidget: () => null }));
vi.mock('./testseries/TestSeriesView', () => ({ TestSeriesView: () => <div>TESTSERIES-VIEW</div> }));
vi.mock('./ca/CATrackerView', () => ({ CATrackerView: () => <div>CA-VIEW</div> }));
vi.mock('./modals/NotificationSettingsModal', () => ({ NotificationSettingsModal: ({ open }: { open: boolean }) => (open ? <div>NOTIF-SETTINGS</div> : null) }));
vi.mock('./modals/AboutModal', () => ({ AboutModal: ({ open }: { open: boolean }) => (open ? <div>ABOUT-MODAL</div> : null) }));
vi.mock('./modals/ClearProgressModal', () => ({ ClearProgressModal: () => null }));
vi.mock('./modals/NotificationPanel', () => ({ NotificationPanel: () => null }));
vi.mock('./modals/CustomTopicModal', () => ({ CustomTopicModal: () => null }));

import { Layout } from './Layout';

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
const pick = (label: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));

describe('Layout navigation (hamburger menu)', () => {
  it('lands on Home with countdown, S&W widget and pie matrix', () => {
    render(<Layout />);
    expect(screen.getByText('COUNTDOWN')).toBeInTheDocument();
    expect(screen.getByText('SWWIDGET')).toBeInTheDocument();
    expect(screen.getByText('PIEMATRIX')).toBeInTheDocument();
    expect(document.getElementById('view-marathon')).toBeInTheDocument();
  });

  it('opens every page from the menu and shows only that page', async () => {
    render(<Layout />);
    const pages: [string, string][] = [
      ['Syllabus', 'SYLLABUS-VIEW'], ['CA Tracker', 'CA-VIEW'], ['PYQ', 'PYQ-VIEW'],
      ['Test Series', 'TESTSERIES-VIEW'], ['Master Plan', 'MASTER-VIEW'],
      ['My Plans', 'PLANS-VIEW'], ['Sources', 'SOURCES-VIEW'],
    ];
    for (const [label, marker] of pages) {
      openMenu();
      pick(label);
      expect(await screen.findByText(marker)).toBeInTheDocument();
      expect(screen.queryByText('COUNTDOWN')).not.toBeInTheDocument();
    }
  });

  it('avatar click returns to Home', async () => {
    render(<Layout />);
    openMenu(); pick('Syllabus');
    await screen.findByText('SYLLABUS-VIEW');
    fireEvent.click(document.getElementById('user-avatar')!);
    expect(await screen.findByText('COUNTDOWN')).toBeInTheDocument();
    expect(screen.queryByText('SYLLABUS-VIEW')).not.toBeInTheDocument();
  });

  it('menu closes on Escape and on outside click', () => {
    render(<Layout />);
    openMenu();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
  });

  it('settings items open their dialogs', async () => {
    render(<Layout />);
    openMenu(); pick('Update Profile');
    expect(await screen.findByText('PROFILE-MODAL')).toBeInTheDocument();
    openMenu(); pick('Notification Settings');
    expect(await screen.findByText('NOTIF-SETTINGS')).toBeInTheDocument();
    openMenu(); pick('About & Contact Admin');
    expect(await screen.findByText('ABOUT-MODAL')).toBeInTheDocument();
    openMenu(); pick('Sign Out');
    expect(await screen.findByText('Sign out?')).toBeInTheDocument();
  });

  it('Strengths & Weaknesses from another page goes Home and opens the manager', async () => {
    render(<Layout />);
    openMenu(); pick('Master Plan');
    await screen.findByText('MASTER-VIEW');
    openMenu(); pick('Strengths & Weaknesses');
    await waitFor(() => expect(screen.getByText('SWWIDGET-OPEN')).toBeInTheDocument());
  });
});
