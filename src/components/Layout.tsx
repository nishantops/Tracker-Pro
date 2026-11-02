import { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { ENV } from '../lib/env';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useProfile } from '../hooks/useProfile';
import { useTracker } from '../hooks/useTracker';
import { ProfileModal } from './ProfileModal';
import { Countdown } from './Countdown';
import { PieMatrix } from './syllabus/PieMatrix';
import { SWWidget } from './sw/SWWidget';
import { NavMenu, type AppPage } from './nav/NavMenu';
import { MotivationalQuote } from './common/MotivationalQuote';
import { NotificationToasts } from './modals/NotificationToasts';
import { useNotifAlerts } from '../hooks/useNotifAlerts';
// ── Lazy-load all heavy view-level components (split into separate chunks) ──
const SyllabusView  = lazy(() => import('./syllabus/SyllabusView').then((m) => ({ default: m.SyllabusView })));
const PlansGrid     = lazy(() => import('./plans/PlansGrid').then((m) => ({ default: m.PlansGrid })));
const MasterPlan    = lazy(() => import('./plans/MasterPlan').then((m) => ({ default: m.MasterPlan })));
const SourcesView   = lazy(() => import('./sources/SourcesView').then((m) => ({ default: m.SourcesView })));
const PYQBrowser    = lazy(() => import('./pyq/PYQBrowser').then((m) => ({ default: m.PYQBrowser })));
const FocusWidget   = lazy(() => import('./focus/FocusWidget').then((m) => ({ default: m.FocusWidget })));
const TestSeriesView= lazy(() => import('./testseries/TestSeriesView').then((m) => ({ default: m.TestSeriesView })));
const CATrackerView = lazy(() => import('./ca/CATrackerView').then((m) => ({ default: m.CATrackerView })));
const NotificationSettingsModal = lazy(() => import('./modals/NotificationSettingsModal').then((m) => ({ default: m.NotificationSettingsModal })));
const AboutModal    = lazy(() => import('./modals/AboutModal').then((m) => ({ default: m.AboutModal })));
const ClearProgressModal = lazy(() => import('./modals/ClearProgressModal').then((m) => ({ default: m.ClearProgressModal })));
const NotificationPanel  = lazy(() => import('./modals/NotificationPanel').then((m) => ({ default: m.NotificationPanel })));
const CustomTopicModal   = lazy(() => import('./modals/CustomTopicModal').then((m) => ({ default: m.CustomTopicModal })));
import {
  DEFAULT_NAV,
  type NavState,
  type StageTab,
} from '../lib/navigation';
import { useMetrics } from '../hooks/useMetrics';
import { supabase } from '../lib/supabase';

export function Layout() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { profile, initials, features } = useProfile();
  const { syncStatus, progress } = useTracker();
  const notif = useNotifAlerts(user, progress);
  const { trackTabSwitch } = useMetrics();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [notifSettingsOpen, setNotifSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [clearProgressOpen, setClearProgressOpen] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [customTopicOpen, setCustomTopicOpen] = useState(false);
  const [swManagerOpen, setSWManagerOpen] = useState(false);
  const [nav, setNav] = useState<NavState>(DEFAULT_NAV);
  const [showHome, setShowHome] = useState(true);
  const [dateStr, setDateStr] = useState('---');
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  // Poll for unread admin replies every 2 minutes
  useEffect(() => {
    if (!user) return;
    const poll = async () => {
      try {
        const { count } = await supabase
          .from('upsc_messages')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('sender_type', 'admin')
          .eq('is_read', false);
        setUnreadMsgCount(count ?? 0);
      } catch { /* non-critical */ }
    };
    poll();
    const id = setInterval(poll, ENV.MSG_UNREAD_POLL_MS);
    return () => clearInterval(id);
  }, [user]);

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';

  const setStage = (stage: StageTab) => { setNav((n) => ({ ...n, stage })); trackTabSwitch(stage); };

  const activePage: AppPage = showHome ? 'home' : nav.root === 'planner' ? nav.planner : nav.marathon;
  const goPage = (page: AppPage) => {
    trackTabSwitch(page);
    if (page === 'home') { setShowHome(true); return; }
    setShowHome(false);
    if (page === 'master' || page === 'plans' || page === 'sources') {
      setNav((n) => ({ ...n, root: 'planner', planner: page }));
    } else {
      setNav((n) => ({ ...n, root: 'marathon', marathon: page }));
    }
  };

  // Browser Back/Forward steps through pages instead of leaving (and reloading) the app
  const navHistoryRef = useRef<string>('');
  useEffect(() => {
    const key = JSON.stringify({ nav, showHome });
    if (navHistoryRef.current === key) return;
    if (navHistoryRef.current === '') window.history.replaceState({ upscNav: nav, upscHome: showHome }, '');
    else window.history.pushState({ upscNav: nav, upscHome: showHome }, '');
    navHistoryRef.current = key;
  }, [nav, showHome]);
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const prev = e.state?.upscNav as NavState | undefined;
      if (!prev) return;
      const home = e.state?.upscHome !== false;
      navHistoryRef.current = JSON.stringify({ nav: prev, showHome: home });
      setNav(prev);
      setShowHome(home);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // Date widget
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setDateStr(
        now.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }) +
          ' · ' +
          now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      );
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  // ESC closes topmost open modal/panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (notifPanelOpen) { setNotifPanelOpen(false); return; }
      if (profileModalOpen) { setProfileModalOpen(false); return; }
      if (notifSettingsOpen) { setNotifSettingsOpen(false); return; }
      if (aboutOpen) { setAboutOpen(false); return; }
      if (clearProgressOpen) { setClearProgressOpen(false); return; }
      if (customTopicOpen) { setCustomTopicOpen(false); return; }
      if (swManagerOpen) { setSWManagerOpen(false); return; }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [notifPanelOpen, profileModalOpen, notifSettingsOpen, aboutOpen, clearProgressOpen, customTopicOpen, swManagerOpen]);

  // Header + quote are position:fixed (sticky breaks under the page's overflow rules); the spacer keeps content below them.
  const pinnedRef = useRef<HTMLDivElement>(null);
  const [pinnedH, setPinnedH] = useState(0);
  useEffect(() => {
    const el = pinnedRef.current;
    if (!el) return;
    const update = () => setPinnedH(el.offsetHeight);
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const optLabel =
    profile?.optional_subject && profile.optional_subject !== 'none'
      ? (profile.optional_subject_custom || profile.optional_subject)
      : 'Optional';

  return (
    <div id="app-container" className="flex-1 w-full flex flex-col">
      {/* ── Logout confirmation modal ───────────────────────────── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[9600] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: '1rem', padding: '1.75rem 1.5rem 1.25rem', maxWidth: 320, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏻</div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--t1)', marginBottom: '0.35rem', fontFamily: 'var(--heading)' }}>Sign out?</h3>
            <p style={{ fontSize: '0.68rem', color: 'var(--t3)', fontFamily: 'var(--mono)', marginBottom: '1.4rem' }}>Your progress is auto-saved to the cloud.</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button onClick={() => { setShowLogoutConfirm(false); signOut(); }} style={{ background: '#dc2626', border: 'none', color: '#fff', borderRadius: '0.5rem', padding: '0.5rem 1.4rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--mono)' }}>Sign Out</button>
              <button onClick={() => setShowLogoutConfirm(false)} style={{ background: 'none', border: '1px solid var(--bdr)', color: 'var(--t2)', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--mono)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div style={{ height: pinnedH, flexShrink: 0 }} aria-hidden="true" />
      <div ref={pinnedRef} className="app-top-pinned fixed top-0 inset-x-0 z-40">
      <header className="backdrop-blur-md px-3 md:px-6 lg:px-10 xl:px-16 2xl:px-24 py-2 xl:py-2.5 2xl:py-3">
        <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 xl:gap-3">

          {/* Left: Avatar + Name + Sync — always fully visible */}
          <div className="flex items-center gap-2 xl:gap-3 min-w-0">
            <NavMenu
              active={activePage}
              onNavigate={goPage}
              showPyq={features.pyq !== false}
              showPlans={features.plans !== false}
              showSources={features.sources !== false}
              settingsItems={[
                { icon: '✏️', label: 'Update Profile', onClick: () => setProfileModalOpen(true) },
                { icon: '💡', label: 'Strengths & Weaknesses', onClick: () => { setShowHome(true); setSWManagerOpen(true); } },
                { icon: '🔔', label: 'Notification Settings', onClick: () => setNotifSettingsOpen(true) },
                { icon: 'ℹ️', label: 'About & Contact Admin', onClick: () => setAboutOpen(true) },
                { icon: '↻', label: 'Reset Syllabus Progress', onClick: () => setClearProgressOpen(true), danger: true },
                { icon: '⏻', label: 'Sign Out', onClick: () => setShowLogoutConfirm(true), danger: true },
              ]}
            />
            <div
              id="user-avatar"
              role="button"
              tabIndex={0}
              title="Go to Home"
              onClick={() => goPage('home')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goPage('home'); } }}
              className="cursor-pointer h-9 w-9 xl:h-11 xl:w-11 2xl:h-12 2xl:w-12 shrink-0 rounded-xl 2xl:rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-orange-400 flex items-center justify-center font-black text-white text-sm xl:text-base 2xl:text-lg tracking-tighter shadow-lg shadow-violet-500/30 glow-violet"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="font-black tracking-tight heading-font flex items-center gap-1.5 flex-wrap" style={{ fontSize: 'clamp(0.75rem, 1.1vw, 1.25rem)' }}>
                <span className="gradient-text-animated">{displayName}</span>
                <span className="font-bold px-1.5 py-0.5 rounded-full uppercase font-mono shrink-0 whitespace-nowrap" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.75rem)', background: 'var(--surf)', color: 'var(--t3)', border: '1px solid var(--bdr)' }}>
                  Mission 2027
                </span>
              </h1>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                <span className={`inline-block w-1.5 h-1.5 2xl:w-2 2xl:h-2 rounded-full shrink-0 ${syncStatus === 'synced' ? 'bg-emerald-500' : syncStatus === 'saving' ? 'bg-amber-400 animate-pulse' : 'bg-rose-500'}`} />
                <span className="font-bold uppercase tracking-widest" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.75rem)', color: 'var(--t4)' }}>
                  {syncStatus === 'offline' ? 'OFFLINE' : 'LIVE'}
                </span>
                {profile?.attempt && (
                  <span className="header-stat">Attempt {profile.attempt}</span>
                )}
                {profile?.optional_subject && profile.optional_subject !== 'none' && (
                  <span className="optional-badge-chip text-[9px]">
                    {profile.optional_subject_custom || profile.optional_subject}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Date + Focus + Bell + Theme + Settings — always visible, wraps on tiny screens */}
          <div className="flex items-center gap-1 xl:gap-1.5 flex-wrap shrink-0 font-mono text-xs font-bold">
            {/* Date Widget */}
            <div id="header-date-widget" className="flex rounded-xl p-1 xl:p-1.5 items-center" style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}>
              <span className="px-1 py-1" style={{ color: 'var(--t3)', fontSize: 'clamp(0.8rem, 1vw, 1.1rem)' }}>⏱</span>
              <span id="live-date-hud" className="px-2 py-1 rounded-lg whitespace-nowrap" style={{ background: 'var(--card)', color: 'var(--t2)', fontSize: 'clamp(0.6rem, 0.9vw, 0.85rem)' }}>
                {dateStr}
              </span>
            </div>

            {/* Focus Mode Widget */}
            {features.focus !== false && <Suspense fallback={null}><FocusWidget /></Suspense>}

            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                id="notif-bell"
                title="Notifications"
                onClick={() => setNotifPanelOpen((o) => !o)}
                style={{
                  position: 'relative',
                  background: 'var(--surf)',
                  border: '1px solid var(--bdr)',
                  color: 'var(--t3)',
                  borderRadius: '0.6rem',
                  padding: '0.4rem 0.55rem',
                  cursor: 'pointer',
                  fontSize: 'clamp(0.85rem, 1.2vw, 1.2rem)',
                  lineHeight: 1,
                }}
              >
                🔔
                {unreadMsgCount + notif.alerts.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                    pointerEvents: 'none',
                  }}>
                    {unreadMsgCount + notif.alerts.length > 9 ? '9+' : unreadMsgCount + notif.alerts.length}
                  </span>
                )}
              </button>
              <Suspense fallback={null}>
                <NotificationPanel
                  open={notifPanelOpen}
                  onClose={() => setNotifPanelOpen(false)}
                  onOpenSettings={() => setNotifSettingsOpen(true)}
                  alerts={notif.alerts}
                  onDismiss={notif.dismiss}
                  onDismissAll={notif.dismissAll}
                  onRefresh={notif.refresh}
                />
              </Suspense>
            </div>

            {/* Theme Toggle */}
            <button id="theme-toggle" onClick={toggle} title="Toggle light/dark mode">
              <span id="theme-toggle-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
            </button>
          </div>

        </div>
      </header>

      <div className="app-top-quote w-full px-4 md:px-6 lg:px-10 xl:px-16 2xl:px-24 pt-3 pb-3">
        <div className="w-full max-w-[1920px] mx-auto">
          <MotivationalQuote />
        </div>
      </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <main className="w-full max-w-[1920px] mx-auto px-4 md:px-6 lg:px-10 xl:px-16 2xl:px-24 py-8 flex-1 space-y-8">
        {/* ── HOME DASHBOARD ─────────────────────────────────── */}
        {showHome && (
          <div id="view-marathon" className="root-pane-view space-y-8">
            <Countdown />
            <SWWidget externalOpen={swManagerOpen} onExternalClose={() => setSWManagerOpen(false)} />
            <PieMatrix onAddCustomTopic={() => setCustomTopicOpen(true)} />
          </div>
        )}

        {/* ── MARATHON VIEW ──────────────────────────────────── */}
        {!showHome && nav.root === 'marathon' && (
          <div id="view-marathon" className="root-pane-view space-y-8">
            {/* Syllabus View */}
            {nav.marathon === 'syllabus' && (
              <div className="space-y-6">
                {/* Stage Tabs */}
                <div className="flex flex-row gap-1 overflow-x-auto whitespace-nowrap scrollbar-none">
                  <button
                    onClick={() => setStage('prelims')}
                    className={`cursor-pointer flex-1 whitespace-nowrap text-center py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-wider transition-all heading-font ${
                      nav.stage === 'prelims'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'stage-btn-inactive'
                    }`}
                  >
                    Stage I: Prelims
                  </button>
                  <button
                    onClick={() => setStage('mains')}
                    className={`cursor-pointer flex-1 whitespace-nowrap text-center py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-wider transition-all heading-font ${
                      nav.stage === 'mains'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'stage-btn-inactive'
                    }`}
                  >
                    Stage II: Mains
                  </button>
                  <button
                    onClick={() => setStage('anthro')}
                    className={`cursor-pointer flex-1 whitespace-nowrap text-center py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-wider transition-all heading-font ${
                      nav.stage === 'anthro'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'stage-btn-inactive'
                    }`}
                  >
                    Stage III: {optLabel}
                  </button>
                </div>
                <Suspense fallback={<div className="tab-loading">Loading…</div>}>
                <SyllabusView stage={nav.stage} />
                </Suspense>
              </div>
            )}

            {nav.marathon === 'ca' && <Suspense fallback={<div className="tab-loading">Loading…</div>}><CATrackerView /></Suspense>}
            {nav.marathon === 'pyq' && (
              <Suspense fallback={<div className="neo-card rounded-3xl p-6"><p className="text-xs text-slate-400 font-mono">Loading PYQ data…</p></div>}>
                <PYQBrowser />
              </Suspense>
            )}
            {nav.marathon === 'testseries' && <Suspense fallback={<div className="tab-loading">Loading…</div>}><TestSeriesView /></Suspense>}
          </div>
        )}

        {/* ── PLANNER VIEW ───────────────────────────────────── */}
        {!showHome && nav.root === 'planner' && (
          <div id="view-planner" className="root-pane-view space-y-8">
            {nav.planner === 'master' && <Suspense fallback={<div className="tab-loading">Loading…</div>}><MasterPlan /></Suspense>}
            {nav.planner === 'plans' && <Suspense fallback={<div className="tab-loading">Loading…</div>}><PlansGrid /></Suspense>}
            {nav.planner === 'sources' && <Suspense fallback={<div className="tab-loading">Loading…</div>}><SourcesView /></Suspense>}
          </div>
        )}
      </main>

      {/* Profile modal */}
      {showHome && <NotificationToasts alerts={notif.alerts} repeatMinutes={notif.repeatMinutes} onDone={(id) => notif.dismiss(id)} />}
      <ProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
      <Suspense fallback={null}><NotificationSettingsModal open={notifSettingsOpen} onClose={() => { setNotifSettingsOpen(false); notif.refresh(); }} /></Suspense>
      <Suspense fallback={null}><AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} onMarkRead={() => setUnreadMsgCount(0)} /></Suspense>
      <Suspense fallback={null}><ClearProgressModal open={clearProgressOpen} onClose={() => setClearProgressOpen(false)} /></Suspense>
      <Suspense fallback={null}><CustomTopicModal open={customTopicOpen} onClose={() => setCustomTopicOpen(false)} /></Suspense>
    </div>
  );
}
