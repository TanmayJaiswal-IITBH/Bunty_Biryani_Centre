import { useEffect, useState } from 'react';

/**
 * True while `element` is entirely on screen. Pass the element from a callback ref
 * (`ref={setElement}`) so the observer follows it if it is replaced. False without an element, on
 * the server, and in browsers without IntersectionObserver.
 */
export function useInView(element: Element | null): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry?.isIntersecting ?? false);
      },
      { threshold: 1 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [element]);

  return element ? inView : false;
}
