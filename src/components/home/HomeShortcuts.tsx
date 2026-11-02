import type { AppPage } from '../nav/Sidebar';

interface Props {
  onNavigate: (page: AppPage) => void;
  showPyq: boolean;
  showPlans: boolean;
}

export function HomeShortcuts({ onNavigate, showPyq, showPlans }: Props) {
  const cards: { page: AppPage; icon: string; title: string; sub: string }[] = [
    { page: 'syllabus', icon: '📚', title: 'Syllabus', sub: 'Continue ticking off topics' },
    { page: 'ca', icon: '📰', title: 'CA Tracker', sub: 'Daily current affairs notes' },
    ...(showPyq ? [{ page: 'pyq' as const, icon: '❓', title: 'PYQ', sub: 'Practice previous year questions' }] : []),
    { page: 'testseries', icon: '📝', title: 'Test Series', sub: 'Log scores and review' },
    ...(showPlans ? [{ page: 'master' as const, icon: '📅', title: 'Master Plan', sub: 'Your schedule at a glance' }] : []),
  ];

  return (
    <div className="home-shortcuts">
      {cards.map((c) => (
        <button key={c.page} type="button" className="home-shortcut neo-card" onClick={() => onNavigate(c.page)}>
          <span className="home-shortcut-icon">{c.icon}</span>
          <span className="home-shortcut-title">{c.title}</span>
          <span className="home-shortcut-sub">{c.sub}</span>
        </button>
      ))}
    </div>
  );
}
