import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The Prakriva brand mark: a butterfly whose body is a woman's silhouette.
 *
 * Drawn as inline SVG rather than shipped as the raster tile in
 * `public/logo.png`, because the landing page needs it at four sizes on two
 * different grounds — cream on plum in the footer, plum on cream in the nav —
 * and a flat PNG can do neither. Vector also means it can draw itself on load
 * and stay crisp on a 3× display at 200px wide.
 *
 * The construction is symmetric by transform, not by hand: `Wing` is drawn
 * once for the right side and mirrored for the left, so the two halves cannot
 * drift apart the way two hand-tuned bezier paths would. Each wing is a single
 * continuous ribbon — a wide upper loop that returns inward and curls into a
 * smaller lower loop — which is what gives the mark its one-stroke,
 * hand-drawn quality.
 *
 * `pathLength={1}` on every stroke follows the same rule as
 * `components/illustrations/LineArt.tsx`: one keyframe (dashoffset 1 → 0)
 * draws any path regardless of its real length, so strokes can be staggered
 * without measuring anything in JS.
 */

/**
 * The right-hand upper wing — a wide, open loop that leaves the shoulder,
 * sweeps out past the frame's shoulder and returns to the waist. The left wing
 * is this same path mirrored about x=70, so the two cannot drift apart.
 */
const WING_UPPER =
  "M71 28 C84 2, 126 -2, 136 18 C144 34, 122 56, 100 52 C88 50, 76 43, 71 32";

/**
 * The right-hand lower wing — a rounder loop that curls back in on itself and
 * ends in a spiral pointing at the body. The inward curl is the detail that
 * makes the mark read as drawn by hand rather than constructed from ellipses.
 */
const WING_LOWER =
  "M76 46 C96 50, 126 56, 126 76 C126 95, 102 98, 95 84 C89 72, 100 63, 106 71";

/**
 * The figure at the centre: shoulder, a carried belly on the right, and a hem
 * falling to a point. Solid rather than outlined — it is the mark's focal
 * point, and an outlined body inside four outlined wings loses it entirely.
 */
const FIGURE_PATH =
  "M68.5 30 C63 34, 60 41, 60.5 48 C61 55, 63 60, 63 66 " +
  "C63 74, 61.5 82, 62.5 90 C63.2 96, 65 101, 67.5 105 " +
  "C70.5 100, 74 96, 78 91 C85 82, 88 72, 85.5 62 " +
  "C83.5 54, 81 45, 79 39 C77.4 34, 74 30.4, 71 29.6 Z";

export type BrandTone = "cream" | "plum" | "current";

export interface BrandButterflyProps extends Omit<React.SVGProps<SVGSVGElement>, "children"> {
  /**
   * Which ground the mark is sitting on. `cream` is the embossed logo artwork
   * for deep plum sections; `plum` inverts it for the cream surface;
   * `current` drops the gradients entirely and inherits `currentColor`, for
   * places like a favicon-sized mark inside a button.
   */
  tone?: BrandTone;
  /** Draw the strokes on mount. Off for repeated decorative marks. */
  animate?: boolean;
  /** Delay before the first stroke, in ms. */
  delay?: number;
}

/** Milliseconds between successive strokes as the mark draws itself. */
const STROKE_STAGGER_MS = 180;

export const BrandButterfly = React.forwardRef<SVGSVGElement, BrandButterflyProps>(
  ({ tone = "cream", animate = false, delay = 0, className, ...props }, ref) => {
    // Gradient ids must be unique per instance — the nav, the hero and the
    // footer all render this mark on one page, and duplicate ids would make
    // every copy paint with whichever definition the browser saw last.
    const uid = React.useId().replace(/:/g, "");
    const fillId = `pk-fill-${uid}`;
    const strokeId = `pk-stroke-${uid}`;

    // `currentColor` mode skips the emboss so the mark can tint itself to
    // whatever the surrounding text colour is.
    const plain = tone === "current";
    const stroke = plain ? "currentColor" : `url(#${strokeId})`;
    const fill = plain ? "currentColor" : `url(#${fillId})`;

    const strokeProps = (index: number) => ({
      pathLength: 1,
      strokeDasharray: 1,
      className: animate ? "animate-draw-stroke" : undefined,
      style: animate
        ? { animationDelay: `${delay + index * STROKE_STAGGER_MS}ms` }
        : undefined,
    });

    return (
      <svg
        ref={ref}
        viewBox="0 -8 140 120"
        fill="none"
        /* Decorative: the wordmark beside it always names the brand, so a
           screen reader announcing the drawing too is duplication. */
        aria-hidden="true"
        focusable="false"
        className={cn("h-12 w-auto", className)}
        {...props}
      >
        {!plain && (
          <defs>
            {/* Two stops apart on the same warm axis is the whole emboss: a
                lit top-left edge falling to a shadowed bottom-right. The
                figure gets a slightly wider spread than the wings so it reads
                as the nearer, solid element. */}
            <linearGradient id={fillId} x1="0" y1="0" x2="0.35" y2="1">
              {tone === "cream" ? (
                <>
                  <stop offset="0%" stopColor="hsl(var(--lp-cream-hi))" />
                  <stop offset="52%" stopColor="hsl(var(--lp-cream))" />
                  <stop offset="100%" stopColor="hsl(var(--lp-cream-lo))" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="hsl(var(--lp-mauve))" />
                  <stop offset="55%" stopColor="hsl(var(--lp-plum))" />
                  <stop offset="100%" stopColor="hsl(var(--lp-plum-deep))" />
                </>
              )}
            </linearGradient>
            <linearGradient id={strokeId} x1="0.1" y1="0" x2="0.9" y2="1">
              {tone === "cream" ? (
                <>
                  <stop offset="0%" stopColor="hsl(var(--lp-cream-hi))" />
                  <stop offset="60%" stopColor="hsl(var(--lp-cream))" />
                  <stop offset="100%" stopColor="hsl(var(--lp-cream-lo))" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="hsl(var(--lp-rose))" />
                  <stop offset="55%" stopColor="hsl(var(--lp-plum))" />
                  <stop offset="100%" stopColor="hsl(var(--lp-plum-deep))" />
                </>
              )}
            </linearGradient>
          </defs>
        )}

        <g
          stroke={stroke}
          strokeWidth={4.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Each wing is drawn once on the right and mirrored to the left. */}
          <path d={WING_UPPER} {...strokeProps(0)} />
          <path d={WING_UPPER} transform="matrix(-1 0 0 1 140 0)" {...strokeProps(0)} />
          <path d={WING_LOWER} {...strokeProps(1)} />
          <path d={WING_LOWER} transform="matrix(-1 0 0 1 140 0)" {...strokeProps(1)} />
        </g>

        {/* The figure is solid, not outlined — it is the mark's focal point,
            and an outlined body inside two outlined wings loses it. */}
        <g fill={fill}>
          <path
            d={FIGURE_PATH}
            className={animate ? "animate-fade-in" : undefined}
            style={animate ? { animationDelay: `${delay + 2 * STROKE_STAGGER_MS}ms` } : undefined}
          />
          <circle cx="70" cy="24" r="6.4" />
          {/* The two antenna beads, set at slightly different heights so the
              mark never reads as a face with two eyes. */}
          <circle
            cx="61.5"
            cy="9"
            r="3.4"
            className={animate ? "animate-fade-in" : undefined}
            style={animate ? { animationDelay: `${delay + 3 * STROKE_STAGGER_MS}ms` } : undefined}
          />
          <circle
            cx="77.5"
            cy="7"
            r="3.4"
            className={animate ? "animate-fade-in" : undefined}
            style={
              animate ? { animationDelay: `${delay + 3 * STROKE_STAGGER_MS + 90}ms` } : undefined
            }
          />
        </g>
      </svg>
    );
  },
);
BrandButterfly.displayName = "BrandButterfly";

const wordmarkSizes = {
  sm: "text-2xl",
  md: "text-3xl",
  lg: "text-5xl",
  xl: "text-6xl sm:text-7xl",
} as const;

const markSizes = {
  sm: "h-7",
  md: "h-9",
  lg: "h-14",
  xl: "h-24",
} as const;

export interface BrandLockupProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: keyof typeof wordmarkSizes;
  tone?: BrandTone;
  /** Hide the wordmark and show the butterfly alone. */
  markOnly?: boolean;
  /** Stack the wordmark under the mark instead of setting it alongside. */
  stacked?: boolean;
  animate?: boolean;
}

/**
 * Mark plus wordmark, in the proportions the logo artwork uses.
 *
 * The wordmark is live text in `font-display` rather than an image, so it
 * stays selectable, translatable and readable to a screen reader — which is
 * also why the butterfly beside it is `aria-hidden`, leaving exactly one
 * accessible name for the brand instead of two.
 */
export const BrandLockup = React.forwardRef<HTMLDivElement, BrandLockupProps>(
  (
    { size = "md", tone = "plum", markOnly = false, stacked = false, animate = false, className, ...props },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center",
        stacked ? "flex-col gap-3" : "gap-2.5",
        className,
      )}
      {...props}
    >
      <BrandButterfly tone={tone} animate={animate} className={markSizes[size]} />
      {!markOnly && (
        <span
          className={cn(
            "font-display font-medium leading-none tracking-[0.01em]",
            wordmarkSizes[size],
            tone === "cream" ? "lp-emboss" : "text-lp-plum",
          )}
        >
          Prakriva
        </span>
      )}
    </div>
  ),
);
BrandLockup.displayName = "BrandLockup";
