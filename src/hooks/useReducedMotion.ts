import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** Reads the OS setting. Safe in jsdom, where `matchMedia` may be absent. */
const read = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(QUERY).matches;

/**
 * Tracks the OS "reduce motion" setting, and re-renders when it changes.
 *
 * The blanket guard in `index.css` collapses CSS animations and transitions to
 * 0.01ms, which covers everything driven by a stylesheet. It cannot reach
 * motion driven from JS — a scroll-linked transform keeps moving because the
 * scroll position keeps changing, not because a transition is running. Reach
 * for this hook in those cases and render a still version instead.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(read);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(QUERY);
    const onChange = () => setReduced(mql.matches);
    onChange(); // in case it changed between first render and this effect
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
