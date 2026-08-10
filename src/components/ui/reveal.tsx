import * as React from "react";

import { cn } from "@/lib/utils";

/** Milliseconds between successive items in a revealed group. */
export const REVEAL_STAGGER_MS = 70;

export interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Position in a staggered group. `0` is the first item and has no delay. */
  index?: number;
  /** Extra delay in ms, applied before the stagger. */
  delay?: number;
  /** Render as a different element — `section`, `li`, and so on. */
  as?: "div" | "section" | "li" | "article";
}

/**
 * Fades content up on mount, staggered by `index`.
 *
 * Kept as a wrapper rather than a class you remember to apply, so the timing
 * is defined once: 70ms apart, 500ms each. Long lists should stagger only the
 * first handful of items — a 40-row table where row 39 waits three seconds
 * for its turn is worse than no animation at all. Cap `index` at the call site.
 *
 * The animation is `both`-filled, so an element waiting its turn is invisible
 * rather than flashing at full opacity first. Under `prefers-reduced-motion`
 * the global guard in index.css collapses every delay to nothing, and the
 * whole group appears at once.
 */
export const Reveal = React.forwardRef<HTMLElement, RevealProps>(
  ({ index = 0, delay = 0, as: Tag = "div", className, style, ...props }, ref) => {
    // `as` is a closed union of intrinsic tags, but TS still can't line up the
    // ref type across them; the cast is confined to this one line.
    const Component = Tag as React.ElementType;
    return (
      <Component
        ref={ref}
        className={cn("animate-rise-in", className)}
        style={{ animationDelay: `${delay + index * REVEAL_STAGGER_MS}ms`, ...style }}
        {...props}
      />
    );
  },
);
Reveal.displayName = "Reveal";
