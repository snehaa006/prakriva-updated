// Chart colors — Prakriva sand + berry + olive palette.
//
// Recharts uses raw color strings. This is the single source for them.
//
// Everything here lives in the berry family (hue ~344°, running through brick
// and dusty rose to a clinical red at 0°). Because the hues are close,
// adjacent series are separated by lightness as much as by hue —
// `src/lib/__tests__/brandPalette.test.ts` enforces both.

export const CHART_SERIES = [
  "hsl(344 41% 46%)", // berry #A6465F (primary)
  "hsl(3 27% 58%)",   // dusty rose #B17A77
  "hsl(359 31% 36%)", // deep brick
  "hsl(344 30% 66%)", // light berry
  "hsl(12 32% 44%)",  // terracotta
  "hsl(350 22% 74%)", // pale rose
] as const;

export const seriesColor = (index: number): string =>
  CHART_SERIES[index % CHART_SERIES.length];

export const CHART_COLORS = {
  primary: "hsl(344 41% 46%)",
  sleep: "hsl(344 30% 62%)",
  activity: "hsl(3 30% 52%)",
  water: "hsl(350 26% 68%)",
  calories: "hsl(344 41% 46%)",
  protein: "hsl(359 31% 46%)",
  carbs: "hsl(12 34% 52%)",
  fat: "hsl(3 24% 40%)",
} as const;

export const CHART_RATING_SCALE = [
  "hsl(344 34% 56%)", // best
  "hsl(350 30% 50%)",
  "hsl(356 32% 46%)",
  "hsl(358 46% 44%)",
  "hsl(0 62% 42%)",   // worst
] as const;

export const CHART_RISK = {
  low: "hsl(3 27% 58%)",
  moderate: "hsl(357 38% 48%)",
  high: "hsl(0 62% 42%)",
} as const;

export const CHART_NEUTRALS = {
  grid: "hsl(29 24% 87%)",
  axis: "hsl(29 18% 76%)",
  tick: "hsl(48 10% 40%)",
  tooltipBg: "hsl(29 40% 97%)",
  tooltipBorder: "hsl(29 22% 82%)",
} as const;
