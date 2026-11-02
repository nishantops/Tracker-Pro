import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const h = vi.hoisted(() => ({ user: { id: 'u1' } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));

import { FocusNext } from './FocusNext';
import { STAGES } from '../../data/syllabus';

beforeEach(() => localStorage.clear());

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
});
