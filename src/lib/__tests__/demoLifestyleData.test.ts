import { describe, expect, it } from "vitest";
import {
  buildDemoLogs,
  buildDemoMealTracking,
  DEMO_DAYS,
  DEMO_EXPECTED_ACTIVITY_STREAK,
  DEMO_EXPECTED_LONGEST_ACTIVITY_STREAK,
} from "../demoLifestyleData";
import {
  activeDates,
  currentStreak,
  hydratedDates,
  isHydrationGoalMet,
  longestStreak,
  totalActivityMinutes,
  weeklyAverages,
} from "../lifestyleLog";
import { evaluateDay, summarise } from "../dietAdherence";

const TODAY = "2026-08-08";
const EXERCISES = ["gentle-walk", "pranayama", "restorative-yoga"];

const logs = () => buildDemoLogs(EXERCISES, TODAY);

describe("buildDemoLogs", () => {
  it("produces a full month ending today, oldest first", () => {
    const result = logs();
    expect(result).toHaveLength(DEMO_DAYS);
    expect(result[result.length - 1].date).toBe(TODAY);
    expect(result[0].date).toBe("2026-07-10");
    expect([...result].sort((a, b) => a.date.localeCompare(b.date))).toEqual(result);
  });

  it("is deterministic — the same day always yields the same month", () => {
    expect(logs()).toEqual(logs());
  });

  it("only logs minutes against the exercises the patient was recommended", () => {
    for (const log of logs()) {
      for (const id of Object.keys(log.activityMinutes)) {
        expect(EXERCISES).toContain(id);
      }
    }
  });

  it("follows a different plan when a different one is recommended", () => {
    const swimmer = buildDemoLogs(["swimming"], TODAY);
    const active = swimmer.filter((l) => totalActivityMinutes(l) > 0);
    expect(active.length).toBeGreaterThan(0);
    for (const log of active) {
      expect(Object.keys(log.activityMinutes)).toEqual(["swimming"]);
    }
  });
});

// The point of the demo month is to prove the real streak/aggregate logic
// behaves on a month of mixed data — so these assertions run the production
// functions over it rather than re-checking the generator's own arithmetic.
describe("the streaks the demo month is built to produce", () => {
  it("yields a current activity streak that is neither zero nor the whole month", () => {
    const streak = currentStreak(activeDates(logs()), TODAY);
    expect(streak).toBe(DEMO_EXPECTED_ACTIVITY_STREAK);
    expect(streak).toBeGreaterThan(0);
    expect(streak).toBeLessThan(DEMO_DAYS);
  });

  it("has an earlier run longer than the current one, so 'best' differs", () => {
    const best = longestStreak(activeDates(logs()));
    expect(best).toBe(DEMO_EXPECTED_LONGEST_ACTIVITY_STREAK);
    expect(best).toBeGreaterThan(DEMO_EXPECTED_ACTIVITY_STREAK);
  });

  it("includes rest days, so the streak logic is actually exercised", () => {
    const restDays = logs().filter((l) => totalActivityMinutes(l) === 0);
    expect(restDays.length).toBeGreaterThan(0);
  });

  it("includes both met and missed hydration targets", () => {
    const result = logs();
    const met = result.filter(isHydrationGoalMet);
    expect(met.length).toBeGreaterThan(0);
    expect(met.length).toBeLessThan(result.length);
    expect(currentStreak(hydratedDates(result), TODAY)).toBeGreaterThan(0);
  });

  it("leaves a couple of nights unlogged without breaking the sleep average", () => {
    const result = logs();
    expect(result.some((l) => l.sleepHours === null)).toBe(true);

    const average = weeklyAverages(result, TODAY).avgSleepHours;
    expect(average).not.toBeNull();
    expect(average as number).toBeGreaterThan(4);
    expect(average as number).toBeLessThan(12);
  });

  it("keeps every generated value inside a believable range", () => {
    for (const log of logs()) {
      expect(log.waterGlasses).toBeGreaterThanOrEqual(0);
      expect(log.waterGlasses).toBeLessThanOrEqual(20);
      if (log.sleepHours !== null) {
        expect(log.sleepHours).toBeGreaterThanOrEqual(5);
        expect(log.sleepHours).toBeLessThanOrEqual(9);
        expect(log.sleepQuality).not.toBeNull();
      }
      expect(totalActivityMinutes(log)).toBeLessThanOrEqual(200);
    }
  });
});

describe("buildDemoMealTracking", () => {
  it("is deterministic and covers the month apart from a few planless days", () => {
    const rows = buildDemoMealTracking(TODAY);
    expect(rows).toEqual(buildDemoMealTracking(TODAY));
    expect(rows.length).toBeLessThan(DEMO_DAYS);
    expect(rows.length).toBeGreaterThan(DEMO_DAYS - 6);
  });

  it("keeps eaten + skipped equal to the meals planned", () => {
    for (const row of buildDemoMealTracking(TODAY)) {
      expect(row.eatenCount + row.skippedCount).toBe(row.totalMeals);
      expect(row.eatenCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("gives the adherence roll-up a mix of good and bad days", () => {
    const rows = buildDemoMealTracking(TODAY);
    const byDate = new Map(rows.map((r) => [r.date, r]));
    const target = { min: 1800, max: 2200, label: "General Adult" };

    const days = rows.map((r) => evaluateDay(r.date, byDate.get(r.date), target));
    const summary = summarise(days);

    // Both branches present: some days followed, some not — otherwise the
    // week strip would be all one colour and prove nothing.
    expect(summary.daysPlanFollowed).toBeGreaterThan(0);
    expect(summary.daysPlanFollowed).toBeLessThan(days.length);
    expect(summary.daysNutritionComplete).toBeGreaterThan(0);
    expect(summary.daysNutritionComplete).toBeLessThan(days.length);
    expect(summary.averageCompletionPct).toBeGreaterThan(0);
    expect(summary.averageCompletionPct).toBeLessThanOrEqual(100);
  });
});
