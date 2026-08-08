import { describe, expect, it } from "vitest";
import {
  activeDates,
  addDays,
  currentStreak,
  emptyDayLog,
  hydratedDates,
  isActiveDay,
  isHydrationGoalMet,
  lastNDates,
  longestStreak,
  totalActivityMinutes,
  weeklyAverages,
  type LifestyleDayLog,
} from "../lifestyleLog";

/** A day log with only the fields a test cares about spelled out. */
const day = (date: string, overrides: Partial<LifestyleDayLog> = {}): LifestyleDayLog => ({
  ...emptyDayLog(date),
  ...overrides,
});

describe("addDays", () => {
  it("moves across a month boundary", () => {
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("moves across a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("lastNDates", () => {
  it("returns the window oldest first, ending today", () => {
    expect(lastNDates(3, "2026-08-08")).toEqual(["2026-08-06", "2026-08-07", "2026-08-08"]);
  });
});

describe("totalActivityMinutes", () => {
  it("sums every exercise logged that day", () => {
    expect(
      totalActivityMinutes(
        day("2026-08-08", { activityMinutes: { "brisk-walk": 30, pranayama: 10 } })
      )
    ).toBe(40);
  });

  it("is 0 for a missing day", () => {
    expect(totalActivityMinutes(undefined)).toBe(0);
    expect(isActiveDay(undefined)).toBe(false);
  });
});

describe("isHydrationGoalMet", () => {
  it("compares against the goal stored on that day, not today's goal", () => {
    expect(isHydrationGoalMet(day("2026-08-08", { waterGlasses: 6, waterGoal: 6 }))).toBe(true);
    expect(isHydrationGoalMet(day("2026-08-08", { waterGlasses: 6, waterGoal: 8 }))).toBe(false);
  });
});

describe("currentStreak", () => {
  it("is 0 with nothing logged", () => {
    expect(currentStreak([], "2026-08-08")).toBe(0);
  });

  it("counts back from today through consecutive achieved days", () => {
    expect(
      currentStreak(["2026-08-06", "2026-08-07", "2026-08-08"], "2026-08-08")
    ).toBe(3);
  });

  it("does not break the streak just because today isn't done yet", () => {
    // The day isn't over — yesterday's run still stands.
    expect(currentStreak(["2026-08-06", "2026-08-07"], "2026-08-08")).toBe(2);
  });

  it("breaks on a missed day that is not today", () => {
    expect(
      currentStreak(["2026-08-04", "2026-08-05", "2026-08-08"], "2026-08-08")
    ).toBe(1);
  });

  it("ignores duplicate dates", () => {
    expect(currentStreak(["2026-08-08", "2026-08-08"], "2026-08-08")).toBe(1);
  });
});

describe("longestStreak", () => {
  it("finds the longest consecutive run anywhere in the history", () => {
    expect(
      longestStreak([
        "2026-08-01",
        "2026-08-02",
        "2026-08-03",
        // gap
        "2026-08-06",
        "2026-08-07",
      ])
    ).toBe(3);
  });

  it("is 0 with no achieved days", () => {
    expect(longestStreak([])).toBe(0);
  });
});

describe("activeDates / hydratedDates", () => {
  const logs = [
    day("2026-08-06", { activityMinutes: { "gentle-walk": 20 }, waterGlasses: 8 }),
    day("2026-08-07", { waterGlasses: 3 }),
    day("2026-08-08", { activityMinutes: { pranayama: 10 } }),
  ];

  it("keeps only the days that qualify", () => {
    expect(activeDates(logs)).toEqual(["2026-08-06", "2026-08-08"]);
    expect(hydratedDates(logs)).toEqual(["2026-08-06"]);
  });

  it("streaks derived from them agree", () => {
    // 08-07 had no movement, so today's activity is a fresh 1-day streak.
    expect(currentStreak(activeDates(logs), "2026-08-08")).toBe(1);
  });
});

describe("weeklyAverages", () => {
  it("averages sleep only over nights that were logged", () => {
    const logs = [
      day("2026-08-07", { sleepHours: 8 }),
      day("2026-08-08", { sleepHours: 6 }),
    ];
    expect(weeklyAverages(logs, "2026-08-08").avgSleepHours).toBe(7);
  });

  it("averages activity and water over all seven days", () => {
    const logs = [day("2026-08-08", { activityMinutes: { "brisk-walk": 70 }, waterGlasses: 7 })];
    const averages = weeklyAverages(logs, "2026-08-08");
    expect(averages.avgActivityMinutes).toBe(10);
    expect(averages.avgWaterGlasses).toBe(1);
  });

  it("reports null sleep when nothing was logged", () => {
    expect(weeklyAverages([], "2026-08-08").avgSleepHours).toBeNull();
  });

  it("ignores days outside the seven-day window", () => {
    const logs = [day("2026-07-01", { sleepHours: 4, waterGlasses: 20 })];
    const averages = weeklyAverages(logs, "2026-08-08");
    expect(averages.avgSleepHours).toBeNull();
    expect(averages.avgWaterGlasses).toBe(0);
  });
});
