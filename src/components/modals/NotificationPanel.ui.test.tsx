import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationPanel } from './NotificationPanel';

const alerts = [
  { id: 'daily_reminder', type: 'info', message: '🌅 Good morning!' },
  { id: 'plan_end_p1', type: 'plan', message: '⏰ "P" ends today', subtext: '2026-11-02' },
];
const props = () => ({
  open: true, onClose: vi.fn(), onOpenSettings: vi.fn(),
  alerts, onDismiss: vi.fn(), onDismissAll: vi.fn(), onRefresh: vi.fn(),
});

describe('NotificationPanel (bell dropdown)', () => {
  it('renders nothing when closed', () => {
    render(<NotificationPanel {...props()} open={false} />);
    expect(document.getElementById('notif-panel')).toBeNull();
  });

  it('lists every alert with its message and subtext, keeping the original title', () => {
    render(<NotificationPanel {...props()} />);
    expect(screen.getByText('🔔 Alerts')).toBeInTheDocument();
    expect(screen.getByText('🌅 Good morning!')).toBeInTheDocument();
    expect(screen.getByText('⏰ "P" ends today')).toBeInTheDocument();
    expect(screen.getByText('2026-11-02')).toBeInTheDocument();
  });

  it('shows the original empty message', () => {
    render(<NotificationPanel {...props()} alerts={[]} />);
    expect(screen.getByText('No alerts right now ✓')).toBeInTheDocument();
    expect(screen.queryByText('✕ All')).not.toBeInTheDocument();
  });

  it('asks for fresh data when opened', () => {
    const p = props();
    render(<NotificationPanel {...p} />);
    expect(p.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('✕ dismisses with the default behaviour (no fixed hours)', () => {
    const p = props();
    render(<NotificationPanel {...p} />);
    fireEvent.click(screen.getAllByTitle('Dismiss for 24h')[0]);
    expect(p.onDismiss).toHaveBeenCalledWith('daily_reminder', undefined);
  });

  it('the snooze menu offers the 5 original options and snoozes for the chosen hours', () => {
    const p = props();
    render(<NotificationPanel {...p} />);
    fireEvent.click(screen.getAllByTitle('Snooze options')[1]);
    for (const l of ['1 hour', '4 hours', '1 day', '3 days', '1 week']) expect(screen.getByText(l)).toBeInTheDocument();
    fireEvent.click(screen.getByText('4 hours'));
    expect(p.onDismiss).toHaveBeenCalledWith('plan_end_p1', 4);
    expect(screen.queryByText('4 hours')).not.toBeInTheDocument();
  });

  it('✕ All and ⚙ Settings work', () => {
    const p = props();
    render(<NotificationPanel {...p} />);
    fireEvent.click(screen.getByText('✕ All'));
    expect(p.onDismissAll).toHaveBeenCalled();
    fireEvent.click(screen.getByText('⚙ Settings'));
    expect(p.onClose).toHaveBeenCalled();
    expect(p.onOpenSettings).toHaveBeenCalled();
  });
});
