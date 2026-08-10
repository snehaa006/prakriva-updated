import { describe, expect, it } from "vitest";
import {
  parseHealthTrack,
  resolveHealthTrack,
  showsCycleTracking,
  showsDiseaseDetection,
} from "../healthTrack";

describe("parseHealthTrack", () => {
  it("accepts the canonical values", () => {
    expect(parseHealthTrack("pregnancy")).toBe("pregnancy");
    expect(parseHealthTrack("pcos")).toBe("pcos");
    expect(parseHealthTrack("general")).toBe("general");
  });

  it("accepts the spellings patients and older records use", () => {
    expect(parseHealthTrack("PCOD")).toBe("pcos");
    expect(parseHealthTrack("PCOD/PCOS")).toBe("pcos");
    expect(parseHealthTrack(" Pregnant ")).toBe("pregnancy");
    // The questionnaire's own "no" answer for the pregnancy question.
    expect(parseHealthTrack("none")).toBe("general");
    expect(parseHealthTrack("not_applicable")).toBe("general");
  });

  it("returns null for anything unrecognised", () => {
    expect(parseHealthTrack("menopause")).toBeNull();
    expect(parseHealthTrack("")).toBeNull();
    expect(parseHealthTrack(undefined)).toBeNull();
    expect(parseHealthTrack(42)).toBeNull();
  });
});

describe("resolveHealthTrack", () => {
  it("prefers the column over everything else", () => {
    expect(
      resolveHealthTrack({
        column: "pcos",
        assessmentTrack: "pregnancy",
        lifeStage: "pregnancy",
      })
    ).toBe("pcos");
  });

  it("falls back to the assessment copy when the column is absent", () => {
    expect(resolveHealthTrack({ column: null, assessmentTrack: "pcos" })).toBe("pcos");
  });

  it("reads pregnancy off the pre-tracks lifeStage field", () => {
    expect(resolveHealthTrack({ lifeStage: "pregnancy" })).toBe("pregnancy");
  });

  it("infers PCOS from reported conditions when nothing else says", () => {
    expect(resolveHealthTrack({ conditions: ["thyroid", "PCOD"] })).toBe("pcos");
  });

  // Assuming pregnancy is exactly how the app ended up showing a maternal
  // screening to everybody, so an unknown patient must land on general.
  it("defaults to general rather than pregnancy", () => {
    expect(resolveHealthTrack({})).toBe("general");
    expect(resolveHealthTrack({ column: "nonsense" })).toBe("general");
  });
});

describe("track capabilities", () => {
  it("shows the maternal screening only to the pregnancy track", () => {
    expect(showsDiseaseDetection("pregnancy")).toBe(true);
    expect(showsDiseaseDetection("pcos")).toBe(false);
    expect(showsDiseaseDetection("general")).toBe(false);
  });

  it("shows the cycle trackers only to the PCOS track", () => {
    expect(showsCycleTracking("pcos")).toBe(true);
    expect(showsCycleTracking("pregnancy")).toBe(false);
    expect(showsCycleTracking("general")).toBe(false);
  });
});
