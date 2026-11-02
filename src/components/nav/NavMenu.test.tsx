import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { NavMenu } from './NavMenu';

const base = () => ({
  active: 'home' as const,
  onNavigate: vi.fn(),
  showPyq: true,
  showPlans: true,
  showSources: true,
  settingsItems: [
    { icon: 'E', label: 'Update Profile', onClick: vi.fn() },
    { icon: 'X', label: 'Sign Out', onClick: vi.fn(), danger: true },
  ],
});

describe('NavMenu', () => {
  it('renders a hamburger button and no panel until clicked', () => {
    render(<NavMenu {...base()} />);
    const btn = screen.getByRole('button', { name: 'Open menu' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('opens the panel, reports aria-expanded and shows every section', () => {
    render(<NavMenu {...base()} />);
    const btn = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    for (const t of ['Marathon Tracker', 'Strategy Planner', 'Account Settings', 'Home', '1. Syllabus', '4. Test-Series', 'Sources & Links', 'Update Profile', 'Sign Out']) {
      expect(nav).toHaveTextContent(t);
    }
  });

  it('navigates and closes when a page is chosen', () => {
    const p = base();
    render(<NavMenu {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(screen.getByText('2. CA Tracker'));
    expect(p.onNavigate).toHaveBeenCalledWith('ca');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('maps every item to the right page key', () => {
    const p = base();
    render(<NavMenu {...p} />);
    const expected: [string, string][] = [
      ['Home', 'home'], ['1. Syllabus', 'syllabus'], ['2. CA Tracker', 'ca'], ['3. PYQ', 'pyq'],
      ['4. Test-Series', 'testseries'], ['Master Plan', 'master'], ['My Plans', 'plans'], ['Sources & Links', 'sources'],
    ];
    for (const [label, page] of expected) {
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
      fireEvent.click(within(screen.getByRole('navigation')).getByText(label));
      expect(p.onNavigate).toHaveBeenLastCalledWith(page);
    }
  });

  it('runs settings callbacks, closes, and styles Sign Out as danger', () => {
    const p = base();
    render(<NavMenu {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByText('Sign Out').closest('button')).toHaveStyle({ color: '#dc2626' });
    fireEvent.click(screen.getByText('Update Profile'));
    expect(p.settingsItems[0].onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('toggles closed when the hamburger is clicked again, and on resize', () => {
    render(<NavMenu {...base()} />);
    const btn = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    fireEvent.click(btn);
    fireEvent.resize(window);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('highlights the active page for planner pages too', () => {
    render(<NavMenu {...base()} active="plans" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByText('My Plans').closest('button')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Home').closest('button')).not.toHaveAttribute('aria-current');
  });

  it('omits gated entries', () => {
    render(<NavMenu {...base()} showPyq={false} showSources={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const nav = screen.getByRole('navigation');
    expect(nav).not.toHaveTextContent('3. PYQ');
    expect(nav).not.toHaveTextContent('Sources & Links');
    expect(nav).toHaveTextContent('My Plans');
  });
});
