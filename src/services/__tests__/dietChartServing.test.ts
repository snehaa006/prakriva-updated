import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/foodoscopeApi", async () => {
  const actual = await vi.importActual<typeof import("@/services/foodoscopeApi")>(
    "@/services/foodoscopeApi"
  );
  return { ...actual, searchRecipeById: vi.fn() };
});

import {
  applyBoardNutrientFixes,
  findBoardNutrientFixes,
  servingRecipe,
} from "@/services/dietChartService";
import { searchRecipeById, type RecipeBasic } from "@/services/foodoscopeApi";

/**
 * The fallback chart's meals as the doctor's board shows them. FoodOScope's
 * "Calories" is per serving while its macros are for the whole dish; the board
 * printed "533.0 cal • 50.9956g protein • 0g fat • 0g carbs".
 */
const recipe = (fields: Record<string, string>) =>
  ({ Recipe_id: "1", Recipe_title: "Test", ...fields }) as unknown as RecipeBasic;

describe("servingRecipe", () => {
  it("puts a full record's macros on a per-serving basis, rounded", () => {
    const meal = servingRecipe(
      recipe({
        Calories: "196.0",
        "Energy (kcal)": "805.6975",
        "Protein (g)": "49.554",
        "Carbohydrate, by difference (g)": "146.7606",
        "Total lipid (fat) (g)": "5.6564",
      })
    );
    expect(meal["Protein (g)"]).toBe("11.6");
    expect(meal["Carbohydrate, by difference (g)"]).toBe("34.4");
    expect(meal["Total lipid (fat) (g)"]).toBe("1.3");
    expect(meal["Energy (kcal)"]).toBe("196.0");
  });

  it("estimates all three from calories when a list gave protein alone", () => {
    // The diet lists' shape: the protein is the whole dish's, so it is not kept.
    const meal = servingRecipe(recipe({ Calories: "400", "Protein (g)": "50.9956" }));
    expect(meal["Protein (g)"]).toBe("20");
    expect(meal["Carbohydrate, by difference (g)"]).toBe("50");
    expect(meal["Total lipid (fat) (g)"]).toBe("13.3");
  });

  it("never leaves fat or carbs at 0 when calories are known", () => {
    const meal = servingRecipe(recipe({ Calories: "263.0", "Protein (g)": "53.2941" }));
    expect(Number(meal["Total lipid (fat) (g)"])).toBeGreaterThan(0);
    expect(Number(meal["Carbohydrate, by difference (g)"])).toBeGreaterThan(0);
  });
});

describe("repairing a saved board", () => {
  // Boards stay in the browser across refreshes, so one generated before the
  // per-serving fix kept showing "533 cal • 51g protein • 0g fat • 0g carbs".
  const emptyDay = () => ({ Breakfast: [], Lunch: [], Dinner: [], Snack: [] });
  const board = (dinner: Record<string, unknown>[]) => ({
    Daily: { ...emptyDay(), Dinner: dinner },
    Weekly: { Monday: { ...emptyDay(), Dinner: dinner } },
  });

  beforeEach(() => {
    vi.mocked(searchRecipeById).mockReset();
  });

  it("fills an item saved with fat and carbs missing from its full record, per serving", async () => {
    vi.mocked(searchRecipeById).mockResolvedValue({
      recipe: {
        Recipe_id: "4510",
        Calories: "196.0",
        "Protein (g)": "49.554",
        "Carbohydrate, by difference (g)": "146.7606",
        "Total lipid (fat) (g)": "5.6564",
      } as unknown as RecipeBasic,
      ingredients: [],
    });
    const plans = board([{ Food_Item: "Soup", Recipe_id: "4510", Calories: "196.0", Protein: "49.554", Fat: "0", Carbs: "0" }]);

    const fixes = await findBoardNutrientFixes(plans);
    const fixed = applyBoardNutrientFixes(plans, fixes);

    expect(fixed.Weekly.Monday.Dinner[0]).toMatchObject({ Protein: "11.6", Carbs: "34.4", Fat: "1.3" });
    expect(fixed.Daily.Dinner[0]).toMatchObject({ Protein: "11.6", Carbs: "34.4", Fat: "1.3" });
    expect(searchRecipeById).toHaveBeenCalledTimes(1); // once per distinct recipe
  });

  it("scales a complete whole-dish item locally, with no request", async () => {
    const plans = board([
      { Food_Item: "Soup", Recipe_id: "2610", Calories: "196", Protein: "49.554", Carbs: "146.7606", Fat: "5.6564" },
    ]);
    const fixes = await findBoardNutrientFixes(plans);
    expect(applyBoardNutrientFixes(plans, fixes).Daily.Dinner[0]).toMatchObject({
      Protein: "11.6", Carbs: "34.4", Fat: "1.3",
    });
    expect(searchRecipeById).not.toHaveBeenCalled();
  });

  it("leaves correct items and the app's own foods alone", async () => {
    const plans = board([
      { Food_Item: "Palak Paneer", Recipe_id: "77", Calories: "517", Protein: "25.3", Carbs: "42.1", Fat: "27.5" },
      { Food_Item: "Rice", id: "Rice-12", Calories: 130, Protein: 0, Carbs: 0, Fat: 0 },
    ]);
    const fixes = await findBoardNutrientFixes(plans);
    expect(fixes.size).toBe(0);
    expect(applyBoardNutrientFixes(plans, fixes)).toBe(plans);
  });
});
