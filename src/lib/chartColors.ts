// Chart colors in the Prakriva pink palette.
//
// Recharts takes fills and strokes as raw color strings, so charts can't use
// the Tailwind ramps in tailwind.config.ts. This module is the single source
// for them — previously every chart hardcoded its own hex values (a blue line
// here, a green pie slice there), which is how the app drifted off-brand in the
// first place.
//
// Kept as `hsl(...)` strings that mirror the `plum` / `rose` / `coral` ramps,
// so a change to the palette is a change in two obvious places rather than
// twenty scattered hex literals.

/**
 * Categorical series colors, in the order they should be used.
 *
 * Inside one hue family, adjacent slices are told apart by *lightness* as much
 * as hue, so the sequence alternates deep and light rather than walking the
 * ramp top to bottom. Charts should also carry a legend or labels — hue alone
 * is never the only cue.
 */
export const CHART_SERIES = [
  "hsl(345 48% 46%)", // brand rose
  "hsl(318 46% 54%)", // plum
  "hsl(12 50% 56%)", // coral
  "hsl(345 40% 72%)", // light rose
  "hsl(318 42% 34%)", // deep plum
  "hsl(12 45% 74%)", // light coral
] as const;

/** The nth categorical color, wrapping around for long series. */
export const seriesColor = (index: number): string =>
  CHART_SERIES[index % CHART_SERIES.length];

/** Named roles for single-series charts, so each metric stays consistent. */
export const CHART_COLORS = {
  primary: "hsl(345 50% 34%)",
  sleep: "hsl(318 46% 54%)",
  activity: "hsl(12 50% 56%)",
  water: "hsl(345 48% 52%)",
  calories: "hsl(12 50% 56%)",
  protein: "hsl(318 46% 54%)",
  carbs: "hsl(345 48% 52%)",
  fat: "hsl(318 42% 38%)",
} as const;

/**
 * Diverging scale for rating/satisfaction data, best to worst.
 *
 * Deliberately ends on the destructive red rather than another pink: "very
 * dissatisfied" needs to read as a problem at a glance, and red sits inside
 * this pink family anyway (hue 0°, between coral and rose).
 */
export const CHART_RATING_SCALE = [
  "hsl(345 48% 42%)", // best
  "hsl(345 44% 60%)",
  "hsl(12 48% 62%)",
  "hsl(12 52% 50%)",
  "hsl(0 65% 55%)", // worst — matches --destructive
] as const;

/**
 * Risk levels as chart colors, matching the escalation in `RISK_STYLES`
 * (src/lib/riskLevels.ts): pale rose → coral → saturated red. Keep the two in
 * step, so a risk trend line reads the same as the badge beside it.
 */
export const CHART_RISK = {
  low: "hsl(345 45% 72%)",
  moderate: "hsl(8 60% 58%)",
  high: "hsl(0 65% 50%)",
} as const;

/** Neutral chrome: gridlines, axes, tooltip borders. Warm-tinted, not grey. */
export const CHART_NEUTRALS = {
  grid: "hsl(345 20% 90%)",
  axis: "hsl(345 15% 78%)",
  tick: "hsl(345 12% 42%)",
  tooltipBg: "hsl(0 0% 100%)",
  tooltipBorder: "hsl(345 20% 86%)",
} as const;
