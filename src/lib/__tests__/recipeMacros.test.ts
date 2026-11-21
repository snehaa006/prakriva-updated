import { describe, expect, it } from "vitest";
import { hasFullMacros, macrosOf, perServingMacros } from "@/lib/recipeMacros";

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

describe("perServingMacros", () => {
  // Egyptian Lentil Soup as FoodOScope returns it: 196 kcal per serving, but
  // macros for the whole pot (they add up to ~836 kcal).
  const LENTIL_SOUP = { calories: 196, protein: 49.554, carbs: 146.7606, fat: 5.6564 };

  it("scales whole-dish macros to the serving its calories describe", () => {
    const serving = perServingMacros(LENTIL_SOUP);
    expect(serving).toEqual({ calories: 196, protein: 11.6, carbs: 34.4, fat: 1.3 });
    const kcal = 4 * serving.protein! + 4 * serving.carbs! + 9 * serving.fat!;
    expect(Math.abs(kcal - 196)).toBeLessThan(2);
  });

  it("leaves figures that are already per serving alone", () => {
    const palakPaneer = { calories: 517, protein: 25.3, carbs: 42.1, fat: 27.5 };
    expect(perServingMacros(palakPaneer)).toBe(palakPaneer);
  });

  it("is stable when applied twice", () => {
    const once = perServingMacros(LENTIL_SOUP);
    expect(perServingMacros(once)).toEqual(once);
  });

  it("cannot scale an incomplete set, so returns it unchanged", () => {
    const proteinOnly = { calories: 45, protein: 26.18 };
    expect(perServingMacros(proteinOnly)).toBe(proteinOnly);
  });
});
