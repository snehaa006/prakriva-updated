import { describe, expect, it } from "vitest";
import {
  ACTIVE_ALLOWANCE_KCAL,
  WEIGHT_LOSS_DEFICIT_KCAL,
  buildPcosInsight,
  type ActivitySummary,
} from "../pcosInsights";
import { analyseCycles, type PeriodEntry } from "../cycleTracking";
import { analyseWeights, type WeightEntry } from "../weightLog";
import { analyseAcne, type AcneEntry } from "../acneGuidance";

const TODAY = "2026-04-01";

const period = (startDate: string, overrides: Partial<PeriodEntry> = {}): PeriodEntry => ({
  id: `p-${startDate}`,
  startDate,
  endDate: null,
  flow: null,
  symptoms: [],
  notes: "",
  ...overrides,
});

const weigh = (date: string, weightKg: number): WeightEntry => ({
  date,
  weightKg,
  notes: "",
});

const sedentary: ActivitySummary = { avgMinutesPerDay: 5, activeDaysPerWeek: 1 };
const active: ActivitySummary = { avgMinutesPerDay: 45, activeDaysPerWeek: 5 };
const moderate: ActivitySummary = { avgMinutesPerDay: 25, activeDaysPerWeek: 4 };

const noCycles = analyseCycles([], [], TODAY);
const noWeight = analyseWeights([], null, { today: TODAY });

describe("buildPcosInsight", () => {
  // A patient who signed up last week has nothing to tune a plan from, and
  // saying so is the correct answer rather than inventing an adjustment.
  it("reports no adjustment and names the gaps when nothing is logged", () => {
    const insight = buildPcosInsight({
      cycles: noCycles,
      weight: noWeight,
      activity: moderate,
    });

    expect(insight.hasEnoughData).toBe(false);
    expect(insight.adjustment.calorieDelta).toBe(0);
    expect(insight.adjustment.notes).toEqual([]);
    expect(insight.gaps).toHaveLength(2);
    expect(insight.summary).toContain("Not enough logged");
  });

  it("runs a modest deficit for a patient in the reduction range", () => {
    const insight = buildPcosInsight({
      cycles: noCycles,
      weight: analyseWeights([weigh("2026-03-01", 80)], 160, { today: TODAY }),
      activity: moderate,
    });

    expect(insight.adjustment.calorieDelta).toBe(-WEIGHT_LOSS_DEFICIT_KCAL);
    expect(insight.drivers.map((d) => d.key)).toContain("weight-reduction");
  });

  // Lean PCOS is real, and a deficit is the wrong answer for it.
  it("adds calories rather than cutting them for an underweight patient", () => {
    const insight = buildPcosInsight({
      cycles: noCycles,
      weight: analyseWeights([weigh("2026-03-01", 42)], 165, { today: TODAY }),
      activity: moderate,
    });

    expect(insight.adjustment.calorieDelta).toBeGreaterThan(0);
    expect(insight.drivers.map((d) => d.key)).toContain("underweight");
    expect(insight.adjustment.focusIngredients).toContain("almond");
  });

  it("emphasises low-glycaemic carbohydrate when cycles are infrequent", () => {
    const insight = buildPcosInsight({
      cycles: analyseCycles(
        [period("2026-01-01"), period("2026-02-15"), period("2026-03-25")],
        [],
        TODAY
      ),
      weight: noWeight,
      activity: moderate,
    });

    expect(insight.drivers.map((d) => d.key)).toContain("anovulatory");
    expect(insight.adjustment.focusIngredients).toContain("cinnamon");
    expect(insight.adjustment.avoidIngredients).toContain("white rice");
  });

  it("prioritises iron when bleeding is heavy or prolonged", () => {
    const insight = buildPcosInsight({
      cycles: analyseCycles(
        [
          period("2026-01-01", { flow: "heavy", endDate: "2026-01-11" }),
          period("2026-02-01", { flow: "heavy", endDate: "2026-02-06" }),
        ],
        [],
        TODAY
      ),
      weight: noWeight,
      activity: moderate,
    });

    expect(insight.drivers.map((d) => d.key)).toContain("iron-loss");
    expect(insight.adjustment.focusIngredients).toEqual(
      expect.arrayContaining(["spinach", "amla"])
    );
  });

  it("adds calories back for a consistent training week", () => {
    const insight = buildPcosInsight({
      cycles: noCycles,
      weight: noWeight,
      activity: active,
    });

    expect(insight.adjustment.calorieDelta).toBe(ACTIVE_ALLOWANCE_KCAL);
    expect(insight.drivers.map((d) => d.key)).toContain("active");
  });

  // Two drivers pulling opposite ways should land in between, not let one win.
  it("sums the deficit and the training allowance", () => {
    const insight = buildPcosInsight({
      cycles: noCycles,
      weight: analyseWeights([weigh("2026-03-01", 80)], 160, { today: TODAY }),
      activity: active,
    });

    expect(insight.adjustment.calorieDelta).toBe(
      ACTIVE_ALLOWANCE_KCAL - WEIGHT_LOSS_DEFICIT_KCAL
    );
  });

  it("flags a sedentary week without changing the calorie band", () => {
    const insight = buildPcosInsight({
      cycles: noCycles,
      weight: noWeight,
      activity: sedentary,
    });

    expect(insight.adjustment.calorieDelta).toBe(0);
    expect(insight.drivers.map((d) => d.key)).toContain("sedentary");
  });

  it("pulls dairy for active acne", () => {
    const acne: AcneEntry = {
      id: "a1",
      date: "2026-03-20",
      severity: "moderate",
      regions: ["jawline"],
      notes: "",
      photoPath: null,
      aiSeverity: null,
      aiObservations: null,
    };

    const insight = buildPcosInsight({
      cycles: noCycles,
      weight: noWeight,
      activity: moderate,
      acne: analyseAcne([acne]),
    });

    expect(insight.drivers.map((d) => d.key)).toContain("acne");
    expect(insight.adjustment.avoidIngredients).toContain("milk");
  });

  // Ghee is added for lean PCOS and removed for weight reduction; the removal
  // has to win, or the plan contradicts the reason it was tuned.
  it("never leaves an ingredient on both lists", () => {
    const insight = buildPcosInsight({
      cycles: analyseCycles(
        [period("2026-01-01"), period("2026-02-15"), period("2026-03-25")],
        [],
        TODAY
      ),
      weight: analyseWeights([weigh("2026-03-01", 85)], 160, { today: TODAY }),
      activity: active,
    });

    const avoid = new Set(insight.adjustment.avoidIngredients);
    expect(insight.adjustment.focusIngredients.filter((i) => avoid.has(i))).toEqual([]);
  });
});
