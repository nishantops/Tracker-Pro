import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MotivationalQuote, QUOTE_ROTATE_MS } from './MotivationalQuote';
import { QUOTES } from '../../data/quotes';

afterEach(() => vi.useRealTimers());

const text = () => document.querySelector('.motivation-text')!.textContent!;

describe('quote data', () => {
  it('has at least 200 quotes, all non-empty and unique', () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(200);
    const texts = QUOTES.map((q) => q.text);
    expect(texts.every((t) => t.trim().length > 3)).toBe(true);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('covers every requested theme', () => {
    const count = (tag: string) => QUOTES.filter((q) => q.tag === tag).length;
    for (const [tag, min] of Object.entries({
      gita: 15, hanuman: 15, shiva: 12, shakti: 8, parents: 8, sanskrit: 10, hindi: 5,
      mahabharata: 8, fight: 8, silence: 8, future: 8, hardwork: 8, abstract: 8,
    })) expect(count(tag), tag).toBeGreaterThanOrEqual(min);
  });

  it('includes Sanskrit/Hindi stotra text in Devanagari with an English meaning', () => {
    const dev = QUOTES.filter((q) => /[\u0900-\u097F]/.test(q.text));
    expect(dev.length).toBeGreaterThanOrEqual(60);
    expect(dev.every((q) => !!q.meaning)).toBe(true);
  });

  it('has the well-known verses', () => {
    const all = QUOTES.map((q) => q.text).join('\n');
    for (const s of ['कर्मण्येवाधिकारस्ते', 'ॐ नमः शिवाय', 'बल बुद्धि विद्या देहु मोहिं', 'या देवी सर्वभूतेषु शक्तिरूपेण', 'उत्तिष्ठत जाग्रत', 'मातृदेवो भव']) {
      expect(all).toContain(s);
    }
  });

  it('never leaves "undefined" text', () => {
    expect(JSON.stringify(QUOTES)).not.toMatch(/undefined/);
  });
});

describe('MotivationalQuote', () => {
  it('rotates every 60 seconds (at least a minute)', () => {
    expect(QUOTE_ROTATE_MS).toBeGreaterThanOrEqual(60_000);
  });

  it('shows a quote in a banner in normal page flow (not a fixed background layer)', () => {
    render(<MotivationalQuote />);
    const banner = document.querySelector('.motivation-banner') as HTMLElement;
    expect(banner).toBeInTheDocument();
    expect(text().length).toBeGreaterThan(3);
    expect(document.querySelector('.motivation-backdrop')).toBeNull();
    expect(banner.style.position).not.toBe('fixed');
  });

  it('does not change before 60 seconds, then changes', () => {
    vi.useFakeTimers();
    render(<MotivationalQuote />);
    const first = text();
    act(() => { vi.advanceTimersByTime(59_000); });
    expect(text()).toBe(first);
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(text()).not.toBe(first);
  });

  it('cycles through every quote exactly once per round', () => {
    vi.useFakeTimers();
    render(<MotivationalQuote />);
    const seen = new Set<string>([text()]);
    for (let i = 0; i < QUOTES.length - 1; i++) {
      act(() => { vi.advanceTimersByTime(QUOTE_ROTATE_MS); });
      seen.add(text());
    }
    expect(seen.size).toBe(QUOTES.length);
  });

  it('shows the meaning line for sacred verses and the source when present', () => {
    vi.useFakeTimers();
    render(<MotivationalQuote />);
    let sawMeaning = false;
    let sawSource = false;
    for (let i = 0; i < QUOTES.length; i++) {
      if (document.querySelector('.motivation-sacred') && document.querySelector('.motivation-meaning')) sawMeaning = true;
      if (document.querySelector('.motivation-by')) sawSource = true;
      act(() => { vi.advanceTimersByTime(QUOTE_ROTATE_MS); });
    }
    expect(sawMeaning).toBe(true);
    expect(sawSource).toBe(true);
  });
});
