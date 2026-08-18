// Shared vocabulary for a patient's diet plan.
//
// The dashboard, the meal-logging page and the plan builder each used to carry
// their own copy of these types and their own converter from a stored plan to
// "today's meals" — three near-identical implementations that had already
// drifted (one keyed statuses by `plan_N`, another by a bare counter, so a meal
// marked eaten on one page came back pending on the other). One definition,
// used by every surface, is what makes the merged tabs agree with each other.

import type { RecipeBasic } from "@/services/foodoscopeApi";
import { Sun, Utensils, Coffee, Moon } from "lucide-react";

export type MealType = "breakfast" | "lunch" | "snack" | "dinner";
export type MealStatus = "eaten" | "skipped" | "pending";

export interface TrackedMeal {
  id: string;
  name: string;
  type: MealType;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  status: MealStatus;
  recipeId?: string;
  region?: string;
  cookTime?: string;
  dayLabel?: string;
  /** Ayurvedic detail, present on doctor-authored plans. */
  quantity?: string;
  preparation?: string;
  benefits?: string;
  doshaBalance?: string;
}

export interface DietPlanDoc {
  id: string;
  patientName: string;
  planDuration: string;
  planType: string;
  meals: any;
  days?: any[];
  createdAt: string;
  totalMeals: number;
  activeFilter?: string;
  source?: string;
}

export interface PlanFilters {
  region: string;
  dietType: string;
  minCalories: number;
  maxCalories: number;
  minProtein: number;
  maxProtein: number;
  cookTime: string;
  excludeIngredients: string;
  mealTypes: string[];
}

export const DEFAULT_FILTERS: PlanFilters = {
  region: "",
  dietType: "",
  minCalories: 200,
  maxCalories: 600,
  minProtein: 5,
  maxProtein: 40,
  cookTime: "any",
  excludeIngredients: "",
  mealTypes: ["breakfast", "lunch", "snack", "dinner"],
};

export const REGIONS = [
  "Indian", "South Indian", "Italian", "Chinese", "Mexican",
  "Middle Eastern", "Japanese", "Thai", "French", "Mediterranean",
  "American", "Korean", "Vietnamese", "Greek", "Spanish",
];

export const DIET_TYPES = [
  { value: "", label: "Any" },
  { value: "ovo_lacto_vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescetarian", label: "Pescatarian" },
  { value: "lacto_vegetarian", label: "Lacto-Vegetarian" },
];

export const MEAL_SLOTS = [
  { type: "breakfast" as const, label: "Breakfast", time: "8:00 AM", icon: Sun },
  { type: "lunch" as const, label: "Lunch", time: "12:30 PM", icon: Utensils },
  { type: "snack" as const, label: "Snack", time: "4:00 PM", icon: Coffee },
  { type: "dinner" as const, label: "Dinner", time: "7:30 PM", icon: Moon },
];

export function slotFor(type: MealType) {
  return MEAL_SLOTS.find((s) => s.type === type) ?? MEAL_SLOTS[0];
}

export const TRACKING_STORAGE_KEY = "nourish_meal_tracking";

/** Which plan the patient is currently following, per account. */
export const activePlanStorageKey = (userId: string) => `nourish_active_plan_${userId}`;

export const dayKey = (d = new Date()) => d.toISOString().split("T")[0];

/**
 * Some recipes come back with calories but no macro split. Rather than showing
 * three zeroes, derive a conventional 20/50/30 split so the nutrition figures
 * on the meal row stay meaningful.
 */
export function ensureMacros(r: RecipeBasic) {
  const cal = Number(r.Calories || r["Energy (kcal)"] || 0);
  const p = Number(r["Protein (g)"] || 0);
  const c = Number(r["Carbohydrate, by difference (g)"] || 0);
  const f = Number(r["Total lipid (fat) (g)"] || 0);
  if (!p && !c && !f && cal > 0) {
    return {
      ...r,
      "Protein (g)": String(Math.round((cal * 0.2) / 4)),
      "Carbohydrate, by difference (g)": String(Math.round((cal * 0.5) / 4)),
      "Total lipid (fat) (g)": String(Math.round((cal * 0.3) / 9)),
    };
  }
  return r;
}

export function recipeToMeal(recipe: RecipeBasic, type: MealType): TrackedMeal {
  const r = ensureMacros(recipe);
  const slot = slotFor(type);
  return {
    id: `${type}_${r.Recipe_id}_${Date.now()}`,
    name: r.Recipe_title,
    type,
    time: slot.time,
    calories: Math.round(Number(r.Calories || r["Energy (kcal)"] || 0)),
    protein: Math.round(Number(r["Protein (g)"] || 0)),
    carbs: Math.round(Number(r["Carbohydrate, by difference (g)"] || 0)),
    fat: Math.round(Number(r["Total lipid (fat) (g)"] || 0)),
    status: "pending",
    recipeId: r.Recipe_id,
    region: r.Region || "",
    cookTime: r.cook_time || r.total_time?.toString() || "",
  };
}

function normaliseMealType(raw: string): MealType {
  const s = raw.toLowerCase();
  if (s.includes("breakfast") || s.includes("early morning")) return "breakfast";
  if (s.includes("lunch")) return "lunch";
  if (s.includes("dinner") || s.includes("before bed")) return "dinner";
  return "snack";
}

/**
 * Turn a stored plan into the list of meals for today.
 *
 * Two storage shapes exist in the wild and both are still in `diet_plans`:
 * `days[]` from the doctor's personalised generator, and the flat
 * `meals.Daily` map from the manual builder. Ids are `plan_1`, `plan_2`, … in
 * document order — stable for a given plan, which is what lets a status saved
 * this morning be read back this evening.
 */
export function planToTodaysMeals(plan: DietPlanDoc | null): TrackedMeal[] {
  if (!plan) return [];

  const meals: TrackedMeal[] = [];
  let counter = 1;

  const days = plan.days ?? plan.meals?.days;
  if (Array.isArray(days) && days.length > 0) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = dayNames[new Date().getDay()].toLowerCase();
    const today =
      days.find((d: any) => d.dayLabel?.toLowerCase().includes(todayName)) ?? days[0];

    for (const meal of today?.meals ?? []) {
      const type = normaliseMealType(meal.mealType ?? "");
      meals.push({
        id: `plan_${counter++}`,
        name: meal.recipeName || "Unnamed recipe",
        type,
        time: meal.time || slotFor(type).time,
        calories: Math.round(meal.calories || meal.actualCalories || 0),
        protein: Math.round(meal.protein || 0),
        carbs: Math.round(meal.carbs || 0),
        fat: Math.round(meal.fat || 0),
        status: "pending",
        recipeId: meal.recipeId || "",
        region: meal.region || "",
        cookTime: meal.cookTime || "",
        dayLabel: today?.dayLabel,
        quantity: meal.quantity,
        preparation: meal.preparation,
        benefits: meal.benefits,
      });
    }
    return meals;
  }

  for (const [slotName, foods] of Object.entries(plan.meals?.Daily ?? {})) {
    if (!Array.isArray(foods)) continue;
    const type = normaliseMealType(slotName);
    for (const food of foods as any[]) {
      meals.push({
        id: `plan_${counter++}`,
        name: food.Food_Item || "Unknown",
        type,
        time: slotFor(type).time,
        calories: Math.round(Number(food.Calories || 0)),
        protein: Math.round(Number(food.Protein || 0)),
        carbs: Math.round(Number(food.Carbs || 0)),
        fat: Math.round(Number(food.Fat || 0)),
        status: "pending",
        recipeId: food.Recipe_id || "",
        region: food.Region || "",
        cookTime: food.cook_time || "",
        quantity: food.quantity,
        preparation: food.preparation,
        benefits: food.benefits,
        doshaBalance:
          food.Dosha_Vata === "Pacifying" ? "Vata balancing"
          : food.Dosha_Pitta === "Pacifying" ? "Pitta balancing"
          : food.Dosha_Kapha === "Pacifying" ? "Kapha balancing"
          : undefined,
      });
    }
  }

  return meals;
}

export interface TodayStats {
  total: number;
  eaten: number;
  skipped: number;
  pending: number;
  totalCalories: number;
  caloriesConsumed: number;
  proteinConsumed: number;
  completionPct: number;
}

export function summarise(meals: TrackedMeal[]): TodayStats {
  const eaten = meals.filter((m) => m.status === "eaten");
  return {
    total: meals.length,
    eaten: eaten.length,
    skipped: meals.filter((m) => m.status === "skipped").length,
    pending: meals.filter((m) => m.status === "pending").length,
    totalCalories: meals.reduce((s, m) => s + m.calories, 0),
    caloriesConsumed: eaten.reduce((s, m) => s + m.calories, 0),
    proteinConsumed: eaten.reduce((s, m) => s + m.protein, 0),
    completionPct: meals.length > 0 ? Math.round((eaten.length / meals.length) * 100) : 0,
  };
}

/** How a plan should be described in a list — doctor's, self-made, or neither. */
export function describePlanSource(plan: DietPlanDoc): string {
  if (plan.source === "patient-self-service") return "Self-created plan";
  if (plan.source === "personalized-diet-chart") return "Doctor's plan";
  return plan.planType || "Diet plan";
}
