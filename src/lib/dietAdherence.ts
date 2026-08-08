// Did the patient hit her daily nutrition, and did she follow the diet plan
// her doctor provided? Derived from the meal statuses she logs on the Meal
// Logging page (`meal_tracking`) against the nutritional targets for her life
// stage.
//
// Deliberately *not* a streak: a missed day here is dietary information for
// her doctor, not a game to be reset. Each day stands on its own.
//
// Pure; see src/lib/__tests__/dietAdherence.test.ts.

/** One `meal_tracking` row, normalised. */
export interface MealTrackingDay {
  date: string;
  totalMeals: number;
  eatenCount: number;
  skippedCount: number;
  caloriesConsumed: number;
}

/** Daily calorie window from `NutritionalTargets.calories`. */
export interface CalorieTarget {
  min: number;
  max: number;
  label: string;
}

/**
 * Share of planned meals that must be eaten for the day to count as following
 * the plan. Not 100% — one swapped or missed snack shouldn't read as a failed
 * day, but half the plan should.
 */
export const PLAN_FOLLOWED_THRESHOLD = 0.8;

export interface DietAdherenceDay {
  date: string;
  /** False when there was no plan logged that day — neither pass nor fail. */
  hasPlan: boolean;
  mealsPlanned: number;
  mealsEaten: number;
  mealsSkipped: number;
  caloriesConsumed: number;
  calorieTarget: CalorieTarget;
  /** Ate at least the minimum calories her life stage calls for. */
  nutritionComplete: boolean;
  /** Ate past the top of the range — worth flagging, not a failure. */
  overTarget: boolean;
  /** Followed the provided plan (see `PLAN_FOLLOWED_THRESHOLD`). */
  planFollowed: boolean;
  /** 0–100, share of planned meals eaten. */
  planCompletionPct: number;
}

export const evaluateDay = (
  date: string,
  tracking: MealTrackingDay | undefined,
  calorieTarget: CalorieTarget
): DietAdherenceDay => {
  const mealsPlanned = tracking?.totalMeals ?? 0;
  const mealsEaten = tracking?.eatenCount ?? 0;
  const caloriesConsumed = tracking?.caloriesConsumed ?? 0;
  const planCompletionPct =
    mealsPlanned > 0 ? Math.round((mealsEaten / mealsPlanned) * 100) : 0;

  return {
    date,
    hasPlan: mealsPlanned > 0,
    mealsPlanned,
    mealsEaten,
    mealsSkipped: tracking?.skippedCount ?? 0,
    caloriesConsumed,
    calorieTarget,
    nutritionComplete: caloriesConsumed >= calorieTarget.min,
    overTarget: caloriesConsumed > calorieTarget.max,
    planFollowed:
      mealsPlanned > 0 && mealsEaten / mealsPlanned >= PLAN_FOLLOWED_THRESHOLD,
    planCompletionPct,
  };
};

export interface AdherenceSummary {
  /** Days in the window that had a plan to follow. */
  daysWithPlan: number;
  daysNutritionComplete: number;
  daysPlanFollowed: number;
  /** Average share of planned meals eaten across days that had a plan, 0–100. */
  averageCompletionPct: number;
}

export const summarise = (days: DietAdherenceDay[]): AdherenceSummary => {
  const withPlan = days.filter((d) => d.hasPlan);

  return {
    daysWithPlan: withPlan.length,
    daysNutritionComplete: days.filter((d) => d.nutritionComplete).length,
    daysPlanFollowed: days.filter((d) => d.planFollowed).length,
    averageCompletionPct:
      withPlan.length === 0
        ? 0
        : Math.round(
            withPlan.reduce((sum, d) => sum + d.planCompletionPct, 0) / withPlan.length
          ),
  };
};
