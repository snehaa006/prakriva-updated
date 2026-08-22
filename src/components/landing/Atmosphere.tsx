import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The page's weather: a field of pink muhly grass along the bottom of the
 * hero, and the soft mauve bokeh that floats behind it.
 *
 * Both are drawn rather than photographed. A hero photograph would be the
 * obvious route and it is the wrong one here: the reference images are 2–4MB
 * of grain apiece, they cannot follow the palette if it ever moves, and text
 * laid over a photograph needs a scrim that muddies exactly the softness we
 * are after. Vector costs a few kilobytes, stays sharp at any density, and
 * takes its colours from the same `--lp-*` tokens as everything else.
 */

/**
 * Deterministic PRNG (mulberry32).
 *
 * The field must be irregular but it must not be *random per render* — a new
 * layout on every re-render would make the grass twitch, and would differ
 * between the server-rendered and client-rendered trees if this ever moves
 * behind SSR. Same seed, same field, every time.
 */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Blade {
  d: string;
  tipX: number;
  tipY: number;
  width: number;
  opacity: number;
}

/**
 * One band of grass. Blades lean a little further at the tip than the base,
 * which is what stops a field of curves from reading as a comb.
 */
function buildBand(count: number, seed: number, minHeight: number, maxHeight: number): Blade[] {
  const random = seededRandom(seed);
  const blades: Blade[] = [];

  for (let i = 0; i < count; i += 1) {
    // Jittered rather than evenly spaced — even spacing is instantly legible
    // as machine-made.
    const x = (i / count) * 1240 - 20 + (random() - 0.5) * 22;
    const height = minHeight + random() * (maxHeight - minHeight);
    const lean = (random() - 0.5) * 46;
    const tipX = x + lean;
    const tipY = 300 - height;
    // Control point at two-thirds, offset against the lean, gives the blade
    // its S-bend instead of a straight diagonal.
    const controlX = x + lean * 0.28;
    const controlY = 300 - height * 0.55;

    blades.push({
      d: `M${x.toFixed(1)} 300 Q${controlX.toFixed(1)} ${controlY.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}`,
      tipX,
      tipY,
      width: 1.1 + random() * 1.7,
      opacity: 0.3 + random() * 0.55,
    });
  }

  return blades;
}

// Three bands, far to near. Built once at module load, not per render.
const FAR = buildBand(170, 20240816, 120, 235);
const MID = buildBand(150, 74113, 80, 175);
const NEAR = buildBand(85, 991027, 44, 118);

export interface MuhlyFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Set `false` for a still field — used where motion would compete. */
  animate?: boolean;
  /**
   * The surface the field is standing on, as a bare HSL triple.
   *
   * Every blade is rooted on the same baseline, so without something to bed
   * them into, the bottom of the field is a razor-straight line of stroke ends
   * against whatever comes next. This colour is faded up over the lowest fifth
   * of the field to be that ground.
   */
  ground?: string;
}

/**
 * The muhly grass field. Sits at the bottom of a section, decorative only.
 *
 * The bands sway at different rates so the field has depth; the sway is a
 * shallow skew rather than a rotation, so blades stay rooted where they are
 * drawn instead of sliding along the ground.
 */
export function MuhlyField({
  animate = true,
  ground = "var(--lp-cream-hi)",
  className,
  ...props
}: MuhlyFieldProps) {
  const bands: Array<{ blades: Blade[]; color: string; blur: number; duration: string; opacity: number }> = [
    { blades: FAR, color: "var(--lp-petal)", blur: 3, duration: "15s", opacity: 0.6 },
    { blades: MID, color: "var(--lp-rose)", blur: 1.4, duration: "12s", opacity: 0.8 },
    { blades: NEAR, color: "var(--lp-mauve)", blur: 0.4, duration: "9.5s", opacity: 0.45 },
  ];

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none select-none overflow-hidden", className)}
      style={{
        // Fade the tips out rather than letting the field stop on the
        // container's top edge. Blades are drawn to a fixed height, so without
        // this the tallest ones end on a straight horizontal line — the same
        // problem the `ground` gradient solves at the bottom, at the other end
        // of the blade. Doubled with the `-webkit-` prefix for Safari.
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, hsl(0 0% 0% / 0.35) 18%, hsl(0 0% 0%) 46%)",
        maskImage:
          "linear-gradient(to bottom, transparent 0%, hsl(0 0% 0% / 0.35) 18%, hsl(0 0% 0%) 46%)",
      }}
      {...props}
    >
      {/* The haze the field sits in — the photographs read as a pink cloud
          before they read as individual blades, and this is that cloud. */}
      <div
        className="absolute inset-x-0 bottom-0 h-2/3"
        style={{
          background:
            "linear-gradient(to top, hsl(var(--lp-petal) / 0.40) 0%, hsl(var(--lp-petal) / 0.12) 50%, transparent 100%)",
        }}
      />

      {bands.map((band, index) => (
        <svg
          key={index}
          viewBox="0 0 1200 300"
          /* `none`, not `slice`. The field is a wide, short band — often 7:1 —
             and `slice` scales the 4:1 viewBox to cover it, which crops the
             top half of every blade and leaves a row of cut-off vertical
             lines that reads as a curtain rather than as grass. Stretching
             instead squashes the blades, which on an organic shape is
             invisible. */
          preserveAspectRatio="none"
          className={cn(
            "absolute inset-0 h-full w-full origin-bottom",
            animate && "animate-lp-sway",
          )}
          style={{
            filter: band.blur ? `blur(${band.blur}px)` : undefined,
            opacity: band.opacity,
            animationDuration: band.duration,
            // Offset so the three bands are never in phase — in phase, the
            // whole field tips as one board.
            animationDelay: `${index * -3.5}s`,
          }}
        >
          <g stroke={`hsl(${band.color})`} strokeLinecap="round" fill="none">
            {band.blades.map((blade, i) => (
              <path key={i} d={blade.d} strokeWidth={blade.width} opacity={blade.opacity} />
            ))}
          </g>
          {/* The seed heads: the feathery pink tips that give muhly grass its
              name. Only on the nearest band, where they would be visible. */}
          {band.blades === NEAR &&
            band.blades.map((blade, i) => (
              <ellipse
                key={`tip-${i}`}
                cx={blade.tipX}
                cy={blade.tipY}
                rx={2.6}
                ry={5.4}
                fill={`hsl(var(--lp-petal))`}
                opacity={blade.opacity * 0.8}
              />
            ))}
        </svg>
      ))}

      {/* The ground. Painted over the roots, not behind them — the blades have
          to disappear *into* the surface, and a band behind them would just
          move the hard line. */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/5"
        style={{
          background: `linear-gradient(to top, hsl(${ground}) 15%, hsl(${ground} / 0) 100%)`,
        }}
      />
    </div>
  );
}

/** One drifting bokeh orb: position, size, tint and how long its loop takes. */
interface Orb {
  top: string;
  left: string;
  size: string;
  tint: string;
  duration: string;
  delay: string;
  opacity: number;
}

const HERO_ORBS: Orb[] = [
  { top: "-8%", left: "-6%", size: "34rem", tint: "var(--lp-petal)", duration: "26s", delay: "0s", opacity: 0.55 },
  { top: "6%", left: "62%", size: "28rem", tint: "var(--lp-mauve)", duration: "31s", delay: "-8s", opacity: 0.28 },
  { top: "42%", left: "18%", size: "22rem", tint: "var(--lp-rose)", duration: "23s", delay: "-14s", opacity: 0.3 },
  { top: "-14%", left: "36%", size: "24rem", tint: "var(--lp-blush)", duration: "35s", delay: "-4s", opacity: 0.6 },
];

export interface BokehProps extends React.HTMLAttributes<HTMLDivElement> {
  orbs?: Orb[];
}

/**
 * Soft out-of-focus colour drifting behind the content — the bokeh of the
 * reference photographs, as four blurred radial gradients.
 *
 * Deliberately few and deliberately large: a dozen small orbs reads as
 * confetti, and each one is a separate blurred layer for the compositor to
 * paint on every frame.
 */
export function Bokeh({ orbs = HERO_ORBS, className, ...props }: BokehProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      {...props}
    >
      {orbs.map((orb, index) => (
        <div
          key={index}
          className="absolute animate-lp-drift rounded-full blur-3xl"
          style={{
            top: orb.top,
            left: orb.left,
            width: orb.size,
            height: orb.size,
            opacity: orb.opacity,
            animationDuration: orb.duration,
            animationDelay: orb.delay,
            background: `radial-gradient(circle at 35% 35%, hsl(${orb.tint}) 0%, hsl(${orb.tint} / 0.35) 45%, transparent 72%)`,
          }}
        />
      ))}
    </div>
  );
}
