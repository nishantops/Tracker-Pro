import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NotificationToasts } from './NotificationToasts';

const A = (id: string, type = 'info', message = `msg-${id}`) => ({ id, type, message, subtext: undefined });

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('NotificationToasts (push-style alerts at the bottom)', () => {
  it('renders nothing when there are no alerts', () => {
    render(<NotificationToasts alerts={[]} repeatMinutes={30} onDone={vi.fn()} />);
    expect(document.querySelector('.notif-toasts')).toBeNull();
  });

  it('shows the alert message and subtext at the bottom of the page', () => {
    render(<NotificationToasts alerts={[{ id: 'x', type: 'plan', message: '📋 "P" starts today', subtext: '2026-11-02' }]} repeatMinutes={30} onDone={vi.fn()} />);
    expect(screen.getByText('📋 "P" starts today')).toBeInTheDocument();
    expect(screen.getByText('2026-11-02')).toBeInTheDocument();
    expect(document.querySelector('.notif-toasts')).toHaveAttribute('role', 'status');
  });

  it('Done attends the alert', () => {
    const onDone = vi.fn();
    render(<NotificationToasts alerts={[A('daily_reminder')]} repeatMinutes={30} onDone={onDone} />);
    fireEvent.click(screen.getByText('✓ Done'));
    expect(onDone).toHaveBeenCalledWith('daily_reminder');
  });

  it('shows at most 3, most urgent first, and counts the rest', () => {
    render(<NotificationToasts alerts={[A('e', 'exam'), A('p', 'plan'), A('o', 'overdue'), A('r', 'info'), A('w', 'warning')]} repeatMinutes={30} onDone={vi.fn()} />);
    const shown = Array.from(document.querySelectorAll('.notif-toast-msg')).map((n) => n.textContent);
    expect(shown).toEqual(['msg-r', 'msg-o', 'msg-p']);
    expect(screen.getByText('+2 more in the 🔔 alerts')).toBeInTheDocument();
  });

  it('Later hides it, then it pops up again after the repeat interval if still unattended', () => {
    vi.useFakeTimers();
    render(<NotificationToasts alerts={[A('r')]} repeatMinutes={15} onDone={vi.fn()} />);
    fireEvent.click(screen.getByText('Later'));
    expect(screen.queryByText('msg-r')).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(14 * 60_000); });
    expect(screen.queryByText('msg-r')).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2 * 60_000); });
    expect(screen.getByText('msg-r')).toBeInTheDocument();
  });

  it('with repeat off, Later hides it until the page is reloaded', () => {
    vi.useFakeTimers();
    render(<NotificationToasts alerts={[A('r')]} repeatMinutes={0} onDone={vi.fn()} />);
    fireEvent.click(screen.getByText('Later'));
    act(() => { vi.advanceTimersByTime(24 * 60 * 60_000); });
    expect(screen.queryByText('msg-r')).not.toBeInTheDocument();
  });

  it('remembers a "Later" across reloads until it is due', () => {
    vi.useFakeTimers();
    const { unmount } = render(<NotificationToasts alerts={[A('r')]} repeatMinutes={30} onDone={vi.fn()} />);
    fireEvent.click(screen.getByText('Later'));
    unmount();
    render(<NotificationToasts alerts={[A('r')]} repeatMinutes={30} onDone={vi.fn()} />);
    expect(screen.queryByText('msg-r')).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(31 * 60_000); });
    expect(screen.getByText('msg-r')).toBeInTheDocument();
  });

  it('only hides the one alert that was postponed', () => {
    render(<NotificationToasts alerts={[A('a'), A('b')]} repeatMinutes={30} onDone={vi.fn()} />);
    fireEvent.click(screen.getAllByText('Later')[0]);
    expect(screen.queryByText('msg-a')).not.toBeInTheDocument();
    expect(screen.getByText('msg-b')).toBeInTheDocument();
  });
});
