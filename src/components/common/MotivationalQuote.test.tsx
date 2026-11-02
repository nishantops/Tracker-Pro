import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MotivationalQuote } from './MotivationalQuote';

afterEach(() => vi.useRealTimers());

describe('MotivationalQuote', () => {
  it('shows a quote in a banner', () => {
    render(<MotivationalQuote />);
    const banner = document.querySelector('.motivation-banner')!;
    expect(banner).toBeInTheDocument();
    expect(banner.querySelector('.motivation-text')!.textContent!.length).toBeGreaterThan(10);
  });

  it('is in normal page flow (not a fixed background layer)', () => {
    render(<MotivationalQuote />);
    expect(document.querySelector('.motivation-backdrop')).toBeNull();
    expect((document.querySelector('.motivation-banner') as HTMLElement).style.position).not.toBe('fixed');
  });

  it('rotates every 12 seconds and cycles through at least 40 distinct quotes', () => {
    vi.useFakeTimers();
    render(<MotivationalQuote />);
    const seen = new Set<string>();
    seen.add(document.querySelector('.motivation-text')!.textContent!);
    for (let i = 0; i < 60; i++) {
      act(() => { vi.advanceTimersByTime(12_000); });
      seen.add(document.querySelector('.motivation-text')!.textContent!);
    }
    expect(seen.size).toBeGreaterThanOrEqual(40);
  });

  it('does not change before 12 seconds', () => {
    vi.useFakeTimers();
    render(<MotivationalQuote />);
    const first = document.querySelector('.motivation-text')!.textContent;
    act(() => { vi.advanceTimersByTime(11_000); });
    expect(document.querySelector('.motivation-text')!.textContent).toBe(first);
  });

  it('shows the author line for attributed quotes', () => {
    vi.useFakeTimers();
    render(<MotivationalQuote />);
    let found = false;
    for (let i = 0; i < 60 && !found; i++) {
      found = !!document.querySelector('.motivation-by');
      act(() => { vi.advanceTimersByTime(12_000); });
    }
    expect(found).toBe(true);
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });
});
