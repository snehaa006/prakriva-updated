import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCountUp } from "../useCountUp";

/**
 * The count-up is decoration, but it decorates *numbers a patient acts on* —
 * calories eaten, meals logged, adherence. These tests pin the three
 * properties that keep it from ever showing her something untrue.
 */

/** Drives requestAnimationFrame off fake timers so frames are deterministic. */
function installRafClock() {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    setTimeout(() => cb(now), 16) as unknown as number,
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  return {
    advance(ms: number) {
      // Step in frame-sized chunks so each rAF callback sees a fresh clock.
      for (let elapsed = 0; elapsed < ms; elapsed += 16) {
        now += 16;
        act(() => {
          vi.advanceTimersByTime(16);
        });
      }
    },
  };
}

const setReducedMotion = (matches: boolean) =>
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );

beforeEach(() => {
  vi.useFakeTimers();
  setReducedMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useCountUp", () => {
  it("lands on the exact value, not an interpolated approximation", () => {
    const clock = installRafClock();
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, { duration: 100 }), {
      initialProps: { v: 0 },
    });

    rerender({ v: 1470 });
    clock.advance(200);

    // The whole point: "0 / 1470 kcal" must never settle on 1469.
    expect(result.current).toBe(1470);
  });

  it("passes through intermediate values below the target while running", () => {
    const clock = installRafClock();
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, { duration: 1000 }), {
      initialProps: { v: 0 },
    });

    rerender({ v: 100 });
    clock.advance(96);

    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(100);
  });

  it("cuts straight to a lower value instead of counting down", () => {
    const clock = installRafClock();
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, { duration: 1000 }), {
      initialProps: { v: 80 },
    });

    // A weight or an adherence score dropping should not be animated into a
    // little downward performance.
    rerender({ v: 40 });
    clock.advance(16);

    expect(result.current).toBe(40);
  });

  it("returns the value immediately under prefers-reduced-motion", () => {
    setReducedMotion(true);
    const clock = installRafClock();
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, { duration: 1000 }), {
      initialProps: { v: 0 },
    });

    rerender({ v: 42 });
    clock.advance(16);

    expect(result.current).toBe(42);
  });

  it("never renders NaN or Infinity", () => {
    installRafClock();
    const { result, rerender } = renderHook(({ v }) => useCountUp(v), { initialProps: { v: 0 } });

    // A macro total divided by an empty meal list, or a total parsed from a
    // blank field, both arrive here as non-finite.
    rerender({ v: Number.NaN });
    expect(result.current).toBe(0);

    rerender({ v: Number.POSITIVE_INFINITY });
    expect(result.current).toBe(0);
  });

  it("honours the requested decimal places while animating", () => {
    const clock = installRafClock();
    const { result, rerender } = renderHook(
      ({ v }) => useCountUp(v, { duration: 1000, decimals: 1 }),
      { initialProps: { v: 0 } },
    );

    rerender({ v: 9 });
    clock.advance(96);

    const mid = result.current;
    expect(mid).toBeLessThan(9);
    // At one decimal place, 10× the value is a whole number.
    expect(Number.isInteger(Math.round(mid * 10))).toBe(true);
    expect(mid * 10).toBeCloseTo(Math.round(mid * 10), 6);
  });
});
