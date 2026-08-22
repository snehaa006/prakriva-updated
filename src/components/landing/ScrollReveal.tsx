import * as React from "react";

import { useInView } from "@/hooks/useInView";
import { cn } from "@/lib/utils";

/** Milliseconds between successive items in a revealed group. */
export const LP_STAGGER_MS = 90;

export interface ScrollRevealProps extends React.HTMLAttributes<HTMLElement> {
  /** Position in a staggered group. `0` is first and has no delay. */
  index?: number;
  /** Extra delay in ms, applied before the stagger. */
  delay?: number;
  as?: "div" | "section" | "article" | "li" | "span" | "header" | "footer";
}

/**
 * Fades content up the first time it scrolls into view.
 *
 * The landing-page counterpart to `<Reveal>`: same shape, but driven by
 * `useInView` rather than by mount, because on a page this long everything
 * mounts at once and mount-time animation would be spent off-screen. The
 * actual motion lives in the `.lp-reveal` class (src/index.css), so the
 * timing is defined once and `prefers-reduced-motion` can switch it off
 * without this component knowing.
 *
 * Cap `index` on long lists — the eleventh card should not wait a second for
 * its turn.
 */
export const ScrollReveal = React.forwardRef<HTMLElement, ScrollRevealProps>(
  ({ index = 0, delay = 0, as: Tag = "div", className, style, ...props }, forwardedRef) => {
    // `as` is a closed union of intrinsic tags, but the observer only ever
    // needs an `HTMLElement`; the cast is confined to this one hook call, the
    // same compromise `components/ui/reveal.tsx` makes for its own `as`.
    const { ref, inView } = useInView<HTMLElement>();
    const Component = Tag as React.ElementType;

    return (
      <Component
        ref={(node: HTMLElement | null) => {
          ref.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) {
            (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
          }
        }}
        className={cn("lp-reveal", inView && "is-visible", className)}
        style={
          {
            "--lp-reveal-delay": `${delay + index * LP_STAGGER_MS}ms`,
            ...style,
          } as React.CSSProperties
        }
        {...props}
      />
    );
  },
);
ScrollReveal.displayName = "ScrollReveal";

export default ScrollReveal;
