// Chart colors — Prakriva cream / rose / olive palette.
//
// Recharts uses raw color strings. This is the single source for them, and
// `src/lib/__tests__/brandPalette.test.ts` fails the build if a chart colour
// appears anywhere else or wanders off the five brand hues.

export const CHART_SERIES = [
  "hsl(344 41% 46%)", // rose (brand)
  "hsl(58 23% 32%)",  // olive
  "hsl(3 27% 58%)",   // dusty rose
  "hsl(359 34% 40%)", // brick
  "hsl(58 20% 52%)",  // light olive
  "hsl(344 32% 70%)", // pale rose
] as const;

export const seriesColor = (index: number): string =>
  CHART_SERIES[index % CHART_SERIES.length];

export const CHART_COLORS = {
  primary: "hsl(344 41% 46%)",
  sleep: "hsl(344 36% 58%)",
  activity: "hsl(58 23% 32%)",
  water: "hsl(29 26% 52%)",
  calories: "hsl(359 31% 46%)",
  protein: "hsl(344 44% 38%)",
  carbs: "hsl(29 30% 50%)",
  fat: "hsl(3 30% 50%)",
} as const;

export const CHART_RATING_SCALE = [
  "hsl(58 25% 42%)",  // best — olive
  "hsl(29 26% 50%)",
  "hsl(3 30% 54%)",
  "hsl(359 34% 44%)",
  "hsl(0 55% 38%)",   // worst — the destructive red
] as const;

// Low reads olive, high reads red, and lightness falls the whole way down, so
// the trend line and the badge beside it never tell different stories.
export const CHART_RISK = {
  low: "hsl(58 25% 46%)",
  moderate: "hsl(3 34% 42%)",
  high: "hsl(0 55% 36%)",
} as const;

export const CHART_NEUTRALS = {
  grid: "hsl(29 26% 82%)",
  axis: "hsl(29 18% 70%)",
  tick: "hsl(29 10% 42%)",
  tooltipBg: "hsl(29 42% 96%)",
  tooltipBorder: "hsl(29 26% 78%)",
} as const;
