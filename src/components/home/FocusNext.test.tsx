import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const h = vi.hoisted(() => ({ user: { id: 'u1' }, load: vi.fn(), save: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('../../lib/cloudPrefs', () => ({ loadCloudPref: h.load, saveCloudPref: h.save }));

import { FocusNext } from './FocusNext';
import { STAGES } from '../../data/syllabus';

beforeEach(() => {
  localStorage.clear();
  h.load.mockReset().mockResolvedValue({ ok: true, found: false, value: null });
  h.save.mockReset();
});

const setWeak = (items: string[]) =>
  localStorage.setItem('upsc_sw_u1', JSON.stringify({ strengths: [], weaknesses: items.map((t, i) => ({ id: `w${i}`, text: t, ts: i })), show_sw: true }));

describe('FocusNext', () => {
  it('with no weaknesses, suggests the least-covered section and links to the syllabus', () => {
    const open = vi.fn();
    render(<FocusNext progress={undefined} onOpenSyllabus={open} />);
    expect(screen.getByText('🎯 Work on this next')).toBeInTheDocument();
    expect(screen.getByText(/least-covered area/)).toBeInTheDocument();
    const items = document.querySelectorAll('.focus-next-list button');
    expect(items.length).toBeGreaterThan(0);
    fireEvent.click(items[0]);
    expect(open).toHaveBeenCalled();
  });

  it('habit-style weaknesses explain why a section is suggested', () => {
    setWeak(['Mobile overuse', 'Getting carried away']);
    render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
    expect(screen.getByText(/Your weaknesses are habit-related/)).toBeInTheDocument();
  });

  it('subject-style weaknesses match topics and show which weakness they came from', () => {
    const word = STAGES[0].sections[0].topics.join(' ').toLowerCase().split(/[^a-z]+/).find((w) => w.length >= 6)!;
    setWeak([word]);
    render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
    expect(screen.getByText('Topics that match your listed weaknesses:')).toBeInTheDocument();
    expect(document.querySelector('.focus-next-meta')!.textContent).toContain(word);
  });

  it('updates when the weakness list changes elsewhere on the page', () => {
    render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
    expect(screen.queryByText(/habit-related/)).not.toBeInTheDocument();
    setWeak(['Mobile overuse']);
    act(() => { window.dispatchEvent(new Event('upsc-sw-changed')); });
    expect(screen.getByText(/habit-related/)).toBeInTheDocument();
  });

  it('says everything is done when all topics are ticked', () => {
    const all = { get: () => ({ is_checked: true }) };
    render(<FocusNext progress={all} onOpenSyllabus={vi.fn()} />);
    expect(screen.getByText('Every syllabus topic is ticked. Time to revise and practise.')).toBeInTheDocument();
    expect(document.querySelectorAll('.focus-next-list button')).toHaveLength(0);
  });

  describe('picking your own topics', () => {
    const firstTopic = STAGES[0].sections[0].topics[0];
    const firstId = `uid-${STAGES[0].sections[0].key}-0`;
    const word = firstTopic.toLowerCase().split(/[^a-z]+/).find((w) => w.length >= 6)!;

    const pinFirst = () => {
      fireEvent.click(screen.getByText('+ Pick topics'));
      fireEvent.change(screen.getByLabelText('Search syllabus topics'), { target: { value: word } });
      fireEvent.click(document.querySelector('.focus-next-picker .focus-next-list button')!);
    };

    it('searches the syllabus and pins a topic to the top of the list, saved locally and to the account', () => {
      render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
      pinFirst();
      expect(screen.getByText(/Your picks/)).toBeInTheDocument();
      expect(document.querySelectorAll('.focus-next-pinned')).toHaveLength(1);
      expect(JSON.parse(localStorage.getItem('upsc_focus_pins_u1')!)).toHaveLength(1);
      expect(h.save).toHaveBeenLastCalledWith('u1', 'focus_pins', { ids: expect.any(Array) });
    });

    it('a pin can be removed', () => {
      localStorage.setItem('upsc_focus_pins_u1', JSON.stringify([firstId]));
      render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
      fireEvent.click(document.querySelector('.focus-next-unpin')!);
      expect(document.querySelectorAll('.focus-next-pinned')).toHaveLength(0);
      expect(JSON.parse(localStorage.getItem('upsc_focus_pins_u1')!)).toEqual([]);
    });

    it('a pinned topic disappears once it is ticked', () => {
      localStorage.setItem('upsc_focus_pins_u1', JSON.stringify([firstId]));
      const ticked = { get: (id: string) => (id === firstId ? { is_checked: true } : undefined) };
      render(<FocusNext progress={ticked} onOpenSyllabus={vi.fn()} />);
      expect(document.querySelectorAll('.focus-next-pinned')).toHaveLength(0);
    });

    it('limits pins to 8 and ignores unknown ids from storage', () => {
      const ids = STAGES[0].sections[0].topics.map((_, i) => `uid-${STAGES[0].sections[0].key}-${i}`);
      localStorage.setItem('upsc_focus_pins_u1', JSON.stringify(['nope', ...ids, ...ids]));
      render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
      expect(document.querySelectorAll('.focus-next-pinned').length).toBeLessThanOrEqual(8);
    });

    it('uses pins saved on another device', async () => {
      h.load.mockResolvedValue({ ok: true, found: true, value: { ids: [firstId] } });
      render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
      expect(await screen.findByText(/Your picks/)).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem('upsc_focus_pins_u1')!)).toEqual([firstId]);
    });

    it('explains how suggestions are chosen', () => {
      render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
      expect(screen.getByText(/Suggestions come from topics matching the words in your Weaknesses/)).toBeInTheDocument();
    });
  });
});