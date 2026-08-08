import { describe, expect, it } from "vitest";
import {
  INGREDIENTS,
  INGREDIENT_CATEGORIES,
  findIngredient,
  ingredientSearchValue,
  ingredientsByCategory,
} from "../ingredients";

describe("ingredient catalogue", () => {
  it("has no duplicate labels", () => {
    const labels = INGREDIENTS.map((option) => option.label.toLowerCase());

    expect(new Set(labels).size).toBe(labels.length);
  });

  it("only uses declared categories", () => {
    const known = new Set<string>(INGREDIENT_CATEGORIES);

    for (const option of INGREDIENTS) {
      expect(known.has(option.category)).toBe(true);
    }
  });

  it("keeps every search term lowercase, so it round-trips to the recipe API", () => {
    for (const option of INGREDIENTS) {
      expect(option.searchTerm).toBe(option.searchTerm.toLowerCase().trim());
      expect(option.searchTerm.length).toBeGreaterThan(0);
    }
  });

  it("groups every ingredient exactly once", () => {
    const grouped = ingredientsByCategory().flatMap((group) => group.options);

    expect(grouped).toHaveLength(INGREDIENTS.length);
  });
});

describe("findIngredient", () => {
  it("matches a label regardless of case and padding", () => {
    expect(findIngredient("  brown RICE  ")?.searchTerm).toBe("rice");
  });

  it("returns undefined for something not in the catalogue", () => {
    expect(findIngredient("ALL Kinds Of Fruits")).toBeUndefined();
  });
});

describe("ingredientSearchValue", () => {
  it("includes the aliases so a local name finds the entry", () => {
    const methi = findIngredient("Fenugreek leaves (methi)");
    const haystack = ingredientSearchValue(methi!).toLowerCase();

    expect(haystack).toContain("methi");
    expect(haystack).toContain("vegetables");
  });
});
