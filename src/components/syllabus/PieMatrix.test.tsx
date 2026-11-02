import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  reset: vi.fn(),
  layout: [
    { i: 'gs1', x: 0, y: 0, w: 1, h: 1 }, { i: 'gs2', x: 1, y: 0, w: 1, h: 1 }, { i: 'gs3', x: 2, y: 0, w: 1, h: 1 },
    { i: 'gs4', x: 3, y: 0, w: 1, h: 1 }, { i: 'es', x: 4, y: 0, w: 1, h: 1 }, { i: 'a1', x: 0, y: 1, w: 1, h: 1 },
    { i: 'a2', x: 1, y: 1, w: 1, h: 1 }, { i: 'p1', x: 2, y: 1, w: 1, h: 1 }, { i: 'p2', x: 3, y: 1, w: 1, h: 1 },
    { i: 'ca', x: 4, y: 1, w: 1, h: 1 },
  ],
  progress: new Map(),
  profile: { optional_subject: 'anthropology' },
  user: { id: 'u1' },
}));

vi.mock('../../hooks/useTracker', () => ({ useTracker: () => ({ progress: h.progress, getCustomTopics: () => [] }) }));
vi.mock('../../hooks/useProfile', () => ({ useProfile: () => ({ profile: h.profile }) }));
vi.mock('../../hooks/usePieLayouts', () => ({ usePieLayouts: () => ({ layout: h.layout, onLayoutChange: vi.fn(), reset: h.reset }) }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
const cp = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock('../../lib/cloudPrefs', () => ({ loadCloudPref: cp.load, saveCloudPref: cp.save }));

import { PieMatrix } from './PieMatrix';
import { isLayoutLocked, setLayoutLocked } from '../../lib/layoutLock';

const KEY = 'upsc_pie_size_u1';
const card = () => document.querySelector('.neo-card') as HTMLElement;
const lockBtn = () => screen.getByTitle(/pie layout/);

let spy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    constructor(private cb: () => void) {}
    observe() { this.cb(); }
    unobserve() {}
    disconnect() {}
  });
  localStorage.clear();
  setLayoutLocked(true);
  cp.load.mockReset().mockResolvedValue({ ok: true, found: false, value: null });
  cp.save.mockReset();
  h.reset.mockClear();
  spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const isCard = this.classList.contains('neo-card');
    const r = isCard ? { left: 0, top: 0, width: 800, height: 400 } : { left: 0, top: 0, width: 1000, height: 600 };
    return { ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON: () => ({}) } as DOMRect;
  });
});
afterEach(() => { spy.mockRestore(); vi.unstubAllGlobals(); });

describe('PieMatrix — lock', () => {
  it('is locked by default: lock icon, no resize handles', () => {
    render(<PieMatrix />);
    expect(lockBtn()).toHaveAttribute('title', 'Unlock pie layout');
    expect(lockBtn()).toHaveTextContent('🔒');
    expect(document.querySelectorAll('.pie-rh')).toHaveLength(0);
  });

  it('ignores any older "unlocked" value saved in localStorage (always locked on load)', () => {
    localStorage.setItem('pie-grid-locked', '0');
    render(<PieMatrix />);
    expect(isLayoutLocked()).toBe(true);
    expect(document.querySelectorAll('.pie-rh')).toHaveLength(0);
  });

  it('unlock shows three resize handles; lock hides them again; lock is shared', () => {
    render(<PieMatrix />);
    fireEvent.click(lockBtn());
    expect(isLayoutLocked()).toBe(false);
    expect(document.querySelectorAll('.pie-rh')).toHaveLength(3);
    expect(card()).toHaveClass('pie-unlocked');
    fireEvent.click(lockBtn());
    expect(isLayoutLocked()).toBe(true);
    expect(document.querySelectorAll('.pie-rh')).toHaveLength(0);
  });

  it('re-locks when you leave the page (unmount)', () => {
    const { unmount } = render(<PieMatrix />);
    fireEvent.click(lockBtn());
    expect(isLayoutLocked()).toBe(false);
    unmount();
    expect(isLayoutLocked()).toBe(true);
  });
});

describe('PieMatrix — free-ratio resize of the whole panel', () => {
  it('corner handle changes width and height independently and saves the size', () => {
    render(<PieMatrix />);
    fireEvent.click(lockBtn());
    fireEvent.pointerDown(document.querySelector('.pie-rh-se')!, { clientX: 800, clientY: 400 });
    fireEvent.pointerMove(window, { clientX: 950, clientY: 500 });
    fireEvent.pointerUp(window);
    expect(card().style.width).toBe('950px');
    expect(card().style.height).toBe('500px');
    expect(card()).toHaveClass('pie-sized');
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ w: 950, h: 500 });
  });

  it('right edge changes only the width; bottom edge changes only the height', () => {
    render(<PieMatrix />);
    fireEvent.click(lockBtn());
    fireEvent.pointerDown(document.querySelector('.pie-rh-e')!, { clientX: 800, clientY: 200 });
    fireEvent.pointerMove(window, { clientX: 700, clientY: 999 });
    fireEvent.pointerUp(window);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ w: 700, h: 400 });
    fireEvent.pointerDown(document.querySelector('.pie-rh-s')!, { clientX: 400, clientY: 400 });
    fireEvent.pointerMove(window, { clientX: 5, clientY: 600 });
    fireEvent.pointerUp(window);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ w: 700, h: 600 });
  });

  it('keeps a sensible minimum and never grows wider than the page', () => {
    render(<PieMatrix />);
    fireEvent.click(lockBtn());
    fireEvent.pointerDown(document.querySelector('.pie-rh-se')!, { clientX: 800, clientY: 400 });
    fireEvent.pointerMove(window, { clientX: -2000, clientY: -2000 });
    fireEvent.pointerUp(window);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ w: 360, h: 220 });
    fireEvent.pointerDown(document.querySelector('.pie-rh-e')!, { clientX: 360, clientY: 200 });
    fireEvent.pointerMove(window, { clientX: 99999, clientY: 200 });
    fireEvent.pointerUp(window);
    expect(JSON.parse(localStorage.getItem(KEY)!).w).toBe(1000);
  });

  it('cards stretch to fill a taller panel (aspect adjusts automatically)', () => {
    const { unmount } = render(<PieMatrix />);
    const itemH = () => parseFloat((document.querySelector('.react-grid-item') as HTMLElement).style.height);
    const before = itemH();
    unmount();
    localStorage.setItem(KEY, JSON.stringify({ w: null, h: 700 }));
    render(<PieMatrix />);
    expect(itemH()).toBeGreaterThan(before);
  });

  it('a saved size is applied on load even while locked', () => {
    localStorage.setItem(KEY, JSON.stringify({ w: 640, h: 380 }));
    render(<PieMatrix />);
    expect(card().style.width).toBe('640px');
    expect(card().style.height).toBe('380px');
    expect(document.querySelectorAll('.pie-rh')).toHaveLength(0);
  });

  it('cannot be resized while locked', () => {
    render(<PieMatrix />);
    act(() => { fireEvent.pointerMove(window, { clientX: 900, clientY: 900 }); });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('RESET restores the default card layout and the default panel size', () => {
    localStorage.setItem(KEY, JSON.stringify({ w: 640, h: 380 }));
    render(<PieMatrix />);
    fireEvent.click(screen.getByText(/RESET/));
    expect(h.reset).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(card().style.width).toBe('');
    expect(card().style.height).toBe('');
  });
});

describe('PieMatrix — size follows you across devices', () => {
  it('saves a resize to the account', () => {
    render(<PieMatrix />);
    fireEvent.click(lockBtn());
    fireEvent.pointerDown(document.querySelector('.pie-rh-se')!, { clientX: 800, clientY: 400 });
    fireEvent.pointerMove(window, { clientX: 950, clientY: 500 });
    fireEvent.pointerUp(window);
    expect(cp.save).toHaveBeenLastCalledWith('u1', 'pie_size', { w: 950, h: 500 });
  });

  it('RESET saves the default size to the account', () => {
    localStorage.setItem(KEY, JSON.stringify({ w: 640, h: 380 }));
    render(<PieMatrix />);
    fireEvent.click(screen.getByText(/RESET/));
    expect(cp.save).toHaveBeenLastCalledWith('u1', 'pie_size', { w: null, h: null });
  });

  it('applies a size saved from another device', async () => {
    cp.load.mockResolvedValue({ ok: true, found: true, value: { w: 700, h: 420 } });
    render(<PieMatrix />);
    await waitFor(() => expect(card().style.width).toBe('700px'));
    expect(card().style.height).toBe('420px');
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ w: 700, h: 420 });
  });

  it('uploads the local size the first time the account has none', async () => {
    localStorage.setItem(KEY, JSON.stringify({ w: 640, h: 380 }));
    render(<PieMatrix />);
    await waitFor(() => expect(cp.save).toHaveBeenCalledWith('u1', 'pie_size', { w: 640, h: 380 }));
  });

  it('keeps the local size if the account is unreachable', async () => {
    localStorage.setItem(KEY, JSON.stringify({ w: 640, h: 380 }));
    cp.load.mockResolvedValue({ ok: false, found: false, value: null });
    render(<PieMatrix />);
    await act(async () => { await Promise.resolve(); });
    expect(card().style.width).toBe('640px');
    expect(cp.save).not.toHaveBeenCalled();
  });
});

describe('PieMatrix — content unchanged', () => {
  it('keeps its title, buttons and all 10 section cards', () => {
    render(<PieMatrix />);
    expect(screen.getByText('SECTIONAL PIE COMPLETION MATRIX')).toBeInTheDocument();
    expect(screen.getByText('+ ADD CUSTOM TOPIC')).toBeInTheDocument();
    expect(document.querySelectorAll('.pie-card-rgl')).toHaveLength(10);
    for (const t of ['History/Geo', 'Polity/IR', 'Economy/Tech', 'Ethics', 'Essay', 'Paper I', 'Paper II', 'GS Paper I', 'CSAT', 'Current Affairs']) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
  });
});
