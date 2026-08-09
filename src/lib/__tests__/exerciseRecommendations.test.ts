import { describe, expect, it } from "vitest";
import {
  GENERAL_PLAN,
  matchConditionKey,
  recommendExercises,
  videoUrl,
} from "../exerciseRecommendations";

const ids = (result: ReturnType<typeof recommendExercises>) =>
  result.exercises.map((e) => e.id);

describe("matchConditionKey", () => {
  it("passes canonical screening keys straight through", () => {
    expect(matchConditionKey("anaemia")).toBe("anaemia");
    expect(matchConditionKey("mental_health")).toBe("mental_health");
  });

  it("matches the spellings and shorthands patients actually use", () => {
    expect(matchConditionKey("Anemia")).toBe("anaemia");
    expect(matchConditionKey("PCOD")).toBe("pcos");
    expect(matchConditionKey("high BP")).toBe("hypertension");
    expect(matchConditionKey("Hypothyroidism")).toBe("thyroid");
    expect(matchConditionKey("knee pain")).toBe("arthritis");
  });

  it("returns null rather than guessing at something unknown", () => {
    expect(matchConditionKey("purple spots")).toBeNull();
    expect(matchConditionKey("")).toBeNull();
  });

  it("distinguishes gestational diabetes from type 2", () => {
    expect(matchConditionKey("Gestational Diabetes")).toBe("gdm");
    expect(matchConditionKey("Type 2 Diabetes")).toBe("diabetes");
  });
});

describe("recommendExercises", () => {
  it("gives anaemia gentle, oxygen-conservative work and warns off intensity", () => {
    const result = recommendExercises({ conditions: [{ condition: "anaemia" }] });

    expect(result.isGeneral).toBe(false);
    expect(ids(result)).toContain("gentle-walk");
    expect(ids(result)).toContain("pranayama");
    // The whole point: nothing breathless in an anaemia plan.
    expect(ids(result)).not.toContain("brisk-walk");
    expect(ids(result)).not.toContain("surya-namaskar");
    expect(result.exercises.every((e) => e.intensity !== "brisk")).toBe(true);
    expect(result.avoid.join(" ")).toMatch(/high-intensity/i);
  });

  it("gives PCOS aerobic plus resistance work — the opposite of the anaemia plan", () => {
    const result = recommendExercises({ conditions: [{ condition: "PCOS" }] });
    expect(ids(result)).toContain("strength-training");
    expect(ids(result)).toContain("brisk-walk");
  });

  it("times movement around meals for gestational diabetes", () => {
    const result = recommendExercises({ conditions: [{ condition: "gdm" }] });
    expect(ids(result)[0]).toBe("post-meal-walk");
  });

  it("falls back to the general plan when nothing matches", () => {
    const result = recommendExercises({ conditions: [{ condition: "purple spots" }] });
    expect(result.isGeneral).toBe(true);
    expect(result.plans).toEqual([GENERAL_PLAN]);
    expect(result.exercises.length).toBeGreaterThan(0);
  });

  it("falls back to the general plan when there are no conditions at all", () => {
    expect(recommendExercises({ conditions: [] }).isGeneral).toBe(true);
  });

  it("leads with the highest-risk condition", () => {
    const result = recommendExercises({
      conditions: [
        { condition: "thyroid", riskLevel: "moderate" },
        { condition: "preeclampsia", riskLevel: "high" },
      ],
    });
    expect(result.plans[0].key).toBe("preeclampsia");
  });

  it("merges several conditions without duplicating exercises or advice", () => {
    const result = recommendExercises({
      conditions: [{ condition: "anaemia" }, { condition: "mental_health" }],
    });
    expect(new Set(ids(result)).size).toBe(ids(result).length);
    expect(new Set(result.avoid).size).toBe(result.avoid.length);
  });

  it("keeps the more urgent ranking when a condition is reported twice", () => {
    const result = recommendExercises({
      conditions: [
        { condition: "anaemia", riskLevel: "high" },
        { condition: "Anemia" },
        { condition: "thyroid", riskLevel: "moderate" },
      ],
    });
    expect(result.plans.map((p) => p.key)).toEqual(["anaemia", "thyroid"]);
  });

  it("swaps unsafe movements for pregnancy-safe ones", () => {
    const result = recommendExercises({
      conditions: [{ condition: "pcos" }],
      isPregnant: true,
    });
    expect(ids(result)).not.toContain("strength-training");
    expect(ids(result)).not.toContain("core-stability");
    expect(ids(result)).not.toContain("surya-namaskar");
    expect(ids(result)).toContain("prenatal-yoga");
    expect(result.avoid.join(" ")).toMatch(/first trimester/i);
  });

  it("gives every recommended exercise a working video link", () => {
    // Sweep every condition so no catalog entry escapes the check.
    const conditions = [
      "anaemia",
      "gdm",
      "diabetes",
      "preeclampsia",
      "hypertension",
      "thyroid",
      "pcos",
      "mental_health",
      "uti",
      "miscarriage",
      "pregnancy_risk",
      "obesity",
      "arthritis",
      "asthma",
      "back_pain",
      "digestive",
      "heart_disease",
    ].map((condition) => ({ condition }));

    for (const isPregnant of [false, true]) {
      for (const exercise of recommendExercises({ conditions, isPregnant }).exercises) {
        expect(exercise.videoQuery.trim()).not.toBe("");

        const url = new URL(videoUrl(exercise));
        expect(url.origin).toBe("https://www.youtube.com");
        expect(url.pathname).toBe("/results");
        // Round-trips through encoding rather than losing spaces or accents.
        expect(url.searchParams.get("search_query")).toBe(exercise.videoQuery);
      }
    }
  });

  it("escapes query characters that would otherwise break the URL", () => {
    const url = new URL(
      videoUrl({
        id: "x",
        name: "x",
        icon: "walk",
        intensity: "gentle",
        minutes: 10,
        how: "x",
        videoQuery: "yoga & breathing = calm? #1",
      })
    );
    expect(url.searchParams.get("search_query")).toBe("yoga & breathing = calm? #1");
  });

  it("only ever returns exercises that exist in the catalog", () => {
    const result = recommendExercises({
      conditions: [
        { condition: "anaemia" },
        { condition: "asthma" },
        { condition: "back pain" },
        { condition: "heart disease" },
      ],
      isPregnant: true,
    });
    expect(result.exercises.every((e) => e && e.id && e.minutes > 0)).toBe(true);
  });
});
