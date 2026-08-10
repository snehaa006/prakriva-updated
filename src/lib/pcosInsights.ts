// What a PCOD/PCOS patient's own logs say her diet plan should do.
//
// A pregnant patient's plan is built on top of the maternal screening: the
// doctor opens Patient Analysis, the pipeline scores her conditions, and the
// generator reads that. A PCOS patient has no such pipeline — there is nothing
// to screen for, she already has the diagnosis. What she has instead is three
// running logs: her cycles, her weight and her exercise. This module is the
// PCOS track's equivalent of that analysis: it reads those three and produces
// the same shape of answer the generator wants — a calorie adjustment, an
// ingredient emphasis, and notes explaining why.
//
// It never invents a number the logs cannot support. With no weight history
// there is no calorie adjustment; with fewer than three cycles there is no
// verdict on regularity. Saying "not enough data yet" is the correct output
// for a patient who signed up last week.
//
// Pure and dependency-free; see src/lib/__tests__/pcosInsights.test.ts.

import type { CycleAnalysis } from "@/lib/cycleTracking";
import type { WeightAnalysis } from "@/lib/weightLog";
import { needsWeightReduction } from "@/lib/weightLog";
import type { AcneAnalysis } from "@/lib/acneGuidance";
import type { PlanAdjustment } from "@/services/dietChartService";

/** Activity, as the Lifestyle Tracker records it. */
export interface ActivitySummary {
  /** Average minutes of logged movement per day over the last week. */
  avgMinutesPerDay: number;
  /** Days in the last week with any movement logged. */
  activeDaysPerWeek: number;
}

/** Movement below this (min/day) is treated as effectively sedentary. */
export const SEDENTARY_MINUTES = 15;
/** Movement at or above this (min/day) is an established habit. */
export const ACTIVE_MINUTES = 35;

/** A modest, sustainable deficit. Aggressive cuts worsen PCOS, not help it. */
export const WEIGHT_LOSS_DEFICIT_KCAL = 300;
/** Added back when she is training consistently, so the deficit stays modest. */
export const ACTIVE_ALLOWANCE_KCAL = 150;

export interface InsightDriver {
  key: string;
  label: string;
  detail: string;
}

export interface PcosInsight {
  /** One line a doctor can read at a glance. */
  summary: string;
  /** What the adjustment was derived from, each with its reasoning. */
  drivers: InsightDriver[];
  /** What is missing before the analysis means much. */
  gaps: string[];
  /** True when there is enough logged to tune a plan at all. */
  hasEnoughData: boolean;
  /** The tuning to hand `generateDietChart`. */
  adjustment: PlanAdjustment;
}

export interface PcosInsightInput {
  cycles: CycleAnalysis;
  weight: WeightAnalysis;
  activity: ActivitySummary;
  /** Optional — the skin tracker is not mandatory. */
  acne?: AcneAnalysis | null;
}

/**
 * Combine a PCOS patient's logs into a plan adjustment.
 *
 * Each driver contributes independently, and the calorie deltas add up rather
 * than one winning: a patient who is gaining weight *and* training hard should
 * end up somewhere between the two, which is what summing gives.
 */
export const buildPcosInsight = ({
  cycles,
  weight,
  activity,
  acne = null,
}: PcosInsightInput): PcosInsight => {
  const drivers: InsightDriver[] = [];
  const gaps: string[] = [];
  const focusIngredients: string[] = [];
  const avoidIngredients: string[] = [];
  const notes: string[] = [];
  let calorieDelta = 0;

  // --- Weight -------------------------------------------------------------
  if (weight.latest === null) {
    gaps.push("No weight logged yet — the calorie target is the population default.");
  } else if (needsWeightReduction(weight)) {
    calorieDelta -= WEIGHT_LOSS_DEFICIT_KCAL;
    drivers.push({
      key: "weight-reduction",
      label: weight.isRapidGain ? "Gaining weight" : "Weight in the reduction range",
      detail: weight.isRapidGain
        ? `Up ${weight.changeKgPerMonth} kg/month recently. A modest ${WEIGHT_LOSS_DEFICIT_KCAL} kcal/day deficit with a low-glycaemic pattern, not a crash diet — sharp restriction raises cortisol and makes PCOS worse.`
        : `BMI ${weight.bmi} sits in the ${weight.band} range. Losing 5% of body weight is the intervention with the strongest evidence for restoring ovulation, so the plan runs a ${WEIGHT_LOSS_DEFICIT_KCAL} kcal/day deficit.`,
    });
    notes.push(
      `Reduced-calorie plan (${WEIGHT_LOSS_DEFICIT_KCAL} kcal/day below the standard PCOS band), aimed at a gradual 5% weight loss`
    );
    focusIngredients.push("cucumber", "cabbage", "bottle gourd", "sprout", "buttermilk");
    avoidIngredients.push("ghee", "butter", "coconut oil", "sweet");
  } else if (weight.band === "underweight") {
    calorieDelta += 200;
    drivers.push({
      key: "underweight",
      label: "Underweight",
      detail: `BMI ${weight.bmi}. Lean PCOS is real and does not want a deficit — the plan adds calories from nutrient-dense food rather than restricting.`,
    });
    notes.push("Calorie target raised — lean PCOS is managed by food quality, not restriction");
    focusIngredients.push("almond", "date", "banana", "peanut", "sesame", "ghee");
  } else if (weight.trend === "losing") {
    drivers.push({
      key: "losing",
      label: "Weight trending down",
      detail: `Down ${Math.abs(weight.changeKg ?? 0)} kg over the logged window, already in a healthy range. The plan holds the standard PCOS band rather than deepening a deficit.`,
    });
  }

  // --- Cycles -------------------------------------------------------------
  if (cycles.cycleCount === 0) {
    gaps.push("No cycles logged yet — log a couple of periods to tune this properly.");
  } else if (cycles.regularity === "insufficient-data") {
    gaps.push(
      `Only ${cycles.cycleCount} cycle${cycles.cycleCount === 1 ? "" : "s"} logged — three is the point a regularity verdict means anything.`
    );
  }

  if (cycles.longCycles > 0 || cycles.missedCycles > 0 || cycles.reportedMissedMonths > 0) {
    drivers.push({
      key: "anovulatory",
      label: "Infrequent or missed cycles",
      detail:
        "Long gaps between periods point at cycles that aren't ovulating, which is the insulin-resistance end of PCOS. The plan leans hard on low-glycaemic carbohydrate, fibre at every meal, and the spices with the best insulin-sensitivity evidence.",
    });
    notes.push(
      "Cycle log shows infrequent or missed periods — low glycaemic load prioritised over calorie count"
    );
    focusIngredients.push(
      "cinnamon",
      "fenugreek",
      "millet",
      "barley",
      "flaxseed",
      "chickpea"
    );
    avoidIngredients.push("white rice", "maida", "sugar", "sweetened beverage");
  }

  if (cycles.heavyPeriods >= 2 || cycles.prolongedPeriods > 0 || cycles.twiceInAMonth > 0) {
    drivers.push({
      key: "iron-loss",
      label: "Heavy, prolonged or frequent bleeding",
      detail:
        "Bleeding this often or this heavily costs iron faster than an ordinary diet replaces it. Iron-rich food is weighted up and paired with vitamin C, which is what actually gets plant iron absorbed.",
    });
    notes.push(
      "Iron intake prioritised and paired with vitamin C — the cycle log shows heavy, prolonged or frequent bleeding"
    );
    focusIngredients.push(
      "spinach",
      "amaranth",
      "rajma",
      "date",
      "jaggery",
      "amla",
      "guava",
      "lemon",
      "orange"
    );
  }

  if (cycles.shortCycles > 0 && cycles.twiceInAMonth === 0) {
    notes.push("Short cycles logged — iron and B12 kept high across the plan");
    focusIngredients.push("spinach", "egg", "yogurt");
  }

  // --- Activity -----------------------------------------------------------
  if (activity.avgMinutesPerDay < SEDENTARY_MINUTES) {
    drivers.push({
      key: "sedentary",
      label: "Little movement logged",
      detail: `${activity.avgMinutesPerDay} min/day on average. The calorie band assumes a sedentary week, and the plan lifts protein and fibre so the deficit is felt as fullness rather than hunger. Movement is the other half of insulin sensitivity — the exercise tracker has the specifics.`,
    });
    notes.push(
      "Calorie band assumes a sedentary week — revise upward as her activity log fills in"
    );
    focusIngredients.push("lentil", "paneer", "egg", "oat");
  } else if (activity.avgMinutesPerDay >= ACTIVE_MINUTES) {
    calorieDelta += ACTIVE_ALLOWANCE_KCAL;
    drivers.push({
      key: "active",
      label: "Training consistently",
      detail: `${activity.avgMinutesPerDay} min/day across ${activity.activeDaysPerWeek} day${activity.activeDaysPerWeek === 1 ? "" : "s"} a week. Calories are added back so the deficit stays modest, and protein goes up to hold on to the muscle that is doing the glucose disposal.`,
    });
    notes.push(
      `${ACTIVE_ALLOWANCE_KCAL} kcal/day added back for a consistent training week, with protein prioritised`
    );
    focusIngredients.push("paneer", "egg", "chickpea", "greek yogurt", "peanut");
  }

  // --- Skin ---------------------------------------------------------------
  if (acne && (acne.severity === "moderate" || acne.severity === "severe")) {
    drivers.push({
      key: "acne",
      label: "Active acne",
      detail:
        "PCOS acne is androgen-driven and responds to the same insulin-facing changes. Omega-3 and zinc go up; milk comes out for a trial period, since skim milk in particular is the dairy most consistently linked with acne.",
    });
    notes.push(
      "Skin log shows active acne — omega-3 and zinc prioritised, milk excluded for a three-week trial"
    );
    focusIngredients.push("flaxseed", "chia", "walnut", "pumpkin seed", "turmeric", "green tea");
    avoidIngredients.push("milk", "skim milk", "whey", "fried");
  }

  const hasEnoughData = drivers.length > 0;

  const summary = hasEnoughData
    ? drivers.map((d) => d.label).join(" · ")
    : "Not enough logged yet to tune the plan — it will use the standard PCOS targets.";

  // A food ruled out by one driver stays out even if another wanted it in —
  // ghee is added for lean PCOS and removed for weight reduction, and the
  // removal has to win. Resolved here so the insight a doctor reads matches
  // what the generator will actually do with it.
  const avoid = new Set(avoidIngredients);

  return {
    summary,
    drivers,
    gaps,
    hasEnoughData,
    adjustment: {
      calorieDelta,
      focusIngredients: [...new Set(focusIngredients)].filter((i) => !avoid.has(i)),
      avoidIngredients: [...avoid],
      notes,
    },
  };
};
