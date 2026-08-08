import { describe, expect, it } from "vitest";
import { evaluateDay, summarise, type CalorieTarget } from "../dietAdherence";

const target: CalorieTarget = { min: 1800, max: 2200, label: "General Adult" };

describe("evaluateDay", () => {
  it("reads an unlogged day as no plan rather than a failure", () => {
    const day = evaluateDay("2026-08-08", undefined, target);
    expect(day.hasPlan).toBe(false);
    expect(day.planFollowed).toBe(false);
    expect(day.nutritionComplete).toBe(false);
    expect(day.planCompletionPct).toBe(0);
  });

  it("marks nutrition complete once the daily minimum is reached", () => {
    const day = evaluateDay(
      "2026-08-08",
      { date: "2026-08-08", totalMeals: 4, eatenCount: 4, skippedCount: 0, caloriesConsumed: 1850 },
      target
    );
    expect(day.nutritionComplete).toBe(true);
    expect(day.overTarget).toBe(false);
    expect(day.planFollowed).toBe(true);
    expect(day.planCompletionPct).toBe(100);
  });

  it("flags going past the top of the range without calling it a failure", () => {
    const day = evaluateDay(
      "2026-08-08",
      { date: "2026-08-08", totalMeals: 4, eatenCount: 4, skippedCount: 0, caloriesConsumed: 2600 },
      target
    );
    expect(day.overTarget).toBe(true);
    expect(day.nutritionComplete).toBe(true);
  });

  it("tolerates one missed meal out of five but not two", () => {
    const base = { date: "2026-08-08", skippedCount: 0, caloriesConsumed: 1900 };
    expect(
      evaluateDay("2026-08-08", { ...base, totalMeals: 5, eatenCount: 4 }, target).planFollowed
    ).toBe(true);
    expect(
      evaluateDay("2026-08-08", { ...base, totalMeals: 5, eatenCount: 3 }, target).planFollowed
    ).toBe(false);
  });

  it("keeps the two judgements independent", () => {
    // Every meal eaten, but a light plan that still undershoots her minimum.
    const day = evaluateDay(
      "2026-08-08",
      { date: "2026-08-08", totalMeals: 3, eatenCount: 3, skippedCount: 0, caloriesConsumed: 1200 },
      target
    );
    expect(day.planFollowed).toBe(true);
    expect(day.nutritionComplete).toBe(false);
  });
});

describe("summarise", () => {
  it("counts days and averages completion over days that had a plan", () => {
    const days = [
      evaluateDay(
        "2026-08-06",
        { date: "2026-08-06", totalMeals: 4, eatenCount: 4, skippedCount: 0, caloriesConsumed: 1900 },
        target
      ),
      evaluateDay(
        "2026-08-07",
        { date: "2026-08-07", totalMeals: 4, eatenCount: 2, skippedCount: 2, caloriesConsumed: 900 },
        target
      ),
      evaluateDay("2026-08-08", undefined, target),
    ];

    const summary = summarise(days);
    expect(summary.daysWithPlan).toBe(2);
    expect(summary.daysNutritionComplete).toBe(1);
    expect(summary.daysPlanFollowed).toBe(1);
    // (100 + 50) / 2 — the planless day is excluded rather than counted as 0.
    expect(summary.averageCompletionPct).toBe(75);
  });

  it("is all zeroes with nothing logged", () => {
    expect(summarise([])).toEqual({
      daysWithPlan: 0,
      daysNutritionComplete: 0,
      daysPlanFollowed: 0,
      averageCompletionPct: 0,
    });
  });
});
