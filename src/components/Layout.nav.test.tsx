import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const h = vi.hoisted(() => ({
  features: { pyq: true, plans: true, sources: true, focus: false } as Record<string, boolean>,
  profile: { display_name: 'Nishant Kumar', optional_subject: 'none', attempt: 3 } as Record<string, unknown>,
  signOut: vi.fn(),
  toggleTheme: vi.fn(),
}));

vi.mock('../lib/supabase', () => {
  const q: unknown = new Proxy({}, {
    get: (_t, p) => (p === 'then'
      ? (res: (v: unknown) => unknown) => res({ data: null, count: 0, error: null })
      : () => q),
  });
  return { supabase: { from: () => q, auth: { getSession: async () => ({ data: { session: null } }) } }, isSupabaseConfigured: true };
});
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'a@b.c' }, signOut: h.signOut }),
}));
vi.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark', toggle: h.toggleTheme }) }));
vi.mock('../hooks/useProfile', () => ({
  useProfile: () => ({ profile: h.profile, initials: 'NK', features: h.features }),
}));
vi.mock('../hooks/useTracker', () => ({ useTracker: () => ({ syncStatus: 'synced' }) }));
vi.mock('../hooks/useMetrics', () => ({ useMetrics: () => ({ trackTabSwitch: vi.fn() }) }));

vi.mock('./ProfileModal', () => ({ ProfileModal: ({ open }: { open: boolean }) => (open ? <div>PROFILE-MODAL</div> : null) }));
vi.mock('./Countdown', () => ({ Countdown: () => <div>COUNTDOWN</div> }));
vi.mock('./syllabus/PieMatrix', () => ({ PieMatrix: () => <div>PIEMATRIX</div> }));
vi.mock('./sw/SWWidget', () => ({
  SWWidget: ({ externalOpen }: { externalOpen?: boolean }) => <div id="sw-widget">SWWIDGET{externalOpen ? '-OPEN' : ''}</div>,
}));
vi.mock('./syllabus/SyllabusView', () => ({ SyllabusView: ({ stage }: { stage: string }) => <div>SYLLABUS-VIEW:{stage}</div> }));
vi.mock('./plans/PlansGrid', () => ({ PlansGrid: () => <div>PLANS-VIEW</div> }));
vi.mock('./plans/MasterPlan', () => ({ MasterPlan: () => <div>MASTER-VIEW</div> }));
vi.mock('./sources/SourcesView', () => ({ SourcesView: () => <div>SOURCES-VIEW</div> }));
vi.mock('./pyq/PYQBrowser', () => ({ PYQBrowser: () => <div>PYQ-VIEW</div> }));
vi.mock('./focus/FocusWidget', () => ({ FocusWidget: () => <div>FOCUS-WIDGET</div> }));
vi.mock('./testseries/TestSeriesView', () => ({ TestSeriesView: () => <div>TESTSERIES-VIEW</div> }));
vi.mock('./ca/CATrackerView', () => ({ CATrackerView: () => <div>CA-VIEW</div> }));
vi.mock('./modals/NotificationSettingsModal', () => ({ NotificationSettingsModal: ({ open }: { open: boolean }) => (open ? <div>NOTIF-SETTINGS</div> : null) }));
vi.mock('./modals/AboutModal', () => ({ AboutModal: ({ open }: { open: boolean }) => (open ? <div>ABOUT-MODAL</div> : null) }));
vi.mock('./modals/ClearProgressModal', () => ({ ClearProgressModal: ({ open }: { open: boolean }) => (open ? <div>CLEAR-PROGRESS-MODAL</div> : null) }));
vi.mock('./modals/NotificationPanel', () => ({ NotificationPanel: () => null }));
vi.mock('./modals/CustomTopicModal', () => ({ CustomTopicModal: () => null }));

import { Layout } from './Layout';

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
const menu = () => screen.getByRole('navigation', { name: 'Main navigation' });
const pick = (label: string) => fireEvent.click(within(menu()).getByText(label));

beforeEach(() => {
  h.features = { pyq: true, plans: true, sources: true, focus: false };
  h.profile = { display_name: 'Nishant Kumar', optional_subject: 'none', attempt: 3 };
  h.signOut.mockClear();
  h.toggleTheme.mockClear();
  window.history.replaceState(null, '');
});

describe('Layout — header (same words as main)', () => {
  it('shows name, Mission 2027, LIVE, attempt and avatar initials', () => {
    render(<Layout />);
    const header = document.querySelector('header')!;
    expect(within(header).getByText('Nishant Kumar')).toBeInTheDocument();
    expect(within(header).getByText('Mission 2027')).toBeInTheDocument();
    expect(within(header).getByText('LIVE')).toBeInTheDocument();
    expect(within(header).getByText('Attempt 3')).toBeInTheDocument();
    expect(document.getElementById('user-avatar')).toHaveTextContent('NK');
  });

  it('keeps date widget, bell and theme toggle; theme toggle still works', () => {
    render(<Layout />);
    expect(document.getElementById('live-date-hud')).toBeInTheDocument();
    expect(document.getElementById('notif-bell')).toBeInTheDocument();
    fireEvent.click(document.getElementById('theme-toggle')!);
    expect(h.toggleTheme).toHaveBeenCalledTimes(1);
  });

  it('shows the focus widget only when the focus feature is on', async () => {
    const { unmount } = render(<Layout />);
    expect(screen.queryByText('FOCUS-WIDGET')).not.toBeInTheDocument();
    unmount();
    h.features.focus = true;
    render(<Layout />);
    expect(await screen.findByText('FOCUS-WIDGET')).toBeInTheDocument();
  });

  it('removed the old header Settings button (now inside the menu)', () => {
    render(<Layout />);
    expect(document.getElementById('header-settings-btn')).toBeNull();
  });

  it('shows the motivational banner directly below the header', () => {
    render(<Layout />);
    const header = document.querySelector('header')!;
    const banner = document.querySelector('.motivation-banner')!;
    expect(banner).toBeInTheDocument();
    expect(header.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('header and quote banner are pinned together so they stay frozen while scrolling', () => {
    render(<Layout />);
    const pinned = document.querySelector('.app-top-pinned') as HTMLElement;
    expect(pinned.className).toMatch(/\bsticky\b/);
    expect(pinned.className).toMatch(/top-0/);
    expect(pinned).toContainElement(document.querySelector('header'));
    expect(pinned).toContainElement(document.querySelector('.motivation-banner'));
    expect(document.querySelector('main')!.closest('.app-top-pinned')).toBeNull();
  });
});

describe('Layout — menu wording and gating', () => {
  it('lists exactly main\'s tab wording plus Home and account settings', () => {
    render(<Layout />);
    openMenu();
    const text = menu().textContent!;
    for (const w of [
      'Home', '1. Syllabus', '2. CA Tracker', '3. PYQ', '4. Test-Series',
      'Master Plan', 'My Plans', 'Sources & Links',
      'Update Profile', 'Strengths & Weaknesses', 'Notification Settings', 'About & Contact Admin', 'Reset Syllabus Progress', 'Sign Out',
      'Marathon Tracker', 'Strategy Planner', 'Account Settings',
    ]) expect(text).toContain(w);
    expect(menu().querySelectorAll('button').length).toBe(14);
  });

  it('hides PYQ when the pyq feature is off', () => {
    h.features.pyq = false;
    render(<Layout />);
    openMenu();
    expect(menu().textContent).not.toContain('3. PYQ');
  });

  it('hides the whole planner section when plans is off', () => {
    h.features.plans = false;
    render(<Layout />);
    openMenu();
    expect(menu().textContent).not.toContain('Master Plan');
    expect(menu().textContent).not.toContain('My Plans');
    expect(menu().textContent).not.toContain('Sources & Links');
  });

  it('hides Sources & Links when sources is off', () => {
    h.features.sources = false;
    render(<Layout />);
    openMenu();
    expect(menu().textContent).toContain('My Plans');
    expect(menu().textContent).not.toContain('Sources & Links');
  });

  it('marks the current page and closes on selection, Escape and outside click', () => {
    render(<Layout />);
    openMenu();
    expect(within(menu()).getByText('Home').closest('button')).toHaveAttribute('aria-current', 'page');
    pick('1. Syllabus');
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
    openMenu();
    expect(within(menu()).getByText('1. Syllabus').closest('button')).toHaveAttribute('aria-current', 'page');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
    openMenu();
    fireEvent.click(document.querySelector('div[style*="inset"]')!);
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
  });
});

describe('Layout — pages', () => {
  it('Home shows countdown, S&W widget and pie matrix in the original grid container', () => {
    render(<Layout />);
    expect(screen.getByText('COUNTDOWN')).toBeInTheDocument();
    expect(screen.getByText('SWWIDGET')).toBeInTheDocument();
    expect(screen.getByText('PIEMATRIX')).toBeInTheDocument();
    const view = document.getElementById('view-marathon')!;
    expect(view).toContainElement(document.getElementById('sw-widget'));
  });

  it('each menu item opens only its page', async () => {
    render(<Layout />);
    const pages: [string, string][] = [
      ['1. Syllabus', 'SYLLABUS-VIEW:prelims'], ['2. CA Tracker', 'CA-VIEW'], ['3. PYQ', 'PYQ-VIEW'],
      ['4. Test-Series', 'TESTSERIES-VIEW'], ['Master Plan', 'MASTER-VIEW'],
      ['My Plans', 'PLANS-VIEW'], ['Sources & Links', 'SOURCES-VIEW'],
    ];
    for (const [label, marker] of pages) {
      openMenu();
      pick(label);
      expect(await screen.findByText(marker)).toBeInTheDocument();
      expect(screen.queryByText('COUNTDOWN')).not.toBeInTheDocument();
      expect(screen.queryByText('PIEMATRIX')).not.toBeInTheDocument();
    }
  });

  it('Syllabus keeps the three stage tabs with main\'s wording and passes the stage down', async () => {
    render(<Layout />);
    openMenu(); pick('1. Syllabus');
    await screen.findByText('SYLLABUS-VIEW:prelims');
    fireEvent.click(screen.getByText('Stage II: Mains'));
    expect(await screen.findByText('SYLLABUS-VIEW:mains')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Stage III: Optional'));
    expect(await screen.findByText('SYLLABUS-VIEW:anthro')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Stage I: Prelims'));
    expect(await screen.findByText('SYLLABUS-VIEW:prelims')).toBeInTheDocument();
  });

  it('Stage III uses the optional subject name', async () => {
    h.profile = { ...h.profile, optional_subject: 'anthropology' };
    render(<Layout />);
    openMenu(); pick('1. Syllabus');
    expect(await screen.findByText('Stage III: anthropology')).toBeInTheDocument();
  });

  it('avatar click (and Enter key) returns to Home', async () => {
    render(<Layout />);
    openMenu(); pick('1. Syllabus');
    await screen.findByText('SYLLABUS-VIEW:prelims');
    fireEvent.click(document.getElementById('user-avatar')!);
    expect(await screen.findByText('COUNTDOWN')).toBeInTheDocument();
    openMenu(); pick('Master Plan');
    await screen.findByText('MASTER-VIEW');
    fireEvent.keyDown(document.getElementById('user-avatar')!, { key: 'Enter' });
    expect(await screen.findByText('COUNTDOWN')).toBeInTheDocument();
  });

  it('browser Back/Forward steps through pages', async () => {
    render(<Layout />);
    openMenu(); pick('1. Syllabus');
    await screen.findByText('SYLLABUS-VIEW:prelims');
    openMenu(); pick('Master Plan');
    await screen.findByText('MASTER-VIEW');
    window.history.back();
    expect(await screen.findByText('SYLLABUS-VIEW:prelims')).toBeInTheDocument();
    window.history.back();
    expect(await screen.findByText('COUNTDOWN')).toBeInTheDocument();
    window.history.forward();
    expect(await screen.findByText('SYLLABUS-VIEW:prelims')).toBeInTheDocument();
  });
});

describe('Layout — account settings (same actions as the old Settings dropdown)', () => {
  it('Update Profile, Notification Settings and About open their dialogs', async () => {
    render(<Layout />);
    openMenu(); pick('Update Profile');
    expect(await screen.findByText('PROFILE-MODAL')).toBeInTheDocument();
    openMenu(); pick('Notification Settings');
    expect(await screen.findByText('NOTIF-SETTINGS')).toBeInTheDocument();
    openMenu(); pick('About & Contact Admin');
    expect(await screen.findByText('ABOUT-MODAL')).toBeInTheDocument();
  });

  it('Sign Out asks for confirmation with main\'s wording; Cancel keeps you signed in; confirm signs out', async () => {
    render(<Layout />);
    openMenu(); pick('Sign Out');
    expect(await screen.findByText('Sign out?')).toBeInTheDocument();
    expect(screen.getByText('Your progress is auto-saved to the cloud.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Sign out?')).not.toBeInTheDocument();
    expect(h.signOut).not.toHaveBeenCalled();
    openMenu(); pick('Sign Out');
    await screen.findByText('Sign out?');
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Sign out?')).not.toBeInTheDocument();
  });

  it('Reset Syllabus Progress (moved from the absorption card) opens the confirmation from any page', async () => {
    render(<Layout />);
    openMenu(); pick('Master Plan');
    await screen.findByText('MASTER-VIEW');
    openMenu(); pick('Reset Syllabus Progress');
    expect(await screen.findByText('CLEAR-PROGRESS-MODAL')).toBeInTheDocument();
  });

  it('Strengths & Weaknesses works from any page: goes Home and opens the manager', async () => {
    render(<Layout />);
    openMenu(); pick('Master Plan');
    await screen.findByText('MASTER-VIEW');
    openMenu(); pick('Strengths & Weaknesses');
    await waitFor(() => expect(screen.getByText('SWWIDGET-OPEN')).toBeInTheDocument());
  });
});
