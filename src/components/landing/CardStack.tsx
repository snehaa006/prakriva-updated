import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Cards that stack as you scroll.
 *
 * Each card sticks a little lower than the one before it, so as the page moves
 * the next card slides up and settles over its predecessor, which shrinks back
 * and dims. What you end up looking at is a physical pile — the earlier steps
 * still visible as edges along the top, the current one in front.
 *
 * How it is driven matters. The stacking itself is plain `position: sticky`,
 * so it works with no JavaScript at all; the scroll listener only adds the
 * *depth* — the slight scale-down and the plum veil over the card being
 * covered. If the listener never runs, or is switched off for reduced motion,
 * the section still reads correctly, just flatter. Progress is computed from a
 * single measurement of the section (not one per card) inside a
 * `requestAnimationFrame`, so a scroll event never does layout work N times.
 */

/** How far each card sits below the previous one's stick point, in px. */
const STEP_PX = 16;

/** How much a card shrinks once it is fully covered. */
const MAX_SCALE_DOWN = 0.06;

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * How far the section has been scrolled through, 0 → 1.
 *
 * Returns 0 and never listens when motion is reduced, which is what makes the
 * cards sit flat and undimmed for anyone who asked for that.
 */
function useSectionProgress(ref: React.RefObject<HTMLElement>) {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === "undefined" || prefersReducedMotion()) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const element = ref.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      // The section is "travelling" from the moment its top passes the top of
      // the viewport until its bottom reaches the bottom.
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) {
        setProgress(0);
        return;
      }
      setProgress(Math.min(1, Math.max(0, -rect.top / travel)));
    };

    const onScroll = () => {
      // Coalesce: a scroll gesture fires far more often than the screen paints.
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref]);

  return progress;
}

export interface CardStackProps {
  /** One node per card, in the order they should stack. */
  children: React.ReactNode;
  /** Distance from the top of the viewport the first card sticks at, in px. */
  offset?: number;
  /**
   * Corner radius of the cards being stacked. The veil that dims a covered
   * card inherits it, so a mismatch here shows up as square corners bleeding
   * past a rounded card.
   */
  radius?: string;
  className?: string;
}

export function CardStack({ children, offset = 104, radius = "28px", className }: CardStackProps) {
  const sectionRef = React.useRef<HTMLDivElement>(null);
  const progress = useSectionProgress(sectionRef);

  const cards = React.Children.toArray(children);
  const total = cards.length;

  return (
    <div ref={sectionRef} className={cn("relative", className)}>
      {cards.map((card, index) => {
        // Each card owns one segment of the section's scroll. `covered` runs
        // 0 → 1 across the segment during which the *next* card rides up over
        // this one; the last card is never covered.
        const covered =
          index === total - 1 ? 0 : Math.min(1, Math.max(0, progress * (total - 1) - index));

        return (
          <div
            key={index}
            className="sticky"
            style={{ top: `${offset + index * STEP_PX}px` }}
          >
            <div
              className="origin-top transition-transform duration-200 ease-ios will-change-transform"
              style={{ transform: `scale(${1 - MAX_SCALE_DOWN * covered})` }}
            >
              <div className="relative" style={{ borderRadius: radius }}>
                {card}
                {/* The veil rather than an opacity drop on the card itself:
                    fading the card would fade its shadow too and the pile
                    would stop reading as stacked. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[inherit] bg-lp-plum-deep transition-opacity duration-200 ease-ios"
                  style={{ opacity: covered * 0.45 }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default CardStack;
