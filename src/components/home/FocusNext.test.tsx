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
    const picks = () => document.querySelectorAll('.focus-next-pinned:not(.focus-next-suggested)');
    const stored = () => JSON.parse(localStorage.getItem('upsc_focus_pins_u1')!);
    const search = (v: string) => {
      if (!screen.queryByLabelText('Search syllabus topics')) fireEvent.click(screen.getByText('+ Pick topics'));
      fireEvent.change(screen.getByLabelText('Search syllabus topics'), { target: { value: v } });
    };

    it('searches the syllabus and pins a topic, saved locally and to the account', () => {
      render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
      search(word);
      fireEvent.click(document.querySelector('.focus-next-picker .focus-next-list li:not(:first-child) button')!);
      expect(screen.getByText(/Your picks/)).toBeInTheDocument();
      expect(picks()).toHaveLength(1);
      expect(stored().ids).toHaveLength(1);
      expect(h.save).toHaveBeenLastCalledWith('u1', 'focus_pins', expect.objectContaining({ ids: expect.any(Array) }));
    });

    it('a pin can be removed', () => {
      localStorage.setItem('upsc_focus_pins_u1', JSON.stringify({ ids: [firstId], custom: [], hidden: [] }));
      render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
      fireEvent.click(screen.getByLabelText(/^Unpin /));
      expect(picks()).toHaveLength(0);
      expect(stored().ids).toEqual([]);
    });

    it('a pinned syllabus topic disappears once it is ticked', () => {
      localStorage.setItem('upsc_focus_pins_u1', JSON.stringify({ ids: [firstId], custom: [], hidden: [] }));
      const ticked = { get: (id: string) => (id === firstId ? { is_checked: true } : undefined) };
      render(<FocusNext progress={ticked} onOpenSyllabus={vi.fn()} />);
      expect(picks()).toHaveLength(0);
    });

    it('limits pins to 8 and ignores unknown ids from storage', () => {
      const ids = STAGES[0].sections[0].topics.map((_, i) => `uid-${STAGES[0].sections[0].key}-${i}`);
      localStorage.setItem('upsc_focus_pins_u1', JSON.stringify({ ids: ['nope', ...ids, ...ids] }));
      render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
      expect(picks().length).toBeLessThanOrEqual(8);
    });

    it('still reads the first version\'s plain list of ids', () => {
      localStorage.setItem('upsc_focus_pins_u1', JSON.stringify([firstId]));
      render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
      expect(picks()).toHaveLength(1);
    });

    it('uses picks saved on another device', async () => {
      h.load.mockResolvedValue({ ok: true, found: true, value: { ids: [firstId], custom: [{ id: 'c1', text: 'Revise Laxmikanth ch 5' }], hidden: [] } });
      render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
      expect(await screen.findByText('Revise Laxmikanth ch 5')).toBeInTheDocument();
      expect(stored().custom).toEqual([{ id: 'c1', text: 'Revise Laxmikanth ch 5' }]);
    });

    it('explains how suggestions are chosen', () => {
      render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
      expect(screen.getByText(/Suggestions come from topics matching the words in your Weaknesses/)).toBeInTheDocument();
    });

    describe('topics that are not in the syllabus', () => {
      it('adds your own topic with the button or Enter, and saves it', () => {
        render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
        search('Practise answer writing, 2 a day');
        fireEvent.click(screen.getByText(/Add “Practise answer writing, 2 a day” as my own topic/));
        expect(screen.getByText('Practise answer writing, 2 a day')).toBeInTheDocument();
        expect(screen.getByText('✍ My topic')).toBeInTheDocument();
        expect(stored().custom).toHaveLength(1);
        expect((screen.getByLabelText('Search syllabus topics') as HTMLInputElement).value).toBe('');

        search('Read editorial daily');
        fireEvent.keyDown(screen.getByLabelText('Search syllabus topics'), { key: 'Enter' });
        expect(stored().custom.map((c: { text: string }) => c.text)).toEqual(['Practise answer writing, 2 a day', 'Read editorial daily']);
      });

      it('does nothing on Enter with an empty box', () => {
        render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
        search('   ');
        fireEvent.keyDown(screen.getByLabelText('Search syllabus topics'), { key: 'Enter' });
        expect(localStorage.getItem('upsc_focus_pins_u1')).toBeNull();
      });

      it('can be marked done or removed', () => {
        localStorage.setItem('upsc_focus_pins_u1', JSON.stringify({ ids: [], custom: [{ id: 'a', text: 'Topic A' }, { id: 'b', text: 'Topic B' }], hidden: [] }));
        render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
        fireEvent.click(screen.getByLabelText('Mark done: Topic A'));
        expect(screen.queryByText('Topic A')).not.toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Remove: Topic B'));
        expect(screen.queryByText('Topic B')).not.toBeInTheDocument();
        expect(stored().custom).toEqual([]);
      });

      it('stops at 8 own topics', () => {
        const custom = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, text: `T${i}` }));
        localStorage.setItem('upsc_focus_pins_u1', JSON.stringify({ ids: [], custom, hidden: [] }));
        render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
        search('one more');
        expect(screen.getByText(/Limit of 8 own topics reached/)).toBeInTheDocument();
        fireEvent.click(screen.getByText(/Add “one more”/));
        expect(stored().custom).toHaveLength(8);
      });
    });

    describe('hiding suggestions', () => {
      it('hides a suggestion, and can bring them back', () => {
        render(<FocusNext progress={undefined} onOpenSyllabus={vi.fn()} />);
        const before = document.querySelectorAll('.focus-next-suggested');
        const firstText = before[0]!.querySelector('.focus-next-text')!.textContent;
        fireEvent.click(before[0]!.querySelector('.focus-next-unpin')!);
        expect(Array.from(document.querySelectorAll('.focus-next-suggested .focus-next-text')).map((e) => e.textContent)).not.toContain(firstText);
        expect(stored().hidden).toHaveLength(1);
        fireEvent.click(screen.getByText('Show 1 hidden suggestion'));
        expect(stored().hidden).toEqual([]);
        expect(Array.from(document.querySelectorAll('.focus-next-suggested .focus-next-text')).map((e) => e.textContent)).toContain(firstText);
      });
    });
  });
});