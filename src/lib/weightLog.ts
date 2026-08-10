// Weight history and what it means for a diet plan.
//
// Weight is the one PCOS measure that moves on a useful timescale: a 5–10%
// reduction is the intervention with the strongest evidence behind it for
// restoring ovulation, and rapid gain is usually the first thing a patient
// notices. The tracker asks for it weekly (or whenever she likes) and this
// module turns those points into the two things the rest of the app needs —
// where she is now (BMI band) and which way she is going (trend).
//
// Deliberately conservative about drawing conclusions: a single reading is a
// number, not a trend, and day-to-day weight swings by a kilo on water alone.
// Nothing here reports a direction until there are at least two readings a
// fortnight apart.
//
// Pure and dependency-free; see src/lib/__tests__/weightLog.test.ts.

import { daysBetween } from "@/lib/cycleTracking";
import { todayIso } from "@/lib/lifestyleLog";

export interface WeightEntry {
  /** Calendar date the weight was taken, "YYYY-MM-DD". */
  date: string;
  weightKg: number;
  notes: string;
}

export type BmiBand = "underweight" | "healthy" | "overweight" | "obese";

export const BMI_BAND_LABELS: Record<BmiBand, string> = {
  underweight: "Underweight",
  healthy: "Healthy weight",
  overweight: "Overweight",
  obese: "Obese",
};

/**
 * BMI band from a BMI value, using the WHO cut-offs.
 *
 * Note these are the international cut-offs, not the lower Asian-Indian ones
 * (23 / 25) some Indian guidelines use. Kept international because the rest of
 * the app's targets (ACOG, WHO postpartum) are, and mixing standards inside one
 * plan would be worse than picking either.
 */
export const bmiBand = (bmi: number): BmiBand => {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "healthy";
  if (bmi < 30) return "overweight";
  return "obese";
};

/** BMI from weight and height, rounded to one decimal. Null if either is unusable. */
export const computeBmi = (
  weightKg: number | null | undefined,
  heightCm: number | null | undefined
): number | null => {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const metres = heightCm / 100;
  return Math.round((weightKg / (metres * metres)) * 10) / 10;
};

/** Entries oldest first, with unusable rows dropped. */
export const sortWeights = (entries: WeightEntry[]): WeightEntry[] =>
  entries
    .filter(
      (e) =>
        /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
        Number.isFinite(e.weightKg) &&
        e.weightKg > 0
    )
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

export type WeightTrend = "gaining" | "losing" | "stable" | "unknown";

export const TREND_LABELS: Record<WeightTrend, string> = {
  gaining: "Trending up",
  losing: "Trending down",
  stable: "Holding steady",
  unknown: "Not enough readings yet",
};

/** Minimum days between two readings before a direction is claimed. */
export const MIN_TREND_SPAN_DAYS = 14;
/** Change below this over the window is noise, not a trend. */
export const TREND_NOISE_KG = 1;
/** Gain at or above this per month is fast enough to act on. */
export const RAPID_GAIN_KG_PER_MONTH = 1.5;

export interface WeightAnalysis {
  latest: WeightEntry | null;
  /** Weight at the start of the analysed window. */
  earliest: WeightEntry | null;
  entryCount: number;
  /** Kilograms changed across the window (positive = gained). */
  changeKg: number | null;
  /** Change normalised to a 30-day month, so windows are comparable. */
  changeKgPerMonth: number | null;
  trend: WeightTrend;
  /** True when gaining faster than `RAPID_GAIN_KG_PER_MONTH`. */
  isRapidGain: boolean;
  bmi: number | null;
  band: BmiBand | null;
  /** Days since the last reading, so the UI can nudge for a fresh one. */
  daysSinceLastEntry: number | null;
  /** 5% of current weight — the loss target with the best PCOS evidence. */
  fivePercentTargetKg: number | null;
}

/**
 * Summarise a weight history.
 *
 * `windowDays` bounds how far back the trend looks: a year-old reading says
 * nothing about what her diet plan should do this month.
 */
export const analyseWeights = (
  entries: WeightEntry[],
  heightCm: number | null,
  { windowDays = 90, today = todayIso() }: { windowDays?: number; today?: string } = {}
): WeightAnalysis => {
  const sorted = sortWeights(entries);
  const latest = sorted.length ? sorted[sorted.length - 1] : null;

  const bmi = computeBmi(latest?.weightKg, heightCm);

  const empty: WeightAnalysis = {
    latest,
    earliest: null,
    entryCount: sorted.length,
    changeKg: null,
    changeKgPerMonth: null,
    trend: "unknown",
    isRapidGain: false,
    bmi,
    band: bmi === null ? null : bmiBand(bmi),
    daysSinceLastEntry: latest ? daysBetween(latest.date, today) : null,
    fivePercentTargetKg: latest
      ? Math.round(latest.weightKg * 0.95 * 10) / 10
      : null,
  };

  if (!latest || sorted.length < 2) return empty;

  const inWindow = sorted.filter(
    (e) => daysBetween(e.date, latest.date) <= windowDays
  );
  const earliest = inWindow[0];
  const spanDays = daysBetween(earliest.date, latest.date);

  if (spanDays < MIN_TREND_SPAN_DAYS) return { ...empty, earliest };

  const changeKg = Math.round((latest.weightKg - earliest.weightKg) * 10) / 10;
  const changeKgPerMonth = Math.round((changeKg / spanDays) * 30 * 10) / 10;

  const trend: WeightTrend =
    Math.abs(changeKg) < TREND_NOISE_KG ? "stable" : changeKg > 0 ? "gaining" : "losing";

  return {
    ...empty,
    earliest,
    changeKg,
    changeKgPerMonth,
    trend,
    isRapidGain: changeKgPerMonth >= RAPID_GAIN_KG_PER_MONTH,
  };
};

/**
 * Whether the diet plan should aim at weight reduction.
 *
 * Two independent triggers, either of which is enough: she is carrying enough
 * weight that losing some would help her cycles, or she is gaining fast enough
 * that the direction matters even if the number does not yet.
 */
export const needsWeightReduction = (analysis: WeightAnalysis): boolean =>
  analysis.band === "overweight" || analysis.band === "obese" || analysis.isRapidGain;
