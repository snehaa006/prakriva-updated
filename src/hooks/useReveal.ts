// Scroll-reveal for the landing page.
//
// One observer per mounted component watches every `.reveal` descendant and
// flips `data-revealed` the first time it enters the viewport; the transition
// itself lives in index.css. Unobserving on reveal keeps it one-shot, so
// content never fades back out when scrolling up.
//
// If IntersectionObserver is unavailable, everything is revealed immediately —
// the page degrades to "no animation", never to "no content".

import { useEffect, useRef } from "react";

interface RevealOptions {
  /** How much of the element must be visible before it reveals. */
  threshold?: number;
  /** Shrinks the viewport so elements reveal slightly before the fold. */
  rootMargin?: string;
}

export function useReveal<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.12,
  rootMargin = "0px 0px -10% 0px",
}: RevealOptions = {}) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    if (targets.length === 0) return;

    const revealAll = () => targets.forEach((el) => el.setAttribute("data-revealed", "true"));

    if (typeof IntersectionObserver === "undefined") {
      revealAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-revealed", "true");
          observer.unobserve(entry.target);
        });
      },
      { threshold, rootMargin }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return containerRef;
}

/**
 * Parallax layer: attach the returned ref to an element and it drifts at
 * `speed` × the page scroll.
 *
 * The transform is written straight to the node inside a rAF rather than held
 * in state — a scroll-rate React re-render of the hero would cost far more
 * than the effect is worth. Does nothing at all under reduced motion.
 */
export function useParallaxLayer<T extends HTMLElement = HTMLDivElement>(speed = 0.15) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const apply = () => {
      frame = 0;
      node.style.transform = `translate3d(0, ${window.scrollY * speed}px, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    apply();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      node.style.transform = "";
    };
  }, [speed]);

  return ref;
}
