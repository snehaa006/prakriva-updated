import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every FoodOScope reader against a reply recorded from the live API
 * (November 2026), trimmed to its structure in `fixtures/foodoscope/`.
 *
 * FoodOScope has reshaped its replies more than once — `payload` wrappers,
 * page counts under `pagination`, then `meta` — and each reshuffle broke a
 * different screen. If it changes again, re-record the replies and these tests
 * show which readers need to follow. Every live reply has this shape:
 *
 *   { success, message, data, meta: { page, limit, total, totalPages } }
 */

vi.mock("@/lib/supabase", () => {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  query.select = chain;
  query.eq = chain;
  query.order = chain;
  query.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: [{ api_key: "working-key" }], error: null });
  return { supabase: { from: () => query } };
});

import * as api from "../foodoscopeApi";

const recorded = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, "fixtures", "foodoscope", `${name}.json`), "utf8"));

let fetchMock: ReturnType<typeof vi.fn>;
let sentUrls: string[];

/** Answer the next request with the recorded reply `name`. */
const serve = (name: string) => {
  fetchMock.mockImplementation(async (url: string) => {
    sentUrls.push(url);
    return { ok: true, status: 200, statusText: "OK", json: async () => recorded(name) };
  });
};

beforeEach(() => {
  sentUrls = [];
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The page counts every screen reads must all come from the reply's `meta`. */
const expectPageInfoFromMeta = (pagination: api.PageInfo, name: string) => {
  const { meta } = recorded(name);
  expect(pagination).toMatchObject({
    total: meta.total,
    totalCount: meta.total,
    totalResults: meta.total,
    totalRecipes: meta.total,
    totalPages: meta.totalPages,
    pages: meta.totalPages,
    currentPage: meta.page,
    page: meta.page,
    limit: meta.limit,
  });
};

// [reader, recorded reply, call]
const PAGED: Array<[string, string, () => Promise<{ data: unknown[]; pagination: api.PageInfo }>]> = [
  ["getRecipesInfo", "recipesinfo", () => api.getRecipesInfo(1, 2)],
  ["getNutritionInfo", "nutritioninfo", () => api.getNutritionInfo(1, 2)],
  ["getMicronutritionInfo", "micronutritioninfo", () => api.getMicronutritionInfo(1, 2)],
  ["getRecipesByRange", "range", () => api.getRecipesByRange("total_time", 10, 30, 1, 2)],
  ["getRecipesByCuisine", "cuisine", () => api.getRecipesByCuisine("Indian Subcontinent", 1, 2)],
  ["getRecipesByCalories", "calories", () => api.getRecipesByCalories(100, 300, 2, 1)],
  ["getRecipesByRegionAndDiet", "region_diet", () => api.getRecipesByRegionAndDiet("Indian Subcontinent", "vegan", 2, 1)],
  ["getRecipesByDiet", "diet", () => api.getRecipesByDiet("vegan", 2, 1)],
  ["getRecipesByCarbs", "carbs", () => api.getRecipesByCarbs(10, 50, 2, 1)],
  ["getIngredientsByFlavor", "flavor", () => api.getIngredientsByFlavor("Vegetable-Root", 1, 2)],
  ["getRecipesByUtensils", "utensils", () => api.getRecipesByUtensils("pan", 1, 2)],
  ["getRecipesByCookingMethod", "method", () => api.getRecipesByCookingMethod("bake", 1)],
  ["getRecipesByEnergy", "energy", () => api.getRecipesByEnergy(100, 300, 1, 2)],
  ["getRecipesByProtein", "protein", () => api.getRecipesByProtein(10, 20, 1, 2)],
];

describe.each(PAGED)("%s", (_reader, name, call) => {
  it("returns the reply's list with page counts from its meta", async () => {
    serve(name);
    const { data, pagination } = await call();
    expect(data).toEqual(recorded(name).data);
    expect(data.length).toBeGreaterThan(0);
    expectPageInfoFromMeta(pagination, name);
  });
});

const LISTS: Array<[string, string, () => Promise<unknown[]>]> = [
  ["getRecipeByTitle", "bytitle", () => api.getRecipeByTitle("pasta")],
  ["getRecipeDayByCategory", "recipe_day_category", () => api.getRecipeDayByCategory(undefined, 1, 2)],
  ["getRecipesByCategory", "category", () => api.getRecipesByCategory("Vegetable", undefined, 1, 2)],
  [
    "getRecipesByIngredientsCategoriesTitle",
    "by_ingredients",
    () => api.getRecipesByIngredientsCategoriesTitle({ includeIngredients: "rice", limit: 2 }),
  ],
];

describe.each(LISTS)("%s", (_reader, name, call) => {
  it("returns the reply's list", async () => {
    serve(name);
    const list = await call();
    expect(list).toEqual(recorded(name).data);
    expect(list.length).toBeGreaterThan(0);
  });
});

describe("single records", () => {
  it("getRecipeOfDay returns the recipe in data", async () => {
    serve("recipeofday");
    const recipe = await api.getRecipeOfDay();
    expect(recipe.Recipe_title).toBe(recorded("recipeofday").data.Recipe_title);
  });

  it("getRecipeDayWithFilters returns the recipe with its ingredients", async () => {
    serve("recipe_day_filters");
    const recipe = await api.getRecipeDayWithFilters("peanut");
    const { data } = recorded("recipe_day_filters");
    expect(recipe.Recipe_title).toBe(data.Recipe_title);
    expect((recipe as unknown as { ingredients: unknown[] }).ingredients).toEqual(data.ingredients);
  });

  // The Recipe Details dialog: it reads `.recipe` and `.ingredients`, which the
  // live API nests under `data` — reading them from the top showed
  // "Recipe details could not be loaded."
  it("searchRecipeById finds the recipe and ingredients nested under data", async () => {
    serve("search_recipe");
    const { data } = recorded("search_recipe");
    const result = await api.searchRecipeById("2610");
    expect(result.recipe).toEqual(data.recipe);
    expect(result.ingredients).toEqual(data.ingredients);
    expect(result.ingredients.length).toBeGreaterThan(0);
  });

  it("getInstructionsByRecipeId finds the steps nested under data", async () => {
    serve("instructions");
    const { data } = recorded("instructions");
    await expect(api.getInstructionsByRecipeId("2610")).resolves.toEqual({
      recipe_id: data.recipe_id,
      steps: data.steps,
    });
  });
});

describe("requests the live API accepts", () => {
  it("asks the cuisine endpoint for `limit`, not the `page_size` it now rejects", async () => {
    serve("cuisine");
    await api.getRecipesByCuisine("Indian Subcontinent", 3, 12);
    const params = new URL(sentUrls[0]).searchParams;
    expect(params.has("page_size")).toBe(false);
    expect(params.get("limit")).toBe(String(api.FOODOSCOPE_MAX_LIMIT));
    expect(params.get("page")).toBe("3");
  });
});
