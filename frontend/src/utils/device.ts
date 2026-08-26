import { useEffect, useState } from 'react';

/**
 * True on devices whose primary input is a precise pointer (mouse/trackpad).
 * Used to gate the desktop hover-overlay interaction so touch devices don't
 * get stuck in an awkward "tap to reveal hover state" limbo.
 */
export function usePointerFine(): boolean {
  const [isPointerFine, setIsPointerFine] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches === true,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(pointer: fine)');
    const handler = (e: MediaQueryListEvent) => setIsPointerFine(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isPointerFine;
}
