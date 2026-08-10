import { describe, expect, it } from "vitest";
import {
  describeHealthTracks,
  lifeStageForTracks,
  parseHealthTrack,
  parseHealthTracks,
  resolveHealthTracks,
  showsCycleTracking,
  showsDiseaseDetection,
} from "../healthTrack";

describe("parseHealthTrack", () => {
  it("accepts the canonical values", () => {
    expect(parseHealthTrack("pregnancy")).toBe("pregnancy");
    expect(parseHealthTrack("pcos")).toBe("pcos");
  });

  it("accepts the spellings patients and older records use", () => {
    expect(parseHealthTrack("PCOD")).toBe("pcos");
    expect(parseHealthTrack("PCOD/PCOS")).toBe("pcos");
    expect(parseHealthTrack(" Pregnant ")).toBe("pregnancy");
  });

  // General wellness is the empty set, not a track.
  it("returns null for the general/none values and anything unrecognised", () => {
    expect(parseHealthTrack("general")).toBeNull();
    expect(parseHealthTrack("none")).toBeNull();
    expect(parseHealthTrack("menopause")).toBeNull();
    expect(parseHealthTrack(undefined)).toBeNull();
    expect(parseHealthTrack(42)).toBeNull();
  });
});

describe("parseHealthTracks", () => {
  it("keeps both tracks when both are present", () => {
    expect(parseHealthTracks(["pcos", "pregnancy"])).toEqual(["pregnancy", "pcos"]);
  });

  it("deduplicates and orders consistently", () => {
    expect(parseHealthTracks(["PCOD", "pcos", "pregnant"])).toEqual([
      "pregnancy",
      "pcos",
    ]);
  });

  // An explicit "general" is an answer; a missing value is not.
  it("reads an explicit general as the empty set and nothing as null", () => {
    expect(parseHealthTracks(["general"])).toEqual([]);
    expect(parseHealthTracks([])).toBeNull();
    expect(parseHealthTracks(undefined)).toBeNull();
  });
});

describe("describeHealthTracks", () => {
  it("names one, both, or neither", () => {
    expect(describeHealthTracks(["pregnancy"])).toBe("Pregnancy");
    expect(describeHealthTracks(["pcos", "pregnancy"])).toBe("Pregnancy + PCOD / PCOS");
    expect(describeHealthTracks([])).toBe("General wellness");
  });
});

describe("resolveHealthTracks", () => {
  it("prefers the column over everything else", () => {
    expect(
      resolveHealthTracks({
        column: ["pcos"],
        assessmentTracks: ["pregnancy"],
        lifeStage: "pregnancy",
      })
    ).toEqual(["pcos"]);
  });

  it("falls back to the assessment copy when the column is absent", () => {
    expect(resolveHealthTracks({ column: null, assessmentTracks: ["pcos"] })).toEqual([
      "pcos",
    ]);
  });

  it("reads pregnancy off the pre-tracks lifeStage field", () => {
    expect(resolveHealthTracks({ lifeStage: "pregnancy" })).toEqual(["pregnancy"]);
  });

  // The exact case a single-valued column got wrong.
  it("combines a legacy pregnancy lifeStage with a reported PCOS condition", () => {
    expect(
      resolveHealthTracks({
        lifeStage: "pregnancy",
        conditions: ["thyroid", "PCOD"],
      })
    ).toEqual(["pregnancy", "pcos"]);
  });

  it("infers PCOS from reported conditions when nothing else says", () => {
    expect(resolveHealthTracks({ conditions: ["thyroid", "PCOD"] })).toEqual(["pcos"]);
  });

  // Assuming pregnancy is exactly how the app ended up showing a maternal
  // screening to everybody, so an unknown patient must land on no tracks.
  it("defaults to the empty set rather than pregnancy", () => {
    expect(resolveHealthTracks({})).toEqual([]);
    expect(resolveHealthTracks({ column: "nonsense" })).toEqual([]);
  });
});

describe("track capabilities", () => {
  it("shows the maternal screening to anyone pregnant, including with PCOS", () => {
    expect(showsDiseaseDetection(["pregnancy"])).toBe(true);
    expect(showsDiseaseDetection(["pregnancy", "pcos"])).toBe(true);
    expect(showsDiseaseDetection(["pcos"])).toBe(false);
    expect(showsDiseaseDetection([])).toBe(false);
  });

  it("shows the cycle trackers to anyone with PCOS, including when pregnant", () => {
    expect(showsCycleTracking(["pcos"])).toBe(true);
    expect(showsCycleTracking(["pregnancy", "pcos"])).toBe(true);
    expect(showsCycleTracking(["pregnancy"])).toBe(false);
    expect(showsCycleTracking([])).toBe(false);
  });
});

describe("lifeStageForTracks", () => {
  // A safety rule, not a preference: the PCOS targets run a deficit and
  // exclude foods, neither of which belongs near a pregnancy.
  it("puts pregnancy ahead of PCOS when both apply", () => {
    expect(lifeStageForTracks(["pregnancy", "pcos"])).toBe("pregnancy");
  });

  it("uses each track on its own, and general for neither", () => {
    expect(lifeStageForTracks(["pregnancy"])).toBe("pregnancy");
    expect(lifeStageForTracks(["pcos"])).toBe("pcos");
    expect(lifeStageForTracks([])).toBe("not_applicable");
  });
});
