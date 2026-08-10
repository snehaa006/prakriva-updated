import { describe, expect, it } from "vitest";

import {
  LIFE_STAGES,
  describeLifeStage,
  lifeStageInfo,
  resolveLifeStage,
  type LifeStage,
} from "../lifeStage";

const ALL = Object.keys(LIFE_STAGES) as LifeStage[];

describe("resolveLifeStage", () => {
  it.each(ALL)("passes %s through unchanged", (stage) => {
    expect(resolveLifeStage(stage)).toBe(stage);
  });

  // The value comes from a free-form assessment blob, so every shape of
  // "missing" has to land somewhere renderable rather than blanking the header.
  it.each([undefined, null, "", "  ", "gestation", "PREGNANCY", "toString"])(
    "falls back to general wellness for %o",
    (raw) => {
      expect(resolveLifeStage(raw as string | null | undefined)).toBe("not_applicable");
    },
  );

  it("does not resolve inherited Object properties to a stage", () => {
    // `raw in LIFE_STAGES` would say yes to "constructor" if the check were
    // careless about the prototype chain.
    expect(resolveLifeStage("constructor")).toBe("not_applicable");
    expect(lifeStageInfo("constructor")).toBe(LIFE_STAGES.not_applicable);
  });
});

describe("every stage is renderable", () => {
  it.each(ALL)("%s has a label, an illustration and tips", (stage) => {
    const info = LIFE_STAGES[stage];
    expect(info.label).toBeTruthy();
    expect(info.art).toBeTruthy();
    expect(info.tips.length).toBeGreaterThan(0);
    expect(info.tips.every((t) => t.trim().length > 0)).toBe(true);
  });

  it("gives each stage its own illustration", () => {
    const art = ALL.map((s) => LIFE_STAGES[s].art);
    expect(new Set(art).size).toBe(art.length);
  });

  it("keeps stage chips tinted, never filled", () => {
    // A life stage is context, not a status. A solid badge next to a greeting
    // reads as an alert about the pregnancy rather than a label for it.
    for (const stage of ALL) {
      expect(LIFE_STAGES[stage].badgeClass).toContain("border-transparent");
      expect(LIFE_STAGES[stage].badgeClass).not.toMatch(/bg-(primary|destructive)\b/);
    }
  });
});

describe("describeLifeStage", () => {
  it("qualifies pregnancy with the trimester when there is one", () => {
    expect(describeLifeStage("pregnancy", "2")).toBe("Pregnancy · T2");
  });

  it("omits the trimester when it is not recorded", () => {
    expect(describeLifeStage("pregnancy", undefined)).toBe("Pregnancy");
    expect(describeLifeStage("pregnancy", "")).toBe("Pregnancy");
    expect(describeLifeStage("pregnancy", null)).toBe("Pregnancy");
  });

  it("never attaches a trimester to a stage that cannot have one", () => {
    // A stale trimester left on the record after a birth must not produce
    // "Postpartum · T3".
    expect(describeLifeStage("postpartum", "3")).toBe("Postpartum");
    expect(describeLifeStage("menopause", "1")).toBe("Menopause");
    expect(describeLifeStage("not_applicable", "2")).toBe("General wellness");
  });
});
