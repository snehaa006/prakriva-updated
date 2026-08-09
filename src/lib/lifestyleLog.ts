// Pure data model + math for the Lifestyle Tracker (sleep, activity,
// hydration, diet adherence). Kept free of Supabase/React so it is trivially
// testable — see src/lib/__tests__/lifestyleLog.test.ts.

export type SleepQuality = "deep" | "disturbed" | "insufficient";

/** One calendar day of self-logged lifestyle data. */
export interface LifestyleDayLog {
  /** Calendar date as "YYYY-MM-DD", in the patient's local time. */
  date: string;
  sleepHours: number | null;
  sleepQuality: SleepQuality | null;
  /** Minutes per exercise id (see src/lib/exerciseRecommendations.ts). */
  activityMinutes: Record<string, number>;
  waterGlasses: number;
  /** Glasses/day the patient is aiming for; kept per-day so raising the goal
   *  doesn't retroactively fail days that met the old one. */
  waterGoal: number;
}

export const DEFAULT_WATER_GOAL = 8;

export const emptyDayLog = (date: string): LifestyleDayLog => ({
  date,
  sleepHours: null,
  sleepQuality: null,
  activityMinutes: {},
  waterGlasses: 0,
  waterGoal: DEFAULT_WATER_GOAL,
});

/**
 * `isoDate` shifted by `delta` calendar days, as "YYYY-MM-DD".
 *
 * Deliberately works entirely in UTC-labelled arithmetic (`Date.UTC` /
 * `getUTC*`) so the date is treated as a plain calendar date with no
 * timezone attached — parsing `"${isoDate}T00:00:00"` instead would have JS
 * interpret it as local time, silently shifting the date by a day in any
 * timezone ahead of UTC (e.g. IST) once `toISOString()` converts it back.
 */
export const addDays = (isoDate: string, delta: number): string => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

/** Today's date as "YYYY-MM-DD" in local time. */
export const todayIso = (): string => {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
};

/** The `count` calendar dates ending at `today`, oldest first. */
export const lastNDates = (count: number, today: string = todayIso()): string[] =>
  Array.from({ length: count }, (_, i) => addDays(today, i - (count - 1)));

/** Total minutes of movement logged on a day, across every exercise. */
export const totalActivityMinutes = (log: LifestyleDayLog | undefined): number =>
  log ? Object.values(log.activityMinutes).reduce((sum, m) => sum + (m || 0), 0) : 0;

/** A day counts towards the activity streak once *any* movement is logged. */
export const isActiveDay = (log: LifestyleDayLog | undefined): boolean =>
  totalActivityMinutes(log) > 0;

/** Whether the day's water goal was reached. */
export const isHydrationGoalMet = (log: LifestyleDayLog | undefined): boolean =>
  !!log && log.waterGlasses >= (log.waterGoal || DEFAULT_WATER_GOAL);

/**
 * Consecutive achieved days ending today.
 *
 * If today has not been achieved yet it is skipped rather than treated as a
 * break — the day isn't over, so there is still time. Any *earlier* day that
 * wasn't achieved ends the streak.
 *
 * @param achievedDates the calendar dates that count (order irrelevant)
 */
export const currentStreak = (
  achievedDates: Iterable<string>,
  today: string = todayIso()
): number => {
  const achieved = new Set(achievedDates);

  let count = 0;
  // An unachieved today doesn't break the run, it just doesn't add to it.
  let cursor = achieved.has(today) ? today : addDays(today, -1);

  while (achieved.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }

  return count;
};

/** The longest run of calendar-consecutive achieved days. */
export const longestStreak = (achievedDates: Iterable<string>): number => {
  const sorted = [...new Set(achievedDates)].sort();

  let longest = 0;
  let run = 0;
  let previous: string | null = null;

  for (const date of sorted) {
    run = previous !== null && addDays(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  return longest;
};

/** Dates (oldest first) on which any activity was logged. */
export const activeDates = (logs: LifestyleDayLog[]): string[] =>
  logs.filter(isActiveDay).map((l) => l.date).sort();

/** Dates (oldest first) on which the hydration goal was met. */
export const hydratedDates = (logs: LifestyleDayLog[]): string[] =>
  logs.filter(isHydrationGoalMet).map((l) => l.date).sort();

/** Mean of the numeric values present, or `null` when there are none. */
const mean = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;

/** Weekly roll-up shown in the tracker's overview cards. */
export interface LifestyleAverages {
  /** Average of the days that actually recorded sleep, not of all 7. */
  avgSleepHours: number | null;
  avgActivityMinutes: number;
  avgWaterGlasses: number;
}

export const weeklyAverages = (
  logs: LifestyleDayLog[],
  today: string = todayIso()
): LifestyleAverages => {
  const window = new Set(lastNDates(7, today));
  const recent = logs.filter((l) => window.has(l.date));

  return {
    avgSleepHours: mean(
      recent
        .map((l) => l.sleepHours)
        .filter((h): h is number => typeof h === "number" && h > 0)
    ),
    // Activity and water average over the whole week: a day with no movement
    // is a real zero, not missing data.
    avgActivityMinutes: Math.round(
      recent.reduce((sum, l) => sum + totalActivityMinutes(l), 0) / 7
    ),
    avgWaterGlasses:
      Math.round((recent.reduce((sum, l) => sum + l.waterGlasses, 0) / 7) * 10) / 10,
  };
};
