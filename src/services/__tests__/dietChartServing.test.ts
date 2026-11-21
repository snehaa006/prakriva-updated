import { describe, expect, it } from "vitest";
import { servingRecipe } from "@/services/dietChartService";
import type { RecipeBasic } from "@/services/foodoscopeApi";

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
