// Menstrual cycle model and analysis for the PCOD/PCOS track.
//
// PCOS is diagnosed and managed largely off cycle behaviour, so this is the
// closest thing the PCOS track has to the maternal screening: it is what the
// diet plan, the exercise recommendations and the doctor's review all read.
// The patterns that matter clinically are not just "how long is her cycle" but
// the specific ways a PCOS cycle goes wrong:
//
//   - oligomenorrhoea — cycles stretching past 35 days
//   - amenorrhoea — a period missed for months at a time
//   - polymenorrhoea — two periods inside one calendar month
//   - menorrhagia — heavy or prolonged bleeding, which follows a long
//     anovulatory gap as the built-up endometrium finally sheds
//
// All four are counted here rather than collapsed into one "irregular" verdict,
// because they pull nutrition and exercise in different directions.
//
// Pure and dependency-free so it is trivially testable; see
// src/lib/__tests__/cycleTracking.test.ts. Dates are plain calendar dates
// ("YYYY-MM-DD") with no timezone attached, matching `src/lib/lifestyleLog.ts`.

import type { RiskLevel } from "@/types/diseaseDetection";
import { addDays, todayIso } from "@/lib/lifestyleLog";

export type FlowIntensity = "spotting" | "light" | "moderate" | "heavy";

export const FLOW_INTENSITIES: FlowIntensity[] = [
  "spotting",
  "light",
  "moderate",
  "heavy",
];

export const FLOW_LABELS: Record<FlowIntensity, string> = {
  spotting: "Spotting",
  light: "Light",
  moderate: "Moderate",
  heavy: "Heavy",
};

export type CycleSymptom =
  | "cramps"
  | "acne"
  | "mood-swings"
  | "bloating"
  | "headache"
  | "breast-tenderness"
  | "fatigue"
  | "back-pain"
  | "food-cravings"
  | "hair-fall";

export const CYCLE_SYMPTOMS: { value: CycleSymptom; label: string }[] = [
  { value: "cramps", label: "Cramps" },
  { value: "acne", label: "Acne flare" },
  { value: "mood-swings", label: "Mood swings" },
  { value: "bloating", label: "Bloating" },
  { value: "headache", label: "Headache" },
  { value: "breast-tenderness", label: "Breast tenderness" },
  { value: "fatigue", label: "Fatigue" },
  { value: "back-pain", label: "Back pain" },
  { value: "food-cravings", label: "Food cravings" },
  { value: "hair-fall", label: "Hair fall" },
];

/** One recorded period. */
export interface PeriodEntry {
  /** Client-generated id, so a cached entry and its server row are the same row. */
  id: string;
  /** First day of bleeding, "YYYY-MM-DD". */
  startDate: string;
  /** Last day of bleeding; null while the period is still ongoing. */
  endDate: string | null;
  flow: FlowIntensity | null;
  symptoms: CycleSymptom[];
  notes: string;
}

/**
 * A month the patient reports having had no period at all.
 *
 * Recorded explicitly rather than inferred purely from gaps: a patient who
 * joins mid-way has gaps in her history that are missing *data*, not missing
 * periods, and treating those as amenorrhoea would put a false clinical
 * finding in front of her doctor.
 */
export interface MissedMonth {
  /** Calendar month as "YYYY-MM". */
  month: string;
  notes: string;
}

// --- Thresholds -------------------------------------------------------------
// The numbers below are the conventional clinical cut-offs (FIGO / Rotterdam
// wording), kept named so the analysis reads as the rule it implements.

/** A cycle shorter than this is "frequent" (polymenorrhoea). */
export const SHORT_CYCLE_DAYS = 21;
/** A cycle longer than this is "infrequent" (oligomenorrhoea). */
export const LONG_CYCLE_DAYS = 35;
/** No bleeding for this long is amenorrhoea. */
export const MISSED_CYCLE_DAYS = 90;
/** Bleeding for longer than this is prolonged. */
export const PROLONGED_PERIOD_DAYS = 7;
/** Spread between shortest and longest cycle above which cycles are irregular. */
export const IRREGULAR_SPREAD_DAYS = 8;
/** Cycles needed before a regularity verdict means anything. */
export const MIN_CYCLES_FOR_VERDICT = 3;

export type CycleRegularity =
  | "insufficient-data"
  | "regular"
  | "irregular"
  | "highly-irregular";

export const REGULARITY_LABELS: Record<CycleRegularity, string> = {
  "insufficient-data": "Not enough cycles logged yet",
  regular: "Regular",
  irregular: "Irregular",
  "highly-irregular": "Highly irregular",
};

/** Whole days from `from` to `to`, treating both as plain calendar dates. */
export const daysBetween = (from: string, to: string): number => {
  const parse = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((parse(to) - parse(from)) / (24 * 60 * 60 * 1000));
};

/** The "YYYY-MM" a date falls in. */
export const monthOf = (isoDate: string): string => isoDate.slice(0, 7);

/** Entries oldest first, ignoring anything without a usable start date. */
export const sortEntries = (entries: PeriodEntry[]): PeriodEntry[] =>
  entries
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.startDate))
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

/** Gaps in days between consecutive period starts, oldest first. */
export const cycleLengths = (entries: PeriodEntry[]): number[] => {
  const sorted = sortEntries(entries);
  const lengths: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const length = daysBetween(sorted[i - 1].startDate, sorted[i].startDate);
    // A zero or negative gap means two entries for the same bleed; skip it
    // rather than let it drag the average down.
    if (length > 0) lengths.push(length);
  }
  return lengths;
};

/** Bleeding duration in days for each completed period, oldest first. */
export const periodDurations = (entries: PeriodEntry[]): number[] =>
  sortEntries(entries)
    .filter((e) => e.endDate)
    .map((e) => daysBetween(e.startDate, e.endDate as string) + 1)
    .filter((days) => days > 0);

const mean = (values: number[]): number | null =>
  values.length === 0
    ? null
    : Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;

/**
 * Calendar months holding two periods that arrived abnormally close together.
 *
 * Deliberately *not* "any month with two starts". On a textbook 28-day cycle
 * two periods land inside the same calendar month roughly every other month —
 * a period on the 1st and the 29th of January is one perfectly ordinary cycle,
 * not a finding. What a patient means by "I got it twice this month", and what
 * is worth showing a doctor, is the gap being short: two bleeds inside a
 * calendar month less than `SHORT_CYCLE_DAYS` apart.
 */
export const monthsWithTwoPeriods = (entries: PeriodEntry[]): string[] => {
  const sorted = sortEntries(entries);
  const months = new Set<string>();

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1].startDate;
    const current = sorted[i].startDate;
    const gap = daysBetween(previous, current);

    if (gap > 0 && gap < SHORT_CYCLE_DAYS && monthOf(previous) === monthOf(current)) {
      months.add(monthOf(current));
    }
  }

  return [...months].sort();
};

export interface CycleFlag {
  key: string;
  label: string;
  /** What was observed, in the patient's own terms. */
  detail: string;
  severity: RiskLevel;
}

export interface CycleAnalysis {
  /** Number of complete cycles (gaps between starts) available. */
  cycleCount: number;
  averageCycleLength: number | null;
  shortestCycle: number | null;
  longestCycle: number | null;
  /** Longest minus shortest — the spread the regularity verdict is based on. */
  cycleSpread: number | null;
  averagePeriodDuration: number | null;
  regularity: CycleRegularity;
  /** Cycles shorter than 21 days. */
  shortCycles: number;
  /** Cycles longer than 35 days. */
  longCycles: number;
  /** Gaps of 90+ days between periods. */
  missedCycles: number;
  /** Months the patient explicitly reported as having no period. */
  reportedMissedMonths: number;
  /** Calendar months containing two or more period starts. */
  twiceInAMonth: number;
  heavyPeriods: number;
  prolongedPeriods: number;
  lastPeriodStart: string | null;
  daysSinceLastPeriod: number | null;
  /** Predicted next start, from the average cycle length. Null without one. */
  predictedNextStart: string | null;
  /** True when the next period is more than a week past its prediction. */
  isOverdue: boolean;
  flags: CycleFlag[];
}

export interface CycleAnalysisOptions {
  /** Today, injectable so tests are not tied to the wall clock. */
  today?: string;
  /**
   * Whether the patient is currently pregnant.
   *
   * Everything this module measures from *recent* gaps becomes meaningless in
   * pregnancy: periods stop, so a pregnant patient's log shows a months-long
   * gap and an ever-growing "days since last period". Reported as-is that
   * reads as amenorrhoea and an overdue period, which would be a false
   * clinical finding generated by an entirely normal pregnancy — and shown to
   * exactly the patient least able to shrug it off. The gap-derived flags and
   * the next-period prediction are suppressed; the history itself (cycle
   * lengths, flow, symptoms) still stands, because her pre-pregnancy pattern
   * is what makes PCOS relevant to a pregnancy in the first place.
   */
  isPregnant?: boolean;
}

/**
 * Everything the rest of the app asks about a patient's cycle history.
 */
export const analyseCycles = (
  entries: PeriodEntry[],
  missedMonths: MissedMonth[] = [],
  optionsOrToday: string | CycleAnalysisOptions = {}
): CycleAnalysis => {
  const options: CycleAnalysisOptions =
    typeof optionsOrToday === "string" ? { today: optionsOrToday } : optionsOrToday;
  const today = options.today ?? todayIso();
  const isPregnant = options.isPregnant ?? false;
  const sorted = sortEntries(entries);
  const lengths = cycleLengths(sorted);
  const durations = periodDurations(sorted);

  const shortestCycle = lengths.length ? Math.min(...lengths) : null;
  const longestCycle = lengths.length ? Math.max(...lengths) : null;
  const cycleSpread =
    shortestCycle !== null && longestCycle !== null ? longestCycle - shortestCycle : null;

  const shortCycles = lengths.filter((l) => l < SHORT_CYCLE_DAYS).length;
  const longCycles = lengths.filter((l) => l > LONG_CYCLE_DAYS).length;
  const missedCycles = lengths.filter((l) => l >= MISSED_CYCLE_DAYS).length;

  const averageCycleLength = mean(lengths);
  const lastPeriodStart = sorted.length ? sorted[sorted.length - 1].startDate : null;
  const daysSinceLastPeriod = lastPeriodStart
    ? daysBetween(lastPeriodStart, today)
    : null;

  const predictedNextStart =
    !isPregnant && lastPeriodStart && averageCycleLength
      ? addDays(lastPeriodStart, Math.round(averageCycleLength))
      : null;

  const isOverdue =
    predictedNextStart !== null && daysBetween(predictedNextStart, today) > 7;

  let regularity: CycleRegularity = "insufficient-data";
  if (missedCycles > 0 && !isPregnant) {
    // A three-month gap needs no corroborating cycles to be a finding. Holding
    // this back as "not enough data" would be the one case where the honest
    // answer is obvious from a single observation.
    regularity = "highly-irregular";
  } else if (lengths.length >= MIN_CYCLES_FOR_VERDICT && cycleSpread !== null) {
    if (cycleSpread > IRREGULAR_SPREAD_DAYS * 2) regularity = "highly-irregular";
    else if (cycleSpread > IRREGULAR_SPREAD_DAYS || shortCycles > 0 || longCycles > 0)
      regularity = "irregular";
    else regularity = "regular";
  }

  const heavyPeriods = sorted.filter((e) => e.flow === "heavy").length;
  const prolongedPeriods = durations.filter((d) => d > PROLONGED_PERIOD_DAYS).length;
  const twiceInAMonth = monthsWithTwoPeriods(sorted).length;

  const flags: CycleFlag[] = [];

  if (isPregnant) {
    flags.push({
      key: "pregnant",
      label: "Cycles paused",
      detail:
        "Your periods stop while you're pregnant, so we're not reading anything into the gap since your last one. Your history before this is still what shapes your plan — PCOD/PCOS is worth your team knowing about during a pregnancy.",
      severity: "low",
    });
  }

  if (longCycles > 0 && !isPregnant) {
    flags.push({
      key: "long-cycles",
      label: "Infrequent cycles",
      detail: `${longCycles} cycle${longCycles === 1 ? "" : "s"} longer than ${LONG_CYCLE_DAYS} days. Long gaps usually mean ovulation isn't happening every month, which is the pattern PCOS is managed against.`,
      severity: longCycles >= 3 ? "high" : "moderate",
    });
  }

  if ((missedCycles > 0 || missedMonths.length > 0) && !isPregnant) {
    const total = Math.max(missedCycles, missedMonths.length);
    flags.push({
      key: "missed-cycles",
      label: "Missed periods",
      detail: `${total} stretch${total === 1 ? "" : "es"} with no period for months at a time. Worth raising with your doctor — the lining still needs to shed periodically.`,
      severity: "high",
    });
  }

  if ((shortCycles > 0 || twiceInAMonth > 0) && !isPregnant) {
    flags.push({
      key: "frequent-cycles",
      label: "Frequent periods",
      detail:
        twiceInAMonth > 0
          ? `${twiceInAMonth} month${twiceInAMonth === 1 ? "" : "s"} with two periods. Frequent bleeding is a common cause of iron loss, so iron-rich food matters more for you.`
          : `${shortCycles} cycle${shortCycles === 1 ? "" : "s"} shorter than ${SHORT_CYCLE_DAYS} days.`,
      severity: "moderate",
    });
  }

  if ((heavyPeriods >= 2 || prolongedPeriods > 0) && !isPregnant) {
    flags.push({
      key: "heavy-bleeding",
      label: "Heavy or prolonged bleeding",
      detail: `${heavyPeriods} heavy period${heavyPeriods === 1 ? "" : "s"}${
        prolongedPeriods > 0
          ? ` and ${prolongedPeriods} lasting over ${PROLONGED_PERIOD_DAYS} days`
          : ""
      }. This often follows a long gap, and it depletes iron — expect the diet plan to lean on iron and vitamin C.`,
      severity: prolongedPeriods > 0 ? "high" : "moderate",
    });
  }

  if (isOverdue && daysSinceLastPeriod !== null) {
    flags.push({
      key: "overdue",
      label: "Period is overdue",
      detail: `${daysSinceLastPeriod} days since your last period started, against an average cycle of ${averageCycleLength} days.`,
      severity: daysSinceLastPeriod >= MISSED_CYCLE_DAYS ? "high" : "moderate",
    });
  }

  if (flags.length === 0 && regularity === "regular" && !isPregnant) {
    flags.push({
      key: "regular",
      label: "Cycles look regular",
      detail:
        "Your logged cycles are consistent in length. Keep logging — regularity is the clearest sign that what you're doing is working.",
      severity: "low",
    });
  }

  return {
    cycleCount: lengths.length,
    averageCycleLength,
    shortestCycle,
    longestCycle,
    cycleSpread,
    averagePeriodDuration: mean(durations),
    regularity,
    shortCycles,
    longCycles,
    missedCycles,
    reportedMissedMonths: missedMonths.length,
    twiceInAMonth,
    heavyPeriods,
    prolongedPeriods,
    lastPeriodStart,
    daysSinceLastPeriod,
    predictedNextStart,
    isOverdue,
    flags,
  };
};

/** How often a symptom appears across the logged periods, most common first. */
export const symptomFrequency = (
  entries: PeriodEntry[]
): { symptom: CycleSymptom; count: number }[] => {
  const counts = new Map<CycleSymptom, number>();
  for (const entry of entries) {
    for (const symptom of entry.symptoms ?? []) {
      counts.set(symptom, (counts.get(symptom) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([symptom, count]) => ({ symptom, count }))
    .sort((a, b) => b.count - a.count || a.symptom.localeCompare(b.symptom));
};
