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
