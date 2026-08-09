// A month of believable-but-fake tracker data, for exercising the Lifestyle
// Tracker end to end — streaks, averages, the calendars, the charts and the
// diet-adherence roll-up — without waiting 30 days to accumulate real logs.
//
// Deterministic on purpose (seeded PRNG, dates derived from "today"): the same
// day always produces the same month, so a screenshot or a failing test can be
// reproduced. The shape is also deliberately *not* uniform — there are rest
// days, missed water targets and skipped meals, because data where everything
// succeeds proves nothing about the streak logic.
//
// See src/lib/__tests__/demoLifestyleData.test.ts, which asserts the streaks
// this data is built to produce.

import { addDays, DEFAULT_WATER_GOAL, todayIso, type LifestyleDayLog } from "./lifestyleLog";
import type { MealTrackingDay } from "./dietAdherence";

export const DEMO_DAYS = 30;

/**
 * Days-ago offsets with no exercise logged.
 *
 * Chosen so the streaks are interesting rather than trivially "everything":
 * with rest days at 4, 11 and 12 the current streak runs 0–3 (4 days) and the
 * longest earlier run is 5–10 (6 days). A generator with no gaps would make a
 * broken streak calculation look correct.
 */
const REST_DAY_OFFSETS = new Set([4, 11, 12, 19, 23, 24, 28]);

/** Expected current activity streak for the generated month (offsets 0–3). */
export const DEMO_EXPECTED_ACTIVITY_STREAK = 4;
/** Expected longest activity streak for the generated month (offsets 5–10). */
export const DEMO_EXPECTED_LONGEST_ACTIVITY_STREAK = 6;

/** Days-ago offsets where the water target is missed. */
const DRY_DAY_OFFSETS = new Set([1, 6, 7, 13, 18, 22, 27]);

/** Small deterministic PRNG (mulberry32) so the month never shifts under us. */
const seededRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** An integer in [min, max], drawn deterministically from `seed`. */
const pick = (seed: number, min: number, max: number): number =>
  min + Math.floor(seededRandom(seed)() * (max - min + 1));

/**
 * A month of lifestyle logs ending today, oldest first.
 *
 * @param exerciseIds the patient's recommended exercises — demo minutes are
 *   logged against these so the data matches whatever plan she is actually
 *   shown, rather than referencing exercises that aren't on her page.
 */
export const buildDemoLogs = (
  exerciseIds: string[],
  today: string = todayIso()
): LifestyleDayLog[] => {
  const logs: LifestyleDayLog[] = [];
  // Fall back to a plausible id so demo mode still shows something if it is
  // somehow invoked before recommendations have resolved.
  const ids = exerciseIds.length > 0 ? exerciseIds : ["gentle-walk"];

  for (let offset = DEMO_DAYS - 1; offset >= 0; offset--) {
    const date = addDays(today, -offset);
    const isRestDay = REST_DAY_OFFSETS.has(offset);
    const activityMinutes: Record<string, number> = {};

    if (!isRestDay) {
      // One or two exercises a day, rotating through her plan.
      const primary = ids[offset % ids.length];
      activityMinutes[primary] = pick(offset * 7 + 1, 3, 9) * 5;

      if (ids.length > 1 && pick(offset * 13 + 2, 0, 2) > 0) {
        const secondary = ids[(offset + 1) % ids.length];
        if (secondary !== primary) {
          activityMinutes[secondary] = pick(offset * 17 + 3, 2, 4) * 5;
        }
      }
    }

    const goal = DEFAULT_WATER_GOAL;
    const waterGlasses = DRY_DAY_OFFSETS.has(offset)
      ? pick(offset * 11 + 4, 3, goal - 1)
      : pick(offset * 11 + 4, goal, goal + 3);

    // A couple of unlogged nights, so "not logged" rendering gets exercised too.
    const sleepLogged = offset !== 8 && offset !== 21;
    const sleepHours = sleepLogged ? pick(offset * 19 + 5, 50, 90) / 10 : null;

    logs.push({
      date,
      sleepHours,
      sleepQuality:
        sleepHours === null
          ? null
          : sleepHours >= 7.5
            ? "deep"
            : sleepHours >= 6
              ? "disturbed"
              : "insufficient",
      activityMinutes,
      waterGlasses,
      waterGoal: goal,
    });
  }

  return logs;
};

/** Days-ago offsets with no diet plan loaded at all. */
const NO_PLAN_OFFSETS = new Set([9, 16, 25]);

/**
 * A month of meal-tracking rows ending today, oldest first.
 *
 * Mirrors what Meal Logging would have written, so the tracker's nutrition and
 * plan-adherence sections have something to read in demo mode.
 */
export const buildDemoMealTracking = (
  today: string = todayIso(),
  calorieMinimum = 1800
): MealTrackingDay[] => {
  const rows: MealTrackingDay[] = [];

  for (let offset = DEMO_DAYS - 1; offset >= 0; offset--) {
    if (NO_PLAN_OFFSETS.has(offset)) continue;

    const date = addDays(today, -offset);
    const totalMeals = 5;
    // Mostly good adherence with regular slips, so both the "followed" and
    // "not followed" branches show up across the week strip.
    const eatenCount = pick(offset * 23 + 6, 0, 9) < 7 ? totalMeals - pick(offset * 29 + 7, 0, 1) : 3;
    const skippedCount = totalMeals - eatenCount;
    // Calories track meals eaten, landing above or below the minimum with it.
    const caloriesConsumed = Math.round(
      (eatenCount / totalMeals) * (calorieMinimum + pick(offset * 31 + 8, 0, 400))
    );

    rows.push({ date, totalMeals, eatenCount, skippedCount, caloriesConsumed });
  }

  return rows;
};
