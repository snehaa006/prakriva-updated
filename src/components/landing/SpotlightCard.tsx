import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A card that leans toward the cursor and carries a highlight under it.
 *
 * Two effects, both driven by the same pointer position and both written to
 * CSS custom properties rather than to React state — a `setState` per
 * `mousemove` re-renders the subtree sixty times a second for a purely visual
 * change, which is how a page like this starts dropping frames.
 *
 * - **Tilt**: a few degrees of rotation about the card's centre. Kept small
 *   (6° at the corners) on purpose; the flashy 20° version reads as a gimmick
 *   and makes body text inside the card genuinely harder to read.
 * - **Spotlight**: a soft radial highlight tracking the pointer, which is what
 *   makes a flat translucent surface look like it has a light above it.
 *
 * Both are pointer-only. Touch devices get the static card, and so does
 * anyone with `prefers-reduced-motion` — the CSS below only applies the
 * transform inside a `(hover: hover)` query, so this needs no JS branch.
 */
export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Maximum tilt at the corners, in degrees. */
  intensity?: number;
  /** Invert the highlight for cards sitting on a deep plum ground. */
  tone?: "light" | "dark";
}

export const SpotlightCard = React.forwardRef<HTMLDivElement, SpotlightCardProps>(
  ({ intensity = 6, tone = "light", className, children, style, onPointerMove, onPointerLeave, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLDivElement | null>(null);

    const setRefs = (node: HTMLDivElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
      onPointerMove?.(event);
      const node = innerRef.current;
      // Fine pointers only: a touch drag would tilt the card and leave it
      // tilted, since there is no "leave" to reset it.
      if (!node || event.pointerType !== "mouse") return;

      const rect = node.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;

      node.style.setProperty("--lp-spot-x", `${x * 100}%`);
      node.style.setProperty("--lp-spot-y", `${y * 100}%`);
      node.style.setProperty("--lp-tilt-x", `${(0.5 - y) * intensity * 2}deg`);
      node.style.setProperty("--lp-tilt-y", `${(x - 0.5) * intensity * 2}deg`);
      node.style.setProperty("--lp-spot-opacity", "1");
    };

    const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
      onPointerLeave?.(event);
      const node = innerRef.current;
      if (!node) return;
      node.style.setProperty("--lp-tilt-x", "0deg");
      node.style.setProperty("--lp-tilt-y", "0deg");
      node.style.setProperty("--lp-spot-opacity", "0");
    };

    return (
      <div
        ref={setRefs}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={cn(
          "group/spot relative isolate transition-transform duration-300 ease-ios",
          // The tilt is applied only where there is a real pointer to track.
          "[transform:perspective(1100px)_rotateX(var(--lp-tilt-x,0deg))_rotateY(var(--lp-tilt-y,0deg))]",
          "motion-reduce:[transform:none]",
          className,
        )}
        style={
          {
            "--lp-spot-x": "50%",
            "--lp-spot-y": "0%",
            ...style,
          } as React.CSSProperties
        }
        {...props}
      >
        {/* The highlight sits above the card's own background but below its
            content, so text never dims as the light passes under it. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-[var(--lp-spot-opacity,0)] transition-opacity duration-300 ease-ios"
          style={{
            background:
              tone === "dark"
                ? "radial-gradient(340px circle at var(--lp-spot-x) var(--lp-spot-y), hsl(var(--lp-petal) / 0.20), transparent 70%)"
                : "radial-gradient(340px circle at var(--lp-spot-x) var(--lp-spot-y), hsl(var(--lp-petal) / 0.55), transparent 70%)",
          }}
        />
        {children}
      </div>
    );
  },
);
SpotlightCard.displayName = "SpotlightCard";

export default SpotlightCard;
