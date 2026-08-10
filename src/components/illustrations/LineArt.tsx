import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Line-art illustrations for the app's subject matter — a bloom, an expecting
 * figure, a parent and infant, a cycle ring.
 *
 * House rules, so a new one drops in without redesigning anything:
 *
 * - One 64×64 viewBox, one stroke weight, round caps and joins, no fills.
 *   They sit next to 1.5px Lucide icons constantly, so they have to read as
 *   the same family of marks rather than as clip art.
 * - `currentColor` throughout. The caller sets the colour with `text-*`, which
 *   means these inherit the accent, the muted foreground, or whatever the
 *   surface needs, and stay correct if the palette moves again.
 * - Each stroke carries `pathLength={1}`, so the draw-on animation is one
 *   keyframe (dashoffset 1 → 0) regardless of the path's real length, and
 *   strokes can be staggered by index without measuring anything in JS.
 *
 * Deliberately abstract: a single continuous contour, no faces, no skin tone,
 * no cartoon. A patient looking at a pregnancy illustration should see a
 * pictogram of her situation, not a character who doesn't look like her.
 */

/** Milliseconds between successive strokes when an illustration draws itself. */
const STROKE_STAGGER_MS = 140;

export interface LineArtProps extends Omit<React.SVGProps<SVGSVGElement>, "children"> {
  /**
   * Draw the strokes on mount. Pass `false` for a static mark — decorative
   * repeats (a list of 20 rows) shouldn't each run their own animation.
   */
  animate?: boolean;
  /** Delay before the first stroke, in ms. Used to stagger against nearby content. */
  delay?: number;
}

/** Shared <svg> shell: sizing, stroke defaults, and accessibility. */
const Frame = React.forwardRef<
  SVGSVGElement,
  LineArtProps & { children: React.ReactNode; title?: string }
>(({ className, children, title, ...props }, ref) => (
  <svg
    ref={ref}
    viewBox="0 0 64 64"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    /* Decorative by default: the surrounding copy always names the life stage
       in words, so a screen reader announcing the drawing too is noise. A
       caller that needs it labelled passes `title` and its own aria-label. */
    role={title ? "img" : undefined}
    aria-hidden={title ? undefined : true}
    aria-label={title}
    className={cn("h-16 w-16", className)}
    {...props}
  >
    {children}
  </svg>
));
Frame.displayName = "LineArtFrame";

/**
 * Renders one stroke of an illustration, wired for the draw-on animation.
 * `index` places it in the stagger; strokes draw in the order they're listed.
 */
function Stroke({
  d,
  index,
  animate,
  delay,
  ...props
}: {
  d: string;
  index: number;
  animate: boolean;
  delay: number;
} & React.SVGProps<SVGPathElement>) {
  if (!animate) return <path d={d} pathLength={1} {...props} />;
  return (
    <path
      d={d}
      pathLength={1}
      strokeDasharray={1}
      className="animate-draw-stroke"
      style={{ animationDelay: `${delay + index * STROKE_STAGGER_MS}ms` }}
      {...props}
    />
  );
}

/** Turns a list of path data into staggered, animated strokes. */
function strokes(paths: string[], animate: boolean, delay: number) {
  return paths.map((d, i) => (
    <Stroke key={d} d={d} index={i} animate={animate} delay={delay} />
  ));
}

// ── Bloom ──────────────────────────────────────────────────────────────────
// Five petals opening from a base. The app's general-wellness mark, and the
// closest thing it has to a logo drawn in the same language as everything else.

const BLOOM = [
  "M32 47C26 35 26 22 32 12c6 10 6 23 0 35Z",
  "M32 47C22 39 16 29 15 20c9 3 15 14 17 27Z",
  "M32 47c10-8 16-18 17-27-9 3-15 14-17 27Z",
  "M32 47c-14-2-24-8-28-16 10-2 22 6 28 16Z",
  "M32 47c14-2 24-8 28-16-10-2-22 6-28 16Z",
  "M15 50c9 5 25 5 34 0",
];

export const Bloom = ({ animate = true, delay = 0, ...props }: LineArtProps) => (
  <Frame {...props}>{strokes(BLOOM, animate, delay)}</Frame>
);

// ── Expecting ──────────────────────────────────────────────────────────────
// A figure in profile, one continuous contour from nape to hem, with an arm
// resting under the curve. Drawn as a pictogram, not a portrait.

const EXPECTING_BODY = [
  "M27.5 18C23 23 21 30 21.5 38c.4 7 2 13 3.5 18",
  "M34.5 18c4.5 3 9 9 9.5 17 .5 8-5 13-11 13-3.5 0-6-1-8-3",
  "M29 34c4-3 10-1 12.5 4",
];

export const Expecting = ({ animate = true, delay = 0, ...props }: LineArtProps) => (
  <Frame {...props}>
    <Stroke
      d="M37 12.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0Z"
      index={0}
      animate={animate}
      delay={delay}
    />
    {EXPECTING_BODY.map((d, i) => (
      <Stroke key={d} d={d} index={i + 1} animate={animate} delay={delay} />
    ))}
  </Frame>
);

// ── Cradle ─────────────────────────────────────────────────────────────────
// An infant's head inside the arc of an arm. Postpartum and breastfeeding.

const CRADLE = [
  "M9 32c0 15 10 25 23 25s23-10 23-25",
  "M40 33a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  "M19 43c7 6 19 6 26 0",
];

export const Cradle = ({ animate = true, delay = 0, ...props }: LineArtProps) => (
  <Frame {...props}>{strokes(CRADLE, animate, delay)}</Frame>
);

// ── Cycle ──────────────────────────────────────────────────────────────────
// A ring with a crescent inside it: the moon-phase figure every cycle-tracking
// app converges on, because it's the one people already read as "a month".

const CYCLE = [
  "M54 32a22 22 0 1 1-44 0 22 22 0 0 1 44 0Z",
  "M32 10a22 22 0 0 1 0 44 15 22 0 0 0 0-44Z",
  "M32 3v4",
];

export const Cycle = ({ animate = true, delay = 0, ...props }: LineArtProps) => (
  <Frame {...props}>{strokes(CYCLE, animate, delay)}</Frame>
);

// ── Plate ──────────────────────────────────────────────────────────────────
// A bowl with a sprig over it. Used where a diet plan is missing, in place of
// the grey icon-in-a-circle that every empty state used to share.

const PLATE = [
  "M11 30h42c0 12-9 21-21 21s-21-9-21-21Z",
  "M14 56h36",
  "M32 26c0-6 4-11 10-13 1 7-3 13-10 13Z",
  "M32 26c0-4-3-8-8-9",
];

export const Plate = ({ animate = true, delay = 0, ...props }: LineArtProps) => (
  <Frame {...props}>{strokes(PLATE, animate, delay)}</Frame>
);

export type LineArtComponent = typeof Bloom;
