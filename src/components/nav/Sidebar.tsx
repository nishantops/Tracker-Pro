export type AppPage =
  | 'home' | 'syllabus' | 'ca' | 'pyq' | 'testseries'
  | 'master' | 'plans' | 'sources';

interface Item { page: AppPage; icon: string; label: string }

interface Props {
  active: AppPage;
  onNavigate: (page: AppPage) => void;
  showPyq: boolean;
  showPlans: boolean;
  showSources: boolean;
}

export function Sidebar({ active, onNavigate, showPyq, showPlans, showSources }: Props) {
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

  const renderItem = (it: Item) => (
    <button
      key={it.page}
      type="button"
      onClick={() => onNavigate(it.page)}
      aria-current={active === it.page ? 'page' : undefined}
      className={`app-sidebar-item${active === it.page ? ' active' : ''}`}
    >
      <span className="app-sidebar-icon">{it.icon}</span>
      <span className="app-sidebar-label">{it.label}</span>
    </button>
  );

  return (
    <nav className="app-sidebar" aria-label="Main navigation">
      <div className="app-sidebar-group">
        <div className="app-sidebar-heading">Tracker</div>
        {tracker.map(renderItem)}
      </div>
      {planner.length > 0 && (
        <div className="app-sidebar-group">
          <div className="app-sidebar-heading">Planner</div>
          {planner.map(renderItem)}
        </div>
      )}
    </nav>
  );
}
