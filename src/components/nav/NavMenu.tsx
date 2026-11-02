import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type AppPage =
  | 'home' | 'syllabus' | 'ca' | 'pyq' | 'testseries'
  | 'master' | 'plans' | 'sources';

interface Item { page: AppPage; icon: string; label: string }

interface SettingsItem { icon: string; label: string; onClick: () => void; danger?: boolean }

interface Props {
  active: AppPage;
  onNavigate: (page: AppPage) => void;
  showPyq: boolean;
  showPlans: boolean;
  showSources: boolean;
  settingsItems: SettingsItem[];
}

export function NavMenu({ active, onNavigate, showPyq, showPlans, showSources, settingsItems }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const tracker: Item[] = [
    { page: 'home', icon: '🏠', label: 'Home' },
    { page: 'syllabus', icon: '📚', label: 'Syllabus' },
    { page: 'ca', icon: '📰', label: 'CA Tracker' },
    ...(showPyq ? [{ page: 'pyq' as const, icon: '❓', label: 'PYQ' }] : []),
    { page: 'testseries', icon: '📝', label: 'Test Series' },
  ];
  const planner: Item[] = showPlans
    ? [
        { page: 'master', icon: '📅', label: 'Master Plan' },
        { page: 'plans', icon: '📋', label: 'My Plans' },
        ...(showSources ? [{ page: 'sources' as const, icon: '🔗', label: 'Sources' }] : []),
      ]
    : [];
  const current = [...tracker, ...planner].find((i) => i.page === active) ?? tracker[0];

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const width = Math.min(272, window.innerWidth - 16);
      setPos({ top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onResize = () => setOpen(false);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const renderItem = (it: Item) => (
    <button
      key={it.page}
      type="button"
      onClick={() => { setOpen(false); onNavigate(it.page); }}
      aria-current={active === it.page ? 'page' : undefined}
      className={`nav-menu-item${active === it.page ? ' active' : ''}`}
    >
      <span className="nav-menu-icon">{it.icon}</span>
      <span>{it.label}</span>
    </button>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        id="nav-menu-btn"
        className={`nav-menu-btn${open ? ' open' : ''}`}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open menu"
        title={`Menu — ${current.label}`}
      >
        <span className="nav-menu-burger" aria-hidden="true"><i /><i /><i /></span>
      </button>
      {open && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 8990 }} onClick={() => setOpen(false)} />
          <nav className="nav-menu-panel" style={{ top: pos.top, left: pos.left }} aria-label="Main navigation">
            <div className="nav-menu-heading">Tracker</div>
            {tracker.map(renderItem)}
            {planner.length > 0 && (
              <>
                <div className="nav-menu-heading">Planner</div>
                {planner.map(renderItem)}
              </>
            )}
            <div className="nav-menu-heading">Account Settings</div>
            {settingsItems.map((s) => (
              <button
                key={s.label}
                type="button"
                className="nav-menu-item"
                style={s.danger ? { color: '#dc2626' } : undefined}
                onClick={() => { setOpen(false); s.onClick(); }}
              >
                <span className="nav-menu-icon">{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </nav>
        </>,
        document.body,
      )}
    </>
  );
}
