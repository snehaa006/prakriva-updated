import { describe, expect, it } from "vitest";
import {
  analyseWeights,
  bmiBand,
  computeBmi,
  needsWeightReduction,
  sortWeights,
  type WeightEntry,
} from "../weightLog";

const weigh = (date: string, weightKg: number): WeightEntry => ({
  date,
  weightKg,
  notes: "",
});

describe("computeBmi", () => {
  it("computes BMI from kilograms and centimetres", () => {
    expect(computeBmi(60, 165)).toBe(22);
    expect(computeBmi(85, 160)).toBe(33.2);
  });

  it("returns null rather than a nonsense number when either is missing", () => {
    expect(computeBmi(null, 165)).toBeNull();
    expect(computeBmi(60, null)).toBeNull();
    expect(computeBmi(0, 165)).toBeNull();
  });
});

describe("bmiBand", () => {
  it("uses the WHO cut-offs", () => {
    expect(bmiBand(17)).toBe("underweight");
    expect(bmiBand(22)).toBe("healthy");
    expect(bmiBand(27)).toBe("overweight");
    expect(bmiBand(31)).toBe("obese");
  });

  it("puts the boundaries in the upper band", () => {
    expect(bmiBand(18.5)).toBe("healthy");
    expect(bmiBand(25)).toBe("overweight");
    expect(bmiBand(30)).toBe("obese");
  });
});

describe("sortWeights", () => {
  it("orders oldest first and drops unusable rows", () => {
    const sorted = sortWeights([
      weigh("2026-03-01", 60),
      weigh("2026-01-01", 62),
      weigh("not-a-date", 61),
      weigh("2026-02-01", Number.NaN),
    ]);
    expect(sorted.map((w) => w.date)).toEqual(["2026-01-01", "2026-03-01"]);
  });
});

describe("analyseWeights", () => {
  it("reports no direction from a single reading", () => {
    const analysis = analyseWeights([weigh("2026-03-01", 70)], 160, {
      today: "2026-03-02",
    });
    expect(analysis.trend).toBe("unknown");
    expect(analysis.changeKg).toBeNull();
    expect(analysis.bmi).toBe(27.3);
    expect(analysis.band).toBe("overweight");
  });

  // Weight swings by a kilo on water alone, so two readings days apart are not
  // a trend no matter what they say.
  it("refuses a direction when the readings are less than a fortnight apart", () => {
    const analysis = analyseWeights(
      [weigh("2026-03-01", 70), weigh("2026-03-06", 73)],
      160,
      { today: "2026-03-06" }
    );
    expect(analysis.trend).toBe("unknown");
  });

  it("calls a small change over a real window stable", () => {
    const analysis = analyseWeights(
      [weigh("2026-01-01", 70), weigh("2026-03-01", 70.5)],
      160,
      { today: "2026-03-01" }
    );
    expect(analysis.trend).toBe("stable");
    expect(analysis.changeKg).toBe(0.5);
  });

  it("normalises the change to a month so windows are comparable", () => {
    const analysis = analyseWeights(
      [weigh("2026-01-01", 70), weigh("2026-03-02", 74)],
      160,
      { today: "2026-03-02" }
    );
    expect(analysis.trend).toBe("gaining");
    expect(analysis.changeKg).toBe(4);
    expect(analysis.changeKgPerMonth).toBe(2);
    expect(analysis.isRapidGain).toBe(true);
  });

  it("detects a downward trend", () => {
    const analysis = analyseWeights(
      [weigh("2026-01-01", 80), weigh("2026-03-01", 76)],
      160,
      { today: "2026-03-01" }
    );
    expect(analysis.trend).toBe("losing");
    expect(analysis.isRapidGain).toBe(false);
  });

  // A year-old reading says nothing about what her plan should do this month.
  it("ignores readings outside the window", () => {
    const analysis = analyseWeights(
      [weigh("2025-01-01", 55), weigh("2026-01-01", 70), weigh("2026-03-01", 70.5)],
      160,
      { today: "2026-03-01", windowDays: 90 }
    );
    // Against the year-old reading this would read as +15.5 kg and "gaining".
    expect(analysis.earliest?.date).toBe("2026-01-01");
    expect(analysis.changeKg).toBe(0.5);
    expect(analysis.trend).toBe("stable");
  });

  it("computes the 5% loss target off the latest reading", () => {
    const analysis = analyseWeights([weigh("2026-03-01", 80)], 160, {
      today: "2026-03-01",
    });
    expect(analysis.fivePercentTargetKg).toBe(76);
  });

  it("copes with no readings at all", () => {
    const analysis = analyseWeights([], 160, { today: "2026-03-01" });
    expect(analysis.latest).toBeNull();
    expect(analysis.bmi).toBeNull();
    expect(analysis.trend).toBe("unknown");
    expect(analysis.daysSinceLastEntry).toBeNull();
  });
});

describe("needsWeightReduction", () => {
  const at = (weightKg: number, heightCm: number) =>
    analyseWeights([weigh("2026-03-01", weightKg)], heightCm, { today: "2026-03-01" });

  it("is true above the healthy band", () => {
    expect(needsWeightReduction(at(75, 160))).toBe(true);
    expect(needsWeightReduction(at(85, 160))).toBe(true);
  });

  it("is false inside it", () => {
    expect(needsWeightReduction(at(55, 160))).toBe(false);
  });

  // Direction matters even when the number does not yet.
  it("is true for rapid gain inside the healthy band", () => {
    const gaining = analyseWeights(
      [weigh("2026-01-01", 52), weigh("2026-03-02", 56)],
      160,
      { today: "2026-03-02" }
    );
    expect(gaining.band).toBe("healthy");
    expect(needsWeightReduction(gaining)).toBe(true);
  });
});
