import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  /** Rows the mocked API returns, keyed by flavor category. */
  byCategory: new Map<string, Record<string, string>[]>(),
  calls: [] as string[],
  failEverything: false,
}));

vi.mock("../foodoscopeApi", () => ({
  getIngredientsByFlavor: async (category: string, page: number) => {
    state.calls.push(`${category}:${page}`);
    if (state.failEverything) throw new Error("API error: 404");

    const rows = state.byCategory.get(category);
    if (!rows) throw new Error("API error: 404");
    return { data: rows, pagination: { total: rows.length, page, pages: 1, limit: 100 } };
  },
}));

const { loadIngredientCatalog, fallbackCatalog, catalogSearchValue, groupByCategory } =
  await import("../ingredientCatalogService");
const { INGREDIENTS } = await import("@/data/ingredients");

const apiRow = (
  ingredient: string,
  generic: string,
  category: string,
  frequency: string
) => ({
  _id: ingredient,
  IngID: ingredient,
  ingredient,
  generic_name: generic,
  FlavorDB_Category: category,
  frequency,
});

beforeEach(() => {
  window.localStorage.clear();
  state.byCategory = new Map();
  state.calls = [];
  state.failEverything = false;
});

describe("loadIngredientCatalog", () => {
  it("builds the vocabulary from the API's own ingredient list", async () => {
    state.byCategory.set("Cereal", [apiRow("rice", "rice", "Cereal", "5000")]);
    state.byCategory.set("Fruit", [apiRow("guava", "guava", "Fruit", "120")]);

    const catalog = await loadIngredientCatalog();

    expect(catalog.source).toBe("api");
    const rice = catalog.ingredients.find((entry) => entry.searchTerm === "rice");
    expect(rice).toMatchObject({ label: "Rice", category: "Cereal", frequency: 5000 });
    expect(catalog.ingredients.some((entry) => entry.searchTerm === "guava")).toBe(true);
  });

  it("orders the most-used ingredients first", async () => {
    state.byCategory.set("Cereal", [
      apiRow("teff", "teff", "Cereal", "3"),
      apiRow("rice", "rice", "Cereal", "5000"),
    ]);

    const catalog = await loadIngredientCatalog();

    expect(catalog.ingredients[0].searchTerm).toBe("rice");
  });

  it("keeps the highest-frequency entry when an ingredient spans categories", async () => {
    state.byCategory.set("Fruit", [apiRow("tomato", "tomato", "Fruit", "10")]);
    state.byCategory.set("Vegetable-Fruit", [
      apiRow("tomato", "tomato", "Vegetable-Fruit", "900"),
    ]);

    const catalog = await loadIngredientCatalog();
    const tomatoes = catalog.ingredients.filter((e) => e.searchTerm === "tomato");

    expect(tomatoes).toHaveLength(1);
    expect(tomatoes[0]).toMatchObject({ category: "Vegetable-Fruit", frequency: 900 });
  });

  it("carries the local aliases onto the API entries", async () => {
    state.byCategory.set("Herb", [apiRow("fenugreek", "fenugreek", "Herb", "40")]);

    const catalog = await loadIngredientCatalog();
    const fenugreek = catalog.ingredients.find((e) => e.searchTerm === "fenugreek");

    // "methi" is only known to the local catalogue, and has to keep working.
    expect(catalogSearchValue(fenugreek!).toLowerCase()).toContain("methi");
  });

  it("still includes curated staples the API did not return", async () => {
    state.byCategory.set("Cereal", [apiRow("rice", "rice", "Cereal", "5000")]);

    const catalog = await loadIngredientCatalog();

    expect(catalog.ingredients.some((entry) => entry.searchTerm === "ghee")).toBe(true);
  });

  it("falls back to the bundled list when every category fails", async () => {
    state.failEverything = true;

    const catalog = await loadIngredientCatalog();

    expect(catalog.source).toBe("fallback");
    expect(catalog.ingredients).toHaveLength(INGREDIENTS.length);
  });

  it("serves the cached catalogue instead of re-sweeping the API", async () => {
    state.byCategory.set("Cereal", [apiRow("rice", "rice", "Cereal", "5000")]);
    await loadIngredientCatalog();
    const firstSweep = state.calls.length;

    state.calls = [];
    const second = await loadIngredientCatalog();

    expect(firstSweep).toBeGreaterThan(0);
    expect(state.calls).toHaveLength(0);
    expect(second.ingredients.length).toBeGreaterThan(0);
  });
});

describe("fallbackCatalog", () => {
  it("mirrors the bundled catalogue", () => {
    const catalog = fallbackCatalog();

    expect(catalog.source).toBe("fallback");
    expect(catalog.ingredients[0]).toHaveProperty("searchTerm");
  });
});

describe("groupByCategory", () => {
  it("groups entries and puts the biggest category first", () => {
    const groups = groupByCategory([
      { label: "Rice", searchTerm: "rice", category: "Cereal", frequency: 2, aliases: [] },
      { label: "Oat", searchTerm: "oat", category: "Cereal", frequency: 1, aliases: [] },
      { label: "Guava", searchTerm: "guava", category: "Fruit", frequency: 1, aliases: [] },
    ]);

    expect(groups[0].category).toBe("Cereal");
    expect(groups[0].options).toHaveLength(2);
  });
});
