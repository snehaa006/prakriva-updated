// src/lib/recipeMacros.ts
// A FoodOScope recipe's calories and macronutrients, whichever endpoint it
// came from.
//
// FoodOScope's list endpoints each return a different slice of a recipe:
// browse and /search-recipe carry all four values ("Protein (g)", "Total lipid
// (fat) (g)", "Carbohydrate, by difference (g)"), /category names them
// "Protein", "Fat" and "Carbohydrate", the diet lists carry protein only, and
// title search, cuisine and the ingredient search carry calories alone. Reading
// one fixed field name left the Food Explorer's selection summary at 0g.

export interface RecipeMacros {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

const FIELDS: Record<keyof RecipeMacros, string[]> = {
  calories: ["Calories", "CaloriesNum"],
  protein: ["Protein (g)", "Protein"],
  carbs: ["Carbohydrate, by difference (g)", "Carbohydrate"],
  fat: ["Total lipid (fat) (g)", "Fat"],
};

/** The first field present with a usable number, under any of its names. */
function read(recipe: Record<string, unknown>, names: string[]): number | undefined {
  for (const name of names) {
    const value = recipe[name];
    if (value === undefined || value === null || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Each value the recipe actually carries; a missing one stays undefined, not 0. */
export function macrosOf(recipe: object): RecipeMacros {
  const r = recipe as Record<string, unknown>;
  return {
    calories: read(r, FIELDS.calories),
    protein: read(r, FIELDS.protein),
    carbs: read(r, FIELDS.carbs),
    fat: read(r, FIELDS.fat),
  };
}

/** True when protein, carbs and fat are all present (not merely zero by default). */
export function hasFullMacros(recipe: object): boolean {
  const { protein, carbs, fat } = macrosOf(recipe);
  return protein !== undefined && carbs !== undefined && fat !== undefined;
}

/**
 * Below this ratio of a recipe's Calories to the kcal its protein, carbs and
 * fat add up to, the macros describe the whole recipe rather than one serving.
 * FoodOScope's run 3–15× the serving's calories (its "Calories" is per serving,
 * its macros sum to "Energy (kcal)" for the whole dish); genuine per-serving
 * figures sit close to 1, so they are left alone.
 */
const WHOLE_RECIPE_RATIO = 0.8;

/**
 * Protein, carbs and fat for one serving, on the same basis as `calories`.
 *
 * Whole-recipe macros are scaled down by Calories ÷ (4·protein + 4·carbs +
 * 9·fat), which keeps their proportions and makes them add up to the serving's
 * calories. Values already per serving, or too incomplete to scale (protein
 * alone), come back unchanged.
 */
export function perServingMacros(macros: RecipeMacros): RecipeMacros {
  const { calories, protein, carbs, fat } = macros;
  if (!calories || calories <= 0 || protein === undefined || carbs === undefined || fat === undefined) {
    return macros;
  }
  const macroKcal = 4 * protein + 4 * carbs + 9 * fat;
  if (macroKcal <= 0) return macros;
  const scale = calories / macroKcal;
  if (scale >= WHOLE_RECIPE_RATIO) return macros;
  const serving = (grams: number) => Math.round(grams * scale * 10) / 10;
  return { calories, protein: serving(protein), carbs: serving(carbs), fat: serving(fat) };
}
