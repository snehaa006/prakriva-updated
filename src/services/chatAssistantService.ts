// src/services/chatAssistantService.ts
// Assembles a patient's own data (profile, active diet plan, pantry, tracking
// history, screenings) into the context the chatbot sends to Gemini, and
// grounds recipe questions in real FoodOScope dishes matched to her pantry.
//
// Every read here is already scoped by Supabase RLS to the signed-in
// patient's own rows (or, for a treating doctor, `doctor_treats()`), so the
// context this builds can safely be handed to the stateless `/assistant/chat`
// backend endpoint the same way `askAssistant`'s `screenings` are.

import { supabase } from "@/lib/supabase";
import {
  fetchPantryItems,
  pantryIngredientNames,
  type PantryItem,
} from "@/services/pantryService";
import { fetchMealTracking } from "@/services/mealAdherenceService";
import { fetchLifestyleLogs } from "@/services/lifestyleLogService";
import { fetchScreenings } from "@/services/diseaseDetectionService";
import { fetchMealFeedback } from "@/services/mealFeedbackService";
import {
  getIngredientsByFlavor,
  getRecipesByIngredientsCategoriesTitle,
  type RecipeBasic,
} from "@/services/foodoscopeApi";

const DAYS_OF_HISTORY = 14;

// --- Types sent to the backend (mirrors gemini_service.py's formatters) ---

export interface PatientProfileContext {
  lifeStage?: string;
  trimester?: string;
  dietaryPreference?: string;
  allergies?: string[];
  primaryDosha?: string;
}

export interface CondensedMeal {
  label: string;
  food: string;
  calories?: number;
  time?: string;
}

export interface CondensedDay {
  day: string;
  meals: CondensedMeal[];
}

export interface CondensedActivePlan {
  durationLabel: string;
  days: CondensedDay[];
}

export interface MealFeedbackEntry {
  date: string;
  mealName: string;
  digestion: number | null;
  mood: number | null;
  energy: number | null;
  notes: string;
}

export interface RecipeCandidate {
  title: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  cookTime?: string;
  region?: string;
  recipeId: string;
}

export interface PatientChatContext {
  profile: PatientProfileContext;
  activePlan: CondensedActivePlan | null;
  pantry: { atHome: string[]; toBuy: string[] };
  mealAdherence: {
    days: { date: string; eatenCount: number; totalMeals: number; caloriesConsumed: number }[];
  };
  mealFeedback: MealFeedbackEntry[];
  lifestyle: {
    days: {
      date: string;
      sleepHours: number | null;
      sleepQuality: string | null;
      waterGlasses: number;
      waterGoal: number;
      activityMinutes: Record<string, number>;
    }[];
  };
  screenings: {
    date: string;
    overallRisk: string;
    conditions: { label: string; riskLevel: string; score: number }[];
  }[];
  recipeCandidates?: RecipeCandidate[];
}

const isoDateNDaysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// --- Profile (patients.assessment_data is free-form jsonb, read defensively) ---

async function fetchProfileContext(patientId: string): Promise<PatientProfileContext> {
  const { data, error } = await supabase
    .from("patients")
    .select("assessment_data")
    .eq("id", patientId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const a = (data?.assessment_data as Record<string, unknown> | null) ?? {};
  const allergies = Array.isArray(a.allergies)
    ? (a.allergies as unknown[]).filter(
        (x): x is string => typeof x === "string" && x.toLowerCase() !== "none"
      )
    : undefined;

  return {
    lifeStage: typeof a.lifeStage === "string" ? a.lifeStage : undefined,
    trimester: typeof a.pregnancyTrimester === "string" ? a.pregnancyTrimester : undefined,
    dietaryPreference: typeof a.dietaryPreferences === "string" ? a.dietaryPreferences : undefined,
    allergies: allergies && allergies.length > 0 ? allergies : undefined,
  };
}

// --- Active diet plan, condensed from the loosely-shaped `meals` jsonb ---

export interface DietPlanRow {
  plan_duration: string | null;
  active_filter: string | null;
  meals: unknown;
  primary_dosha: string | null;
  status: string | null;
  created_at: string;
}

/** One meal-type's entries, e.g. `meals.Daily.Breakfast`, tolerating whatever
 * shape a given entry happens to be in — this jsonb has grown organically
 * across plan sources and is not uniformly typed. */
function condenseMealEntries(entries: unknown, fallbackLabel: string): CondensedMeal[] {
  if (!Array.isArray(entries)) return [];
  const out: CondensedMeal[] = [];
  for (const raw of entries) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const food = typeof e.Food_Item === "string" ? e.Food_Item : null;
    if (!food) continue;
    const calories = Number(e.Calories);
    out.push({
      label: typeof e.label === "string" ? e.label : fallbackLabel,
      food,
      calories: Number.isFinite(calories) && calories > 0 ? Math.round(calories) : undefined,
      time: typeof e.time === "string" ? e.time : undefined,
    });
  }
  return out;
}

function condenseDayMeals(dayMealsByType: unknown): CondensedMeal[] {
  if (!dayMealsByType || typeof dayMealsByType !== "object") return [];
  return Object.entries(dayMealsByType as Record<string, unknown>).flatMap(([mealType, entries]) =>
    condenseMealEntries(entries, mealType)
  );
}

// Exported for testing — the shape of `diet_plans.meals` is loosely typed
// jsonb that has grown organically across plan sources, so this defensive
// condensing logic is worth exercising directly against messy real examples.
export function condenseActivePlan(row: DietPlanRow | undefined): CondensedActivePlan | null {
  if (!row?.meals || typeof row.meals !== "object") return null;
  const meals = row.meals as Record<string, unknown>;
  const durationLabel = row.plan_duration || row.active_filter || "duration unknown";

  // Prefer the single-day "Daily" template — compact, and what the patient's
  // own pages treat as the current plan. Weekly is a fallback for older plans
  // that only ever set the day-by-day breakdown.
  const dailyMeals = condenseDayMeals(meals.Daily);
  if (dailyMeals.length > 0) {
    return { durationLabel, days: [{ day: "Typical day", meals: dailyMeals }] };
  }

  const weekly = meals.Weekly;
  if (weekly && typeof weekly === "object") {
    const days = Object.entries(weekly as Record<string, unknown>)
      .slice(0, 7)
      .map(([day, dayMealsByType]) => ({ day, meals: condenseDayMeals(dayMealsByType) }))
      .filter((d) => d.meals.length > 0);
    if (days.length > 0) return { durationLabel, days };
  }

  return null;
}

async function fetchActivePlanContext(
  patientId: string
): Promise<{ plan: CondensedActivePlan | null; primaryDosha?: string }> {
  const { data, error } = await supabase
    .from("diet_plans")
    .select("plan_duration, active_filter, meals, primary_dosha, status, created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as DietPlanRow[];
  const chosen = rows.find((r) => r.status === "active") ?? rows[0];
  return { plan: condenseActivePlan(chosen), primaryDosha: chosen?.primary_dosha ?? undefined };
}

// --- Meal feedback ---
// The rows themselves come from `mealFeedbackService`, which the doctor-side
// Recipe Builder reads too; this only condenses them for the prompt.

async function fetchRecentMealFeedback(patientId: string): Promise<MealFeedbackEntry[]> {
  const entries = await fetchMealFeedback(patientId, 10);
  return entries.map((entry) => ({
    date: entry.date,
    mealName: entry.mealName,
    digestion: entry.digestion,
    mood: entry.mood,
    energy: entry.energy,
    notes: entry.notes,
  }));
}

// --- Put it all together ---

/**
 * Everything the chatbot needs about this patient, gathered in parallel.
 * Any single source failing (a missing table, a network blip) degrades that
 * section to empty rather than failing the whole chat — matching how the
 * rest of the app treats these same tables.
 */
export const fetchPatientChatContext = async (patientId: string): Promise<PatientChatContext> => {
  const [profileRes, planRes, pantryRes, adherenceRes, feedbackRes, lifestyleRes, screeningsRes] =
    await Promise.allSettled([
      fetchProfileContext(patientId),
      fetchActivePlanContext(patientId),
      fetchPantryItems(patientId),
      fetchMealTracking(patientId, isoDateNDaysAgo(DAYS_OF_HISTORY)),
      fetchRecentMealFeedback(patientId),
      fetchLifestyleLogs(patientId, DAYS_OF_HISTORY),
      fetchScreenings(patientId),
    ]);

  for (const result of [profileRes, planRes, pantryRes, adherenceRes, feedbackRes, lifestyleRes, screeningsRes]) {
    if (result.status === "rejected") {
      console.error("Chat context: one data source failed to load, continuing without it:", result.reason);
    }
  }

  const profile = profileRes.status === "fulfilled" ? profileRes.value : {};
  const planInfo = planRes.status === "fulfilled" ? planRes.value : { plan: null, primaryDosha: undefined };
  const pantryItems: PantryItem[] = pantryRes.status === "fulfilled" ? pantryRes.value : [];
  const adherenceDays = adherenceRes.status === "fulfilled" ? adherenceRes.value : [];
  const feedback = feedbackRes.status === "fulfilled" ? feedbackRes.value : [];
  const lifestyleDays = lifestyleRes.status === "fulfilled" ? lifestyleRes.value : [];
  const screenings = screeningsRes.status === "fulfilled" ? screeningsRes.value : [];

  return {
    profile: { ...profile, primaryDosha: profile.primaryDosha ?? planInfo.primaryDosha },
    activePlan: planInfo.plan,
    pantry: {
      atHome: pantryIngredientNames(pantryItems, "at_home"),
      toBuy: pantryIngredientNames(pantryItems, "to_buy"),
    },
    mealAdherence: {
      days: adherenceDays.map((d) => ({
        date: d.date,
        eatenCount: d.eatenCount,
        totalMeals: d.totalMeals,
        caloriesConsumed: d.caloriesConsumed,
      })),
    },
    mealFeedback: feedback,
    lifestyle: {
      days: lifestyleDays.map((d) => ({
        date: d.date,
        sleepHours: d.sleepHours,
        sleepQuality: d.sleepQuality,
        waterGlasses: d.waterGlasses,
        waterGoal: d.waterGoal,
        activityMinutes: d.activityMinutes,
      })),
    },
    // Newest-first from fetchScreenings; the last few, oldest first, reads as
    // a trend rather than a reverse-chronological dump.
    screenings: screenings
      .slice(0, 6)
      .reverse()
      .map((s) => ({
        date: s.createdAt.slice(0, 10),
        overallRisk: s.result.overall_risk_level,
        conditions: s.result.conditions.slice(0, 4).map((c) => ({
          label: c.label,
          riskLevel: c.risk_level,
          score: c.score,
        })),
      })),
  };
};

// --- Recipe grounding: only when the message actually sounds food-related ---

const RECIPE_INTENT_RE =
  /\b(recipe|cook|craving|crave|hungry|snack|dish|what (should|can) i (eat|cook|make)|make (for|me) (dinner|lunch|breakfast))\b/i;
const FLAVOR_RE = /\b(sweet|spicy|salty|sour|bitter|savoury|savory|tangy)\b/i;

/** Whether `message` sounds like it's asking for food/a recipe. Exported so
 * the chat UI can decide whether it's worth the extra FoodOScope round trip. */
export const looksLikeRecipeRequest = (message: string): boolean => RECIPE_INTENT_RE.test(message);

const DIET_FIELD_BY_PREFERENCE: Record<string, keyof RecipeBasic> = {
  vegetarian: "ovo_lacto_vegetarian",
  vegan: "vegan",
  pescatarian: "pescetarian",
  "lacto-vegetarian": "lacto_vegetarian",
};

const numberOrUndefined = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
};

const toRecipeCandidate = (recipe: RecipeBasic): RecipeCandidate => ({
  title: recipe.Recipe_title,
  calories: numberOrUndefined(recipe.Calories || recipe["Energy (kcal)"]),
  protein: numberOrUndefined(recipe["Protein (g)"]),
  carbs: numberOrUndefined(recipe["Carbohydrate, by difference (g)"]),
  fat: numberOrUndefined(recipe["Total lipid (fat) (g)"]),
  cookTime: recipe.cook_time || recipe.total_time || undefined,
  region: recipe.Region || undefined,
  recipeId: recipe.Recipe_id,
});

/**
 * Real FoodOScope dishes to ground a recipe answer in, preferring her pantry.
 *
 * A flavour word ("something sweet") first narrows FoodOScope's flavour
 * ingredient list, intersected with what she actually has at home; that
 * overlap becomes the ingredient filter. Never throws — a failed lookup just
 * means the chat answers from pantry/plan context alone, same as any other
 * degraded-gracefully data source in this app.
 */
export const maybeFetchRecipeCandidates = async (
  message: string,
  pantryAtHome: string[],
  dietaryPreference?: string
): Promise<RecipeCandidate[]> => {
  if (!looksLikeRecipeRequest(message) || pantryAtHome.length === 0) return [];

  try {
    let includeIngredients = pantryAtHome.slice(0, 8);

    const flavorMatch = message.match(FLAVOR_RE);
    if (flavorMatch) {
      try {
        const { data } = await getIngredientsByFlavor(flavorMatch[0].toLowerCase(), 1, 40);
        const flavorTerms = data.map((f) => f.ingredient.toLowerCase());
        const overlap = pantryAtHome.filter((p) =>
          flavorTerms.some((f) => f.includes(p) || p.includes(f))
        );
        if (overlap.length > 0) includeIngredients = overlap.slice(0, 6);
      } catch {
        // Flavour lookup is a nicety — fall back to plain pantry matching.
      }
    }

    let recipes = await getRecipesByIngredientsCategoriesTitle({
      includeIngredients: includeIngredients.join(","),
      limit: 10,
    });

    const dietField = dietaryPreference && DIET_FIELD_BY_PREFERENCE[dietaryPreference.toLowerCase()];
    if (dietField) {
      const filtered = recipes.filter((r) => r[dietField] === "1");
      if (filtered.length > 0) recipes = filtered;
    }

    return recipes.slice(0, 5).map(toRecipeCandidate);
  } catch (error) {
    console.error("Recipe candidate lookup failed; the chat will answer without grounding:", error);
    return [];
  }
};
