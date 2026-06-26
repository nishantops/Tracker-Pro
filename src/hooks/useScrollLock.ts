import { useEffect } from 'react';

/**
 * Locks body scroll when `active` is true.
 * Restores original overflow on cleanup / deactivation.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}
