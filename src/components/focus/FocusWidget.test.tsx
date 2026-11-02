import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  focus: {
    active: false, paused: false, elapsed: 0, dailyHistory: [], todayTotal: 0, weekTotal: 0,
    start: vi.fn(), stop: vi.fn(), pause: vi.fn(), resume: vi.fn(), clearHistory: vi.fn(),
  } as Record<string, unknown>,
  toast: vi.fn(),
  order: [] as string[],
}));

vi.mock('../../hooks/useFocus', () => ({
  useFocus: () => h.focus,
  formatDuration: (s: number) => `D${s}`,
  formatDurationShort: (s: number) => `S${s}`,
}));
vi.mock('../common/Toast', () => ({ useToast: () => ({ showToast: h.toast }) }));

import { FocusWidget } from './FocusWidget';

let fsEl: Element | null = null;
const requestFullscreen = vi.fn();
const exitFullscreen = vi.fn();

beforeEach(() => {
  fsEl = null;
  h.order = [];
  Object.assign(h.focus, { active: false, paused: false, elapsed: 0, todayTotal: 0, weekTotal: 0 });
  (h.focus.start as ReturnType<typeof vi.fn>).mockReset().mockImplementation(async () => { h.order.push('start'); });
  (h.focus.stop as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue(120);
  (h.focus.pause as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue(undefined);
  (h.focus.resume as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue(undefined);
  h.toast.mockClear();
  requestFullscreen.mockReset().mockImplementation(async () => { h.order.push('fullscreen'); fsEl = document.documentElement; });
  exitFullscreen.mockReset().mockImplementation(async () => { fsEl = null; document.dispatchEvent(new Event('fullscreenchange')); });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fsEl });
  document.documentElement.requestFullscreen = requestFullscreen as never;
  document.exitFullscreen = exitFullscreen as never;
});
afterEach(() => { Reflect.deleteProperty(document, 'fullscreenElement'); });

describe('FocusWidget', () => {
  it('shows FOCUS idle state with 00:00 timer', () => {
    render(<FocusWidget />);
    expect(screen.getByText('FOCUS')).toBeInTheDocument();
    expect(screen.getByText('D0')).toBeInTheDocument();
  });

  it('Start requests fullscreen BEFORE awaiting the session start (keeps the click gesture)', async () => {
    render(<FocusWidget />);
    fireEvent.click(document.getElementById('focus-mode-widget')!);
    fireEvent.click(await screen.findByText('START SESSION'));
    await waitFor(() => expect(h.order).toEqual(['fullscreen', 'start']));
    expect(h.toast).toHaveBeenCalledWith('Focus mode started!', 'info');
  });

  it('active session shows the lock overlay with STUDYING and Pause/Stop actions', () => {
    h.focus.active = true; h.focus.elapsed = 65;
    render(<FocusWidget />);
    expect(screen.getByText('STUDYING', { selector: '.focus-lock-badge' })).toBeInTheDocument();
    expect(screen.getByText(/PAUSE/)).toBeInTheDocument();
    expect(screen.getByText(/STOP/)).toBeInTheDocument();
    expect(screen.getByText('Fullscreen locked. Stay focused. You got this.')).toBeInTheDocument();
  });

  it('requests fullscreen when a session becomes active', async () => {
    h.focus.active = true;
    render(<FocusWidget />);
    await waitFor(() => expect(requestFullscreen).toHaveBeenCalled());
  });

  it('locks the Escape key (Chromium keyboard lock) when available', async () => {
    const lock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'keyboard', { configurable: true, value: { lock, unlock: vi.fn() } });
    h.focus.active = true;
    render(<FocusWidget />);
    await waitFor(() => expect(lock).toHaveBeenCalledWith(['Escape']));
    Reflect.deleteProperty(navigator, 'keyboard');
  });

  it('shows a one-click way back when fullscreen is exited unexpectedly', async () => {
    h.focus.active = true;
    render(<FocusWidget />);
    await waitFor(() => expect(requestFullscreen).toHaveBeenCalled());
    expect(screen.queryByText(/Fullscreen exited/)).not.toBeInTheDocument();
    act(() => { fsEl = null; document.dispatchEvent(new Event('fullscreenchange')); });
    const btn = await screen.findByText(/Fullscreen exited — click to return/);
    expect(screen.getByText(/distraction detected/)).toBeInTheDocument();
    requestFullscreen.mockClear();
    fireEvent.click(btn);
    await waitFor(() => expect(requestFullscreen).toHaveBeenCalled());
    act(() => { document.dispatchEvent(new Event('fullscreenchange')); });
    await waitFor(() => expect(screen.queryByText(/Fullscreen exited/)).not.toBeInTheDocument());
  });

  it('clicking the overlay re-enters fullscreen after it was lost, but not on Pause/Stop', async () => {
    h.focus.active = true;
    render(<FocusWidget />);
    await waitFor(() => expect(requestFullscreen).toHaveBeenCalled());
    act(() => { fsEl = null; document.dispatchEvent(new Event('fullscreenchange')); });
    await screen.findByText(/Fullscreen exited/);
    requestFullscreen.mockClear();
    fireEvent.pointerDown(document.querySelector('.focus-lock-actions button')!);
    expect(requestFullscreen).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.querySelector('.focus-lock-content')!);
    await waitFor(() => expect(requestFullscreen).toHaveBeenCalled());
  });

  it('Stop exits fullscreen without flagging a distraction, saves, and toasts the duration', async () => {
    h.focus.active = true;
    render(<FocusWidget />);
    await waitFor(() => expect(requestFullscreen).toHaveBeenCalled());
    fireEvent.click(screen.getByText(/STOP/));
    await waitFor(() => expect(h.focus.stop).toHaveBeenCalled());
    expect(exitFullscreen).toHaveBeenCalled();
    expect(screen.queryByText(/Fullscreen exited/)).not.toBeInTheDocument();
    expect(screen.queryByText(/distraction/)).not.toBeInTheDocument();
    expect(h.toast).toHaveBeenCalledWith('Session saved: D120', 'success');
  });

  it('Pause and Resume call through and toast with main\'s wording', async () => {
    h.focus.active = true;
    const { rerender } = render(<FocusWidget />);
    fireEvent.click(screen.getByText(/PAUSE/));
    await waitFor(() => expect(h.focus.pause).toHaveBeenCalled());
    expect(h.toast).toHaveBeenCalledWith('Session paused', 'info');
    h.focus.paused = true;
    rerender(<FocusWidget />);
    expect(screen.getByText('Take a break. Resume when ready.')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/RESUME/));
    await waitFor(() => expect(h.focus.resume).toHaveBeenCalled());
    expect(h.toast).toHaveBeenCalledWith('Session resumed', 'info');
  });
});
