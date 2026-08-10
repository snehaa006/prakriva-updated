import { useEffect, useRef, useState } from "react";

/** Matches the OS "reduce motion" setting. Safe in jsdom, where matchMedia may be absent. */
const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Decelerating ease — fast at first, settling into the final figure. */
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

export interface CountUpOptions {
  /** Animation length in ms. */
  duration?: number;
  /** Decimal places to hold the value to. Defaults to whole numbers. */
  decimals?: number;
}

/**
 * Counts a number up to `value` when it changes.
 *
 * Three rules, because an animated figure in a health app is a place it is
 * genuinely easy to mislead someone:
 *
 * - It **always ends on the exact value**. The last frame is assigned, not
 *   interpolated, so "0 / 1470 kcal" can never settle on 1469.
 * - It **only animates upward, from the previous value**. Counting a weight or
 *   an adherence score *down* to a lower number draws the eye to a fall the
 *   patient didn't ask to have dramatised; downward changes just cut.
 * - Under `prefers-reduced-motion`, or before hydration, it returns the real
 *   value immediately. Nothing ever renders a figure that isn't true.
 */
export function useCountUp(value: number, { duration = 900, decimals = 0 }: CountUpOptions = {}) {
  const [display, setDisplay] = useState(value);
  const frame = useRef<number>();
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;

    const round = (n: number) => Number(n.toFixed(decimals));

    // Non-finite input (a NaN from an empty log, an Infinity from a divide by
    // zero) has no sensible animation and must not be smuggled into the DOM.
    if (!Number.isFinite(value) || prefersReducedMotion() || value <= from || duration <= 0) {
      setDisplay(Number.isFinite(value) ? value : 0);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      if (t >= 1) {
        setDisplay(value); // exact, never the interpolated approximation
        return;
      }
      setDisplay(round(from + (value - from) * easeOut(t)));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [value, duration, decimals]);

  return display;
}
