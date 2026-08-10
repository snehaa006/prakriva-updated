import { describe, expect, it } from "vitest";
import {
  analyseCycles,
  cycleLengths,
  daysBetween,
  monthsWithTwoPeriods,
  periodDurations,
  symptomFrequency,
  type PeriodEntry,
} from "../cycleTracking";

/** A period entry with only the fields a test cares about spelled out. */
const period = (
  startDate: string,
  overrides: Partial<PeriodEntry> = {}
): PeriodEntry => ({
  id: `p-${startDate}`,
  startDate,
  endDate: null,
  flow: null,
  symptoms: [],
  notes: "",
  ...overrides,
});

describe("daysBetween", () => {
  it("counts plain calendar days across month and leap boundaries", () => {
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
    expect(daysBetween("2026-01-31", "2026-02-01")).toBe(1);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });

  it("is negative when the dates are the other way round", () => {
    expect(daysBetween("2026-02-01", "2026-01-31")).toBe(-1);
  });
});

describe("cycleLengths", () => {
  it("measures the gaps between consecutive starts", () => {
    expect(
      cycleLengths([period("2026-01-01"), period("2026-01-29"), period("2026-03-01")])
    ).toEqual([28, 31]);
  });

  it("sorts before measuring, so entry order does not matter", () => {
    expect(cycleLengths([period("2026-01-29"), period("2026-01-01")])).toEqual([28]);
  });

  it("ignores a duplicate entry for the same bleed", () => {
    expect(cycleLengths([period("2026-01-01"), period("2026-01-01")])).toEqual([]);
  });
});

describe("periodDurations", () => {
  it("counts both end days as bleeding days", () => {
    expect(periodDurations([period("2026-01-01", { endDate: "2026-01-05" })])).toEqual([5]);
  });

  it("skips a period that is still ongoing", () => {
    expect(periodDurations([period("2026-01-01")])).toEqual([]);
  });
});

describe("monthsWithTwoPeriods", () => {
  it("finds months where two bleeds arrived abnormally close together", () => {
    expect(
      monthsWithTwoPeriods([
        period("2026-03-02"),
        period("2026-03-18"),
        period("2026-04-15"),
      ])
    ).toEqual(["2026-03"]);
  });

  // Two periods inside one calendar month is what a normal 28-day cycle does
  // roughly every other month; only the short gap makes it a finding.
  it("ignores two starts in a month that are a normal cycle apart", () => {
    expect(monthsWithTwoPeriods([period("2026-01-01"), period("2026-01-29")])).toEqual(
      []
    );
  });
});

describe("analyseCycles", () => {
  const regular = [
    period("2026-01-01"),
    period("2026-01-29"),
    period("2026-02-26"),
    period("2026-03-26"),
  ];

  it("calls consistent cycles regular", () => {
    const analysis = analyseCycles(regular, [], "2026-04-01");
    expect(analysis.regularity).toBe("regular");
    expect(analysis.averageCycleLength).toBe(28);
    expect(analysis.cycleCount).toBe(3);
    expect(analysis.longCycles).toBe(0);
  });

  it("withholds a verdict until three cycles are logged", () => {
    const analysis = analyseCycles(regular.slice(0, 2), [], "2026-02-01");
    expect(analysis.regularity).toBe("insufficient-data");
  });

  it("flags cycles that stretch past 35 days", () => {
    const analysis = analyseCycles(
      [period("2026-01-01"), period("2026-02-15"), period("2026-04-05"), period("2026-05-20")],
      [],
      "2026-05-25"
    );
    expect(analysis.longCycles).toBe(3);
    expect(analysis.flags.map((f) => f.key)).toContain("long-cycles");
  });

  // A 90+ day gap is amenorrhoea, and must not read as merely "irregular".
  it("treats a months-long gap as highly irregular", () => {
    const analysis = analyseCycles(
      [period("2026-01-01"), period("2026-01-29"), period("2026-06-01")],
      [],
      "2026-06-05"
    );
    expect(analysis.missedCycles).toBe(1);
    expect(analysis.regularity).toBe("highly-irregular");
    expect(analysis.flags.map((f) => f.key)).toContain("missed-cycles");
  });

  it("counts two periods in one month separately from short cycles", () => {
    const analysis = analyseCycles(
      [period("2026-03-02"), period("2026-03-20"), period("2026-04-15")],
      [],
      "2026-04-20"
    );
    expect(analysis.twiceInAMonth).toBe(1);
    expect(analysis.shortCycles).toBe(1);
    const frequent = analysis.flags.find((f) => f.key === "frequent-cycles");
    expect(frequent?.detail).toContain("two periods");
  });

  it("flags heavy and prolonged bleeding", () => {
    const analysis = analyseCycles(
      [
        period("2026-01-01", { flow: "heavy", endDate: "2026-01-10" }),
        period("2026-01-29", { flow: "heavy", endDate: "2026-02-03" }),
      ],
      [],
      "2026-02-10"
    );
    expect(analysis.heavyPeriods).toBe(2);
    expect(analysis.prolongedPeriods).toBe(1);
    expect(analysis.flags.map((f) => f.key)).toContain("heavy-bleeding");
  });

  it("predicts the next period and knows when it is overdue", () => {
    const analysis = analyseCycles(regular, [], "2026-05-01");
    expect(analysis.predictedNextStart).toBe("2026-04-23");
    expect(analysis.isOverdue).toBe(true);
    expect(analysis.daysSinceLastPeriod).toBe(36);
  });

  // A gap in the log could be a month she forgot to fill in; only an explicit
  // report is treated as a missed period.
  it("counts explicitly reported missed months", () => {
    const analysis = analyseCycles(
      [period("2026-01-01")],
      [{ month: "2026-02", notes: "" }],
      "2026-03-01"
    );
    expect(analysis.reportedMissedMonths).toBe(1);
    expect(analysis.flags.map((f) => f.key)).toContain("missed-cycles");
  });

  it("reassures when there is nothing to flag", () => {
    const analysis = analyseCycles(regular, [], "2026-04-01");
    expect(analysis.flags).toHaveLength(1);
    expect(analysis.flags[0].key).toBe("regular");
    expect(analysis.flags[0].severity).toBe("low");
  });

  it("copes with an empty history", () => {
    const analysis = analyseCycles([], [], "2026-04-01");
    expect(analysis.cycleCount).toBe(0);
    expect(analysis.averageCycleLength).toBeNull();
    expect(analysis.lastPeriodStart).toBeNull();
    expect(analysis.isOverdue).toBe(false);
  });
});

describe("symptomFrequency", () => {
  it("ranks symptoms by how often they appear", () => {
    expect(
      symptomFrequency([
        period("2026-01-01", { symptoms: ["cramps", "acne"] }),
        period("2026-01-29", { symptoms: ["cramps"] }),
      ])
    ).toEqual([
      { symptom: "cramps", count: 2 },
      { symptom: "acne", count: 1 },
    ]);
  });
});
