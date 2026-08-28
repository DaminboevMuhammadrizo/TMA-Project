import { useEffect, useRef, useState, type RefObject } from 'react';

export interface UseInViewResult<T extends Element> {
  ref: RefObject<T>;
  inView: boolean;
}

/**
 * Tracks whether an element has scrolled near the viewport, so callers can
 * defer expensive work — starting a network fetch/decode for an image or
 * video — until then. With ~1900 grid items this is what actually stops
 * everything from loading at once (native `loading="lazy"` alone is a decent
 * baseline but browsers still vary in how eagerly they prefetch). Stops
 * observing once true: a cell that has already come into view doesn't need
 * to keep watching, and it never needs to go back to a placeholder.
 */
export function useInView<T extends Element>(rootMargin = '400px'): UseInViewResult<T> {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      // Very old browser / test environment — fail open rather than never
      // rendering the media at all.
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setInView(true);
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
