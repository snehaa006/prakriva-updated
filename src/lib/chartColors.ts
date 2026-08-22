// Chart colors — Prakriva warm cream + sage + amber palette.
//
// Recharts uses raw color strings. This is the single source for them.

export const CHART_SERIES = [
  "hsl(158 38% 28%)", // sage green (primary)
  "hsl(20 90% 52%)",  // amber-orange (accent)
  "hsl(16 48% 50%)",  // terracotta
  "hsl(158 30% 50%)", // light sage
  "hsl(28 70% 44%)",  // deep amber
  "hsl(16 38% 68%)",  // light terracotta
] as const;

export const seriesColor = (index: number): string =>
  CHART_SERIES[index % CHART_SERIES.length];

export const CHART_COLORS = {
  primary: "hsl(158 38% 28%)",
  sleep: "hsl(256 45% 58%)",
  activity: "hsl(20 90% 52%)",
  water: "hsl(210 60% 52%)",
  calories: "hsl(20 90% 52%)",
  protein: "hsl(158 38% 34%)",
  carbs: "hsl(28 70% 48%)",
  fat: "hsl(16 42% 42%)",
} as const;

export const CHART_RATING_SCALE = [
  "hsl(158 38% 28%)", // best
  "hsl(158 30% 48%)",
  "hsl(38 55% 52%)",
  "hsl(20 70% 54%)",
  "hsl(0 65% 55%)",   // worst
] as const;

export const CHART_RISK = {
  low: "hsl(158 35% 48%)",
  moderate: "hsl(38 75% 50%)",
  high: "hsl(0 65% 50%)",
} as const;

export const CHART_NEUTRALS = {
  grid: "hsl(33 18% 88%)",
  axis: "hsl(30 12% 76%)",
  tick: "hsl(24 8% 40%)",
  tooltipBg: "hsl(33 20% 96%)",
  tooltipBorder: "hsl(24 12% 84%)",
} as const;
