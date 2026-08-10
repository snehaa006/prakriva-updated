import { describe, expect, it } from "vitest";
import {
  analyseAcne,
  buildAcneGuidance,
  sortAcneEntries,
  type AcneEntry,
  type AcneRegion,
  type AcneSeverity,
} from "../acneGuidance";

const checkIn = (
  date: string,
  severity: AcneSeverity,
  regions: AcneRegion[] = []
): AcneEntry => ({
  id: `a-${date}`,
  date,
  severity,
  regions,
  notes: "",
  photoPath: null,
  aiSeverity: null,
  aiObservations: null,
});

describe("sortAcneEntries", () => {
  it("orders oldest first and drops undated rows", () => {
    const sorted = sortAcneEntries([
      checkIn("2026-03-01", "mild"),
      checkIn("bad-date", "severe"),
      checkIn("2026-01-01", "moderate"),
    ]);
    expect(sorted.map((e) => e.date)).toEqual(["2026-01-01", "2026-03-01"]);
  });
});

describe("analyseAcne", () => {
  it("has no direction from a single check-in", () => {
    const analysis = analyseAcne([checkIn("2026-01-01", "moderate")]);
    expect(analysis.trend).toBe("unknown");
    expect(analysis.severity).toBe("moderate");
    expect(analysis.entryCount).toBe(1);
  });

  it("calls a clear drop across two windows improving", () => {
    const analysis = analyseAcne([
      checkIn("2026-01-01", "severe"),
      checkIn("2026-01-15", "severe"),
      checkIn("2026-02-01", "moderate"),
      checkIn("2026-02-15", "mild"),
      checkIn("2026-03-01", "mild"),
      checkIn("2026-03-15", "clear"),
    ]);
    expect(analysis.trend).toBe("improving");
    expect(analysis.severity).toBe("clear");
  });

  it("calls a clear rise worsening", () => {
    const analysis = analyseAcne([
      checkIn("2026-01-01", "clear"),
      checkIn("2026-01-15", "mild"),
      checkIn("2026-02-01", "mild"),
      checkIn("2026-02-15", "moderate"),
      checkIn("2026-03-01", "severe"),
      checkIn("2026-03-15", "severe"),
    ]);
    expect(analysis.trend).toBe("worsening");
  });

  // Below half a severity band, two people rating the same face would disagree.
  it("calls a small wobble steady", () => {
    const analysis = analyseAcne([
      checkIn("2026-01-01", "mild"),
      checkIn("2026-01-15", "mild"),
      checkIn("2026-02-01", "moderate"),
      checkIn("2026-02-15", "mild"),
      checkIn("2026-03-01", "mild"),
      checkIn("2026-03-15", "mild"),
    ]);
    expect(analysis.trend).toBe("steady");
  });

  it("spots the jaw/chin/neck distribution as the hormonal pattern", () => {
    const analysis = analyseAcne([
      checkIn("2026-01-01", "moderate", ["jawline", "chin"]),
      checkIn("2026-02-01", "moderate", ["jawline", "chin"]),
      checkIn("2026-03-01", "moderate", ["jawline"]),
    ]);
    expect(analysis.persistentRegions).toEqual(["chin", "jawline"]);
    expect(analysis.isHormonalPattern).toBe(true);
  });

  it("does not call forehead-only breakouts hormonal", () => {
    const analysis = analyseAcne([
      checkIn("2026-01-01", "mild", ["forehead"]),
      checkIn("2026-02-01", "mild", ["forehead", "cheeks"]),
      checkIn("2026-03-01", "mild", ["forehead", "cheeks"]),
    ]);
    expect(analysis.isHormonalPattern).toBe(false);
  });
});

describe("buildAcneGuidance", () => {
  it("keeps advice minimal when the skin is clear", () => {
    const guidance = buildAcneGuidance(analyseAcne([checkIn("2026-03-01", "clear")]));
    expect(guidance.seeADoctor).toBe(false);
    expect(guidance.nutrition.map((n) => n.key)).not.toContain("dairy-trial");
  });

  it("adds the dairy trial and an active from moderate upwards", () => {
    const guidance = buildAcneGuidance(analyseAcne([checkIn("2026-03-01", "moderate")]));
    expect(guidance.nutrition.map((n) => n.key)).toContain("dairy-trial");
    expect(guidance.skincare.map((s) => s.key)).toContain("actives");
    expect(guidance.avoidIngredients).toContain("milk");
  });

  // Scarring is far easier to prevent than to fix, so severe never reads as a
  // diet problem alone.
  it("sends severe acne to a doctor", () => {
    const guidance = buildAcneGuidance(analyseAcne([checkIn("2026-03-01", "severe")]));
    expect(guidance.seeADoctor).toBe(true);
    expect(guidance.skincare.map((s) => s.key)).toContain("see-a-doctor");
  });

  it("sends worsening moderate acne to a doctor too", () => {
    const guidance = buildAcneGuidance(
      analyseAcne([
        checkIn("2026-01-01", "clear"),
        checkIn("2026-01-15", "clear"),
        checkIn("2026-02-01", "mild"),
        checkIn("2026-02-15", "moderate"),
        checkIn("2026-03-01", "moderate"),
        checkIn("2026-03-15", "moderate"),
      ])
    );
    expect(guidance.seeADoctor).toBe(true);
  });

  it("tells an improving patient to change nothing", () => {
    const guidance = buildAcneGuidance(
      analyseAcne([
        checkIn("2026-01-01", "severe"),
        checkIn("2026-01-15", "severe"),
        checkIn("2026-02-01", "moderate"),
        checkIn("2026-02-15", "mild"),
        checkIn("2026-03-01", "mild"),
        checkIn("2026-03-15", "mild"),
      ])
    );
    expect(guidance.skincare.map((s) => s.key)).toContain("stay-the-course");
  });

  it("names the insulin-facing lever for a hormonal distribution", () => {
    const guidance = buildAcneGuidance(
      analyseAcne([
        checkIn("2026-01-01", "moderate", ["jawline", "chin"]),
        checkIn("2026-02-01", "moderate", ["jawline", "chin"]),
        checkIn("2026-03-01", "moderate", ["chin"]),
      ])
    );
    expect(guidance.nutrition.map((n) => n.key)).toContain("hormonal-pattern");
    expect(guidance.focusIngredients).toContain("cinnamon");
  });
});
