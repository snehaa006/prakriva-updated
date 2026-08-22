import { useEffect, useRef, useState } from "react";

/**
 * Tells you when an element has scrolled into view.
 *
 * The app already has `<Reveal>`, which animates on **mount** — right for a
 * dashboard, where everything mounts inside the viewport, and wrong for a long
 * marketing page, where mounting the whole document at once would play every
 * animation on screens the visitor has not reached yet. By the time they
 * scrolled down, the motion would be over.
 *
 * Three deliberate behaviours:
 *
 * - **It latches.** Once seen, an element stays seen. Re-animating a section
 *   every time it crosses the viewport is the thing that makes a scroll-driven
 *   page feel restless.
 * - **It fails open.** With no `IntersectionObserver` — jsdom, an old browser,
 *   a scripting error — it reports `true` immediately, so content is visible
 *   rather than stuck at `opacity: 0`. A reveal animation is never allowed to
 *   be the reason something cannot be read.
 * - **It respects `prefers-reduced-motion`** for the same reason, skipping
 *   straight to visible.
 */
export interface UseInViewOptions {
  /** How much of the element must be showing. Defaults to a sliver. */
  threshold?: number;
  /** Shrink the viewport so a reveal fires slightly before the true edge. */
  rootMargin?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useInView<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.12,
  rootMargin = "0px 0px -10% 0px",
}: UseInViewOptions = {}) {
  const ref = useRef<T | null>(null);
  // Start hidden only when we can actually detect the scroll into view.
  const [inView, setInView] = useState(
    () => typeof IntersectionObserver === "undefined" || prefersReducedMotion(),
  );

  useEffect(() => {
    if (inView) return;

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            // Latched — nothing left to watch.
            observer.disconnect();
          }
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [inView, threshold, rootMargin]);

  return { ref, inView } as const;
}

export default useInView;
