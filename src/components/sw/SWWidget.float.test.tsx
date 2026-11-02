import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../../lib/supabase', () => {
  const q: unknown = new Proxy({}, {
    get: (_t, p) => (p === 'then'
      ? (res: (v: unknown) => unknown) => res({ data: null, error: null })
      : () => q),
  });
  return { supabase: { from: () => q } };
});
const stableUser = vi.hoisted(() => ({ id: 'u1' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: stableUser }) }));
vi.mock('../common/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { SWWidget } from './SWWidget';
import { setLayoutLocked } from '../../lib/layoutLock';

const GEOM_KEY = 'upsc_sw_geom_u1';
const widget = () => document.getElementById('sw-widget') as HTMLElement;
const header = () => document.querySelector('.sw-widget-header') as HTMLElement;

let rectSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  setLayoutLocked(true);
  rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const r = this.id === 'sw-widget'
      ? { left: 700, top: 100, width: 300, height: 200 }
      : { left: 0, top: 0, width: 1000, height: 900 };
    return { ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON: () => ({}) } as DOMRect;
  });
});
afterEach(() => { rectSpy.mockRestore(); vi.unstubAllGlobals(); });

const unlock = () => { act(() => { setLayoutLocked(false); }); };

describe('SWWidget — locked (default)', () => {
  it('keeps a stable slot in the grid and the panel inside it', () => {
    render(<SWWidget />);
    const slot = document.getElementById('sw-slot')!;
    expect(slot).toContainElement(widget());
    expect(slot.querySelector('.sw-slot-hole')).toBeNull();
  });

  it('leaves a placeholder in the slot when floated, so the other panels never move', () => {
    localStorage.setItem(GEOM_KEY, JSON.stringify({ x: 120, y: 300, w: 400, h: 260 }));
    render(<SWWidget />);
    const slot = document.getElementById('sw-slot')!;
    expect(slot.querySelector('.sw-slot-hole')).toBeInTheDocument();
    expect(slot).toContainElement(widget());
  });

  it('is docked, has no resize handles and cannot be dragged', () => {
    render(<SWWidget />);
    expect(widget()).not.toHaveClass('sw-floating');
    expect(document.querySelectorAll('.sw-rh')).toHaveLength(0);
    fireEvent.pointerDown(header(), { clientX: 710, clientY: 110 });
    fireEvent.pointerMove(window, { clientX: 400, clientY: 400 });
    expect(widget()).not.toHaveClass('sw-floating');
    expect(widget().getAttribute('style')).toBeNull();
  });
});

describe('SWWidget — unlocked together with the pie matrix', () => {
  it('shows 8 resize handles and a drag affordance when unlocked, and hides them again on lock', () => {
    render(<SWWidget />);
    unlock();
    expect(document.querySelectorAll('.sw-rh')).toHaveLength(8);
    expect(widget()).toHaveClass('sw-unlocked');
    act(() => { setLayoutLocked(true); });
    expect(document.querySelectorAll('.sw-rh')).toHaveLength(0);
  });

  it('dragging the header moves it anywhere (becomes floating) and saves the position', () => {
    render(<SWWidget />);
    unlock();
    fireEvent.pointerDown(header(), { clientX: 710, clientY: 110 });
    fireEvent.pointerMove(window, { clientX: 410, clientY: 360 });
    fireEvent.pointerUp(window);
    expect(widget()).toHaveClass('sw-floating');
    expect(widget().style.top).toBe('350px');
    expect(widget().style.left).toBe('400px');
    expect(widget().style.width).toBe('300px');
    expect(widget().style.height).toBe('200px');
    expect(JSON.parse(localStorage.getItem(GEOM_KEY)!)).toEqual({ x: 400, y: 350, w: 300, h: 200 });
  });

  it('cannot be dragged outside the left/right edge or above the top', () => {
    render(<SWWidget />);
    unlock();
    fireEvent.pointerDown(header(), { clientX: 710, clientY: 110 });
    fireEvent.pointerMove(window, { clientX: -900, clientY: -900 });
    fireEvent.pointerUp(window);
    expect(JSON.parse(localStorage.getItem(GEOM_KEY)!)).toMatchObject({ x: 0, y: 0 });
    fireEvent.pointerDown(header(), { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(window, { clientX: 5000, clientY: 5 });
    fireEvent.pointerUp(window);
    expect(JSON.parse(localStorage.getItem(GEOM_KEY)!).x).toBe(700);
  });

  it('does not start a drag from the Manage button or the visibility toggle', () => {
    render(<SWWidget />);
    unlock();
    fireEvent.pointerDown(screen.getByText(/Manage/), { clientX: 710, clientY: 110 });
    fireEvent.pointerMove(window, { clientX: 300, clientY: 300 });
    expect(widget()).not.toHaveClass('sw-floating');
  });

  it('resizes horizontally and vertically independently (free ratio)', () => {
    render(<SWWidget />);
    unlock();
    fireEvent.pointerDown(document.querySelector('.sw-rh-se')!, { clientX: 1000, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 1000, clientY: 500 });
    fireEvent.pointerUp(window);
    expect(JSON.parse(localStorage.getItem(GEOM_KEY)!)).toMatchObject({ w: 300, h: 400 });
    fireEvent.pointerDown(document.querySelector('.sw-rh-e')!, { clientX: 1000, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 1000, clientY: 300 });
    fireEvent.pointerUp(window);
    fireEvent.pointerDown(document.querySelector('.sw-rh-s')!, { clientX: 800, clientY: 500 });
    fireEvent.pointerMove(window, { clientX: 800, clientY: 540 });
    fireEvent.pointerUp(window);
    expect(JSON.parse(localStorage.getItem(GEOM_KEY)!)).toMatchObject({ w: 300, h: 440 });
  });

  it('enforces a minimum size and keeps the right edge inside the page', () => {
    render(<SWWidget />);
    unlock();
    fireEvent.pointerDown(document.querySelector('.sw-rh-se')!, { clientX: 1000, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(window);
    const g = JSON.parse(localStorage.getItem(GEOM_KEY)!);
    expect(g.w).toBe(224);
    expect(g.h).toBe(120);
    fireEvent.pointerDown(document.querySelector('.sw-rh-e')!, { clientX: 700, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 5000, clientY: 300 });
    fireEvent.pointerUp(window);
    const g2 = JSON.parse(localStorage.getItem(GEOM_KEY)!);
    expect(g2.x + g2.w).toBeLessThanOrEqual(1000);
  });

  it('resizing from the top-left corner moves the origin and grows the panel', () => {
    render(<SWWidget />);
    unlock();
    fireEvent.pointerDown(document.querySelector('.sw-rh-nw')!, { clientX: 700, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 600, clientY: 50 });
    fireEvent.pointerUp(window);
    expect(JSON.parse(localStorage.getItem(GEOM_KEY)!)).toEqual({ x: 600, y: 50, w: 400, h: 250 });
  });

  it('Dock returns the panel to its default place and forgets the saved position', () => {
    render(<SWWidget />);
    unlock();
    fireEvent.pointerDown(header(), { clientX: 710, clientY: 110 });
    fireEvent.pointerMove(window, { clientX: 410, clientY: 360 });
    fireEvent.pointerUp(window);
    fireEvent.click(screen.getByTitle('Return to the default position'));
    expect(widget()).not.toHaveClass('sw-floating');
    expect(localStorage.getItem(GEOM_KEY)).toBeNull();
    expect(screen.queryByTitle('Return to the default position')).not.toBeInTheDocument();
  });

  it('restores a saved floating position after reload, even while locked', () => {
    localStorage.setItem(GEOM_KEY, JSON.stringify({ x: 120, y: 300, w: 400, h: 260 }));
    render(<SWWidget />);
    expect(widget()).toHaveClass('sw-floating');
    expect(widget().style.top).toBe('300px');
    expect(widget().style.width).toBe('400px');
    expect(widget().style.height).toBe('260px');
    expect(document.querySelectorAll('.sw-rh')).toHaveLength(0);
  });

  it('keeps all content working while floating (strength/weakness rails still render)', () => {
    localStorage.setItem(GEOM_KEY, JSON.stringify({ x: 0, y: 0, w: 400, h: 260 }));
    render(<SWWidget />);
    expect(screen.getByText(/STRENGTHS/)).toBeInTheDocument();
    expect(screen.getByText(/WEAKNESSES/)).toBeInTheDocument();
    expect(screen.getByText(/Manage/)).toBeInTheDocument();
  });
});

describe('SWWidget — small screens', () => {
  it('stays docked and not draggable below 960px even if a position was saved', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
    localStorage.setItem(GEOM_KEY, JSON.stringify({ x: 120, y: 300, w: 400, h: 260 }));
    render(<SWWidget />);
    unlock();
    expect(widget()).not.toHaveClass('sw-floating');
    expect(document.querySelectorAll('.sw-rh')).toHaveLength(0);
  });
});
