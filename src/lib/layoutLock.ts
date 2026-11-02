import { useSyncExternalStore } from 'react';

// Shared "layout locked" flag for the Home panels. Always starts locked on page load.
let locked = true;
const subs = new Set<() => void>();

export const isLayoutLocked = () => locked;

export function setLayoutLocked(next: boolean) {
  if (next === locked) return;
  locked = next;
  subs.forEach((f) => f());
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export function useLayoutLocked(): [boolean, (v: boolean) => void] {
  const v = useSyncExternalStore(subscribe, isLayoutLocked, isLayoutLocked);
  return [v, setLayoutLocked];
}
