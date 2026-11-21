import { describe, expect, it } from "vitest";
import { hasFullMacros, macrosOf } from "@/lib/recipeMacros";

// Field names and values as FoodOScope's live endpoints return them
// (recorded November 2026). Each list carries a different slice.
const BROWSE = {
  Recipe_id: "2610",
  Calories: "196.0",
  "Carbohydrate, by difference (g)": "146.7606",
  "Energy (kcal)": "805.6975",
  "Protein (g)": "49.554",
  "Total lipid (fat) (g)": "5.6564",
  CaloriesNum: 196,
};
const CATEGORY = { Calories: "272.8", Carbohydrate: "44.9113", Energy: "1245.2023", Protein: "99.6934", Fat: "73.941" };
const DIET = { Calories: "45.0", "Protein (g)": "26.18" };
const TITLE_SEARCH = { Calories: "275.0" };

describe("macrosOf", () => {
  it("reads the browse / search-recipe field names", () => {
    expect(macrosOf(BROWSE)).toEqual({ calories: 196, protein: 49.554, carbs: 146.7606, fat: 5.6564 });
  });

  it("reads the category endpoint's short names", () => {
    expect(macrosOf(CATEGORY)).toEqual({ calories: 272.8, protein: 99.6934, carbs: 44.9113, fat: 73.941 });
  });

  it("leaves what a list does not carry undefined rather than 0", () => {
    expect(macrosOf(DIET)).toEqual({ calories: 45, protein: 26.18, carbs: undefined, fat: undefined });
    expect(macrosOf(TITLE_SEARCH)).toEqual({
      calories: 275, protein: undefined, carbs: undefined, fat: undefined,
    });
  });

  it("keeps a real zero, and skips blanks and non-numbers", () => {
    expect(macrosOf({ "Protein (g)": "0", Fat: "", "Total lipid (fat) (g)": "n/a", Carbohydrate: 3 })).toEqual({
      calories: undefined, protein: 0, carbs: 3, fat: undefined,
    });
  });
});

describe("hasFullMacros", () => {
  it("is true only when protein, carbs and fat are all present", () => {
    expect(hasFullMacros(BROWSE)).toBe(true);
    expect(hasFullMacros(CATEGORY)).toBe(true);
    expect(hasFullMacros(DIET)).toBe(false);
    expect(hasFullMacros(TITLE_SEARCH)).toBe(false);
  });
});
