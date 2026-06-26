import { useEffect, useState, useCallback, Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';
import { ENV } from '../lib/env';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useProfile } from '../hooks/useProfile';
import { useTracker } from '../hooks/useTracker';
import { ProfileModal } from './ProfileModal';
import { Countdown } from './Countdown';
import { PieMatrix } from './syllabus/PieMatrix';
import { SWWidget } from './sw/SWWidget';
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
  type RootTab,
  type MarathonTab,
  type PlannerTab,
  type StageTab,
} from '../lib/navigation';
import { useMetrics } from '../hooks/useMetrics';
import { supabase } from '../lib/supabase';

export function Layout() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { profile, initials, features } = useProfile();
  const { syncStatus } = useTracker();
  const { trackTabSwitch } = useMetrics();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [notifSettingsOpen, setNotifSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [clearProgressOpen, setClearProgressOpen] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [customTopicOpen, setCustomTopicOpen] = useState(false);
  const [swManagerOpen, setSWManagerOpen] = useState(false);
  const [nav, setNav] = useState<NavState>(DEFAULT_NAV);
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

  const setRoot = (root: RootTab) => { setNav((n) => ({ ...n, root })); trackTabSwitch(root); };
  const setMarathon = (marathon: MarathonTab) => { setNav((n) => ({ ...n, marathon })); trackTabSwitch(marathon); };
  const setPlanner = (planner: PlannerTab) => { setNav((n) => ({ ...n, planner })); trackTabSwitch(planner); };
  const setStage = (stage: StageTab) => { setNav((n) => ({ ...n, stage })); trackTabSwitch(stage); };

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

  // Close menu on outside click
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useEffect(() => {
    if (!menuOpen) return;
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, [menuOpen, closeMenu]);

  // ESC closes topmost open modal/panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (menuOpen) { setMenuOpen(false); return; }
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
  }, [menuOpen, notifPanelOpen, profileModalOpen, notifSettingsOpen, aboutOpen, clearProgressOpen, customTopicOpen, swManagerOpen]);

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
      <header className="backdrop-blur-md sticky top-0 z-40 px-3 md:px-6 lg:px-10 xl:px-16 2xl:px-24 py-2 xl:py-2.5 2xl:py-3">
        <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 xl:gap-3">

          {/* Left: Avatar + Name + Sync — always fully visible */}
          <div className="flex items-center gap-2 xl:gap-3 min-w-0">
            <div
              id="user-avatar"
              className="h-9 w-9 xl:h-11 xl:w-11 2xl:h-12 2xl:w-12 shrink-0 rounded-xl 2xl:rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-orange-400 flex items-center justify-center font-black text-white text-sm xl:text-base 2xl:text-lg tracking-tighter shadow-lg shadow-violet-500/30 glow-violet"
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
                {unreadMsgCount > 0 && (
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
                    {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
                  </span>
                )}
              </button>
              <Suspense fallback={null}>
                <NotificationPanel
                  open={notifPanelOpen}
                  onClose={() => setNotifPanelOpen(false)}
                  onOpenSettings={() => setNotifSettingsOpen(true)}
                />
              </Suspense>
            </div>

            {/* Theme Toggle */}
            <button id="theme-toggle" onClick={toggle} title="Toggle light/dark mode">
              <span id="theme-toggle-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
            </button>

            {/* Settings */}
            <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
              <button
                id="header-settings-btn"
                onClick={() => setMenuOpen((o) => !o)}
                title="Settings"
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'var(--surf)',
                  border: '1px solid var(--bdr)',
                  borderRadius: '0.65rem',
                  padding: 'clamp(0.25rem, 0.5vw, 0.45rem) clamp(0.5rem, 1vw, 0.9rem) clamp(0.25rem, 0.5vw, 0.45rem) clamp(0.35rem, 0.6vw, 0.6rem)',
                  cursor: 'pointer',
                  color: 'var(--t3)',
                  fontSize: 'clamp(0.55rem, 0.75vw, 0.85rem)',
                  fontWeight: 800,
                  fontFamily: 'var(--mono)',
                  letterSpacing: '0.04em',
                }}
              >
                <span
                  id="header-settings-avatar"
                  style={{
                    width: 'clamp(1.4rem, 1.8vw, 2rem)',
                    height: 'clamp(1.4rem, 1.8vw, 2rem)',
                    borderRadius: '0.4rem',
                    background: 'linear-gradient(135deg,#7c3aed,#db2777)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'clamp(0.55rem, 0.7vw, 0.8rem)',
                    fontWeight: 900,
                    color: '#fff',
                  }}
                >
                  {initials}
                </span>
                <span className="header-settings-text">⚙ SETTINGS</span>
              </button>

              {menuOpen && createPortal(
                <div
                  id="profile-menu"
                  className="profile-menu"
                  style={{ position: 'fixed', top: 68, right: 16, minWidth: 220, zIndex: 99999 }}
                >
                  <div
                    style={{
                      padding: '0.5rem 0.85rem 0.4rem',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--t3)',
                      fontFamily: 'var(--mono)',
                      borderBottom: '1px solid var(--bdr)',
                      marginBottom: '0.3rem',
                    }}
                  >
                    Account Settings
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setProfileModalOpen(true);
                    }}
                  >
                    ✏️ Update Profile
                  </button>
                  <button onClick={() => { setMenuOpen(false); setRoot('marathon'); setSWManagerOpen(true); }}>
                    💡 Strengths &amp; Weaknesses
                  </button>
                  <button onClick={() => { setMenuOpen(false); setNotifSettingsOpen(true); }}>
                    🔔 Notification Settings
                  </button>
                  <button onClick={() => { setMenuOpen(false); setAboutOpen(true); }}>
                    ℹ️ About &amp; Contact Admin
                  </button>
                  <div style={{ borderTop: '1px solid var(--bdr)', margin: '0.3rem 0' }} />
                  <button onClick={() => { setMenuOpen(false); setShowLogoutConfirm(true); }} style={{ color: '#dc2626' }}>
                    ⏻ Sign Out
                  </button>
                </div>
              , document.body)}
            </div>
          </div>

        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <main className="w-full max-w-[1920px] mx-auto px-4 md:px-6 lg:px-10 xl:px-16 2xl:px-24 py-8 flex-1 space-y-8">
        {/* ── Root Tabs: Marathon / Planner ──────────────────── */}
        <div className="flex flex-row gap-2 overflow-x-auto whitespace-nowrap scrollbar-none p-1.5 backdrop-blur-lg rounded-2xl shadow-lg" style={{ background: 'var(--card)', border: '1px solid var(--bdr)', boxShadow: '0 4px 16px var(--accent-glow)' }}>
          <button
            id="btn-root-marathon"
            onClick={() => setRoot('marathon')}
            className={`cursor-pointer flex-1 text-center py-4 px-6 rounded-xl font-black text-sm uppercase tracking-widest transition-all heading-font ${
              nav.root === 'marathon'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-500'
                : 'border border-transparent'
            }`}
            style={nav.root !== 'marathon' ? { color: 'var(--t2)' } : {}}
          >
            ⚔️ Marathon Tracker
          </button>
          {features.plans !== false && (
            <button
              id="btn-root-planner"
              onClick={() => setRoot('planner')}
              className={`cursor-pointer flex-1 text-center py-4 px-6 rounded-xl font-black text-sm uppercase tracking-widest transition-all heading-font ${
                nav.root === 'planner'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-500'
                  : 'border border-transparent'
              }`}
              style={nav.root !== 'planner' ? { color: 'var(--t2)' } : {}}
            >
              📅 Strategy Planner
            </button>
          )}
        </div>

        {/* ── MARATHON VIEW ──────────────────────────────────── */}
        {nav.root === 'marathon' && (
          <div id="view-marathon" className="root-pane-view space-y-8">
            {/* Countdown cards */}
            <Countdown onClearProgress={() => setClearProgressOpen(true)} />

            {/* S&W Widget */}
            <SWWidget externalOpen={swManagerOpen} onExternalClose={() => setSWManagerOpen(false)} />

            {/* Pie Completion Matrix */}
            <PieMatrix onAddCustomTopic={() => setCustomTopicOpen(true)} />

            {/* Sub-tabs: Syllabus / CA / PYQ / Test Series */}
            <div className="neo-card rounded-2xl p-2 flex flex-row gap-1 overflow-x-auto whitespace-nowrap scrollbar-none shadow-sm">
              <button
                onClick={() => setMarathon('syllabus')}
                className={`cursor-pointer flex-1 text-center py-4 px-6 rounded-xl font-black text-sm uppercase tracking-wider transition-all heading-font ${
                  nav.marathon === 'syllabus'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                    : ''
                }`}
                style={nav.marathon !== 'syllabus' ? { color: 'var(--t2)' } : {}}
              >
                1. Syllabus
              </button>
              <button
                onClick={() => setMarathon('ca')}
                className={`cursor-pointer flex-1 text-center py-4 px-6 rounded-xl font-black text-sm uppercase tracking-wider transition-all heading-font ${
                  nav.marathon === 'ca'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                    : ''
                }`}
                style={nav.marathon !== 'ca' ? { color: 'var(--t2)' } : {}}
              >
                2. CA Tracker
              </button>
              {features.pyq !== false && (
                <button
                  onClick={() => setMarathon('pyq')}
                  className={`cursor-pointer flex-1 text-center py-4 px-6 rounded-xl font-black text-sm uppercase tracking-wider transition-all heading-font ${
                    nav.marathon === 'pyq'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                      : ''
                  }`}
                  style={nav.marathon !== 'pyq' ? { color: 'var(--t2)' } : {}}
                >
                  3. PYQ
                </button>
              )}
              <button
                onClick={() => setMarathon('testseries')}
                className={`cursor-pointer flex-1 text-center py-4 px-6 rounded-xl font-black text-sm uppercase tracking-wider transition-all heading-font ${
                  nav.marathon === 'testseries'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                    : ''
                }`}
                style={nav.marathon !== 'testseries' ? { color: 'var(--t2)' } : {}}
              >
                4. Test-Series
              </button>
            </div>

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
        {nav.root === 'planner' && (
          <div id="view-planner" className="root-pane-view space-y-8">
            {/* Sub-tabs */}
            <div className="flex flex-row gap-1 overflow-x-auto whitespace-nowrap scrollbar-none p-1.5 rounded-2xl shadow-sm" style={{ background: 'var(--card)', border: '1px solid var(--bdr)' }}>
              <button
                onClick={() => setPlanner('master')}
                className={`cursor-pointer flex-1 text-center py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all heading-font ${
                  nav.planner === 'master'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25 border border-emerald-500'
                    : 'border border-transparent'
                }`}
                style={nav.planner !== 'master' ? { color: 'var(--t2)' } : {}}
              >
                📅 Master Plan
              </button>
              <button
                onClick={() => setPlanner('plans')}
                className={`cursor-pointer flex-1 text-center py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all heading-font ${
                  nav.planner === 'plans'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25 border border-emerald-500'
                    : 'border border-transparent'
                }`}
                style={nav.planner !== 'plans' ? { color: 'var(--t2)' } : {}}
              >
                📋 My Plans
              </button>
              {features.sources !== false && (
                <button
                  onClick={() => setPlanner('sources')}
                  className={`cursor-pointer flex-1 text-center py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all heading-font ${
                    nav.planner === 'sources'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25 border border-emerald-500'
                      : 'border border-transparent'
                  }`}
                  style={nav.planner !== 'sources' ? { color: 'var(--t2)' } : {}}
                >
                  📚 Sources &amp; Links
                </button>
              )}
            </div>

            {nav.planner === 'master' && <Suspense fallback={<div className="tab-loading">Loading…</div>}><MasterPlan /></Suspense>}
            {nav.planner === 'plans' && <Suspense fallback={<div className="tab-loading">Loading…</div>}><PlansGrid /></Suspense>}
            {nav.planner === 'sources' && <Suspense fallback={<div className="tab-loading">Loading…</div>}><SourcesView /></Suspense>}
          </div>
        )}
      </main>

      {/* Profile modal */}
      <ProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
      <Suspense fallback={null}><NotificationSettingsModal open={notifSettingsOpen} onClose={() => setNotifSettingsOpen(false)} /></Suspense>
      <Suspense fallback={null}><AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} onMarkRead={() => setUnreadMsgCount(0)} /></Suspense>
      <Suspense fallback={null}><ClearProgressModal open={clearProgressOpen} onClose={() => setClearProgressOpen(false)} /></Suspense>
      <Suspense fallback={null}><CustomTopicModal open={customTopicOpen} onClose={() => setCustomTopicOpen(false)} /></Suspense>
    </div>
  );
}
