import { describe, expect, it } from "vitest";
import { currentStreak, longestStreak, type JunkFoodLogEntry } from "../junkFoodStreak";

describe("currentStreak", () => {
  it("is 0 with no logs at all", () => {
    expect(currentStreak([], "2026-08-08")).toBe(0);
  });

  it("counts back from today through consecutive clean days", () => {
    const entries: JunkFoodLogEntry[] = [
      { date: "2026-08-06", ateJunkFood: false },
      { date: "2026-08-07", ateJunkFood: false },
      { date: "2026-08-08", ateJunkFood: false },
    ];
    expect(currentStreak(entries, "2026-08-08")).toBe(3);
  });

  it("is 0 when today was logged as junk food", () => {
    const entries: JunkFoodLogEntry[] = [
      { date: "2026-08-07", ateJunkFood: false },
      { date: "2026-08-08", ateJunkFood: true },
    ];
    expect(currentStreak(entries, "2026-08-08")).toBe(0);
  });

  it("does not break the streak just because today has not been logged yet", () => {
    const entries: JunkFoodLogEntry[] = [
      { date: "2026-08-06", ateJunkFood: false },
      { date: "2026-08-07", ateJunkFood: false },
      // 2026-08-08 (today) not logged yet
    ];
    expect(currentStreak(entries, "2026-08-08")).toBe(2);
  });

  it("stops at a gap (a day that was never logged) before today", () => {
    const entries: JunkFoodLogEntry[] = [
      { date: "2026-08-05", ateJunkFood: false },
      // 2026-08-06 missing
      { date: "2026-08-07", ateJunkFood: false },
      { date: "2026-08-08", ateJunkFood: false },
    ];
    expect(currentStreak(entries, "2026-08-08")).toBe(2);
  });

  it("stops at a junk-food day further back", () => {
    const entries: JunkFoodLogEntry[] = [
      { date: "2026-08-05", ateJunkFood: false },
      { date: "2026-08-06", ateJunkFood: true },
      { date: "2026-08-07", ateJunkFood: false },
      { date: "2026-08-08", ateJunkFood: false },
    ];
    expect(currentStreak(entries, "2026-08-08")).toBe(2);
  });
});

describe("longestStreak", () => {
  it("is 0 with no clean days", () => {
    expect(longestStreak([{ date: "2026-08-08", ateJunkFood: true }])).toBe(0);
  });

  it("finds the longest run even if it is not the most recent one", () => {
    const entries: JunkFoodLogEntry[] = [
      { date: "2026-08-01", ateJunkFood: false },
      { date: "2026-08-02", ateJunkFood: false },
      { date: "2026-08-03", ateJunkFood: false },
      { date: "2026-08-04", ateJunkFood: false },
      { date: "2026-08-05", ateJunkFood: true },
      { date: "2026-08-06", ateJunkFood: false },
      { date: "2026-08-07", ateJunkFood: false },
    ];
    expect(longestStreak(entries)).toBe(4);
  });

  it("treats an unlogged gap as breaking the run", () => {
    const entries: JunkFoodLogEntry[] = [
      { date: "2026-08-01", ateJunkFood: false },
      { date: "2026-08-02", ateJunkFood: false },
      // 2026-08-03 missing
      { date: "2026-08-04", ateJunkFood: false },
    ];
    expect(longestStreak(entries)).toBe(2);
  });

  it("is unaffected by input order", () => {
    const entries: JunkFoodLogEntry[] = [
      { date: "2026-08-03", ateJunkFood: false },
      { date: "2026-08-01", ateJunkFood: false },
      { date: "2026-08-02", ateJunkFood: false },
    ];
    expect(longestStreak(entries)).toBe(3);
  });
});
