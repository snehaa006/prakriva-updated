import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * FoodOScope's spec wraps replies in `payload`, but the live API answers flat
 * (`{ success, message, data, pagination }`) and moves endpoints over without
 * notice — recipesinfo's switch crashed Food Explorer with
 * "undefined is not an object (evaluating 'ae.data')". These readers must
 * accept both shapes, and say what they found when they get neither.
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

import {
  FoodoscopeApiError,
  getRecipeDayWithFilters,
  getRecipeOfDay,
  getRecipesByIngredientsCategoriesTitle,
  getRecipesInfo,
} from "../foodoscopeApi";

const replyWith = (body: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, statusText: "OK", json: async () => body }))
  );

const RECIPES = [{ Recipe_id: "2610", Recipe_title: "Egyptian Lentil Soup" }];
const PAGINATION = { totalCount: 118000, totalPages: 11800, currentPage: 2, itemsPerPage: 10 };
const RECIPE = { Recipe_id: "7", Recipe_title: "Khichdi" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("paginated lists (recipesinfo)", () => {
  it("reads the documented payload-wrapped reply exactly as before", async () => {
    replyWith({ success: "true", message: "ok", payload: { data: RECIPES, pagination: PAGINATION } });
    await expect(getRecipesInfo(2, 10)).resolves.toEqual({ data: RECIPES, pagination: PAGINATION });
  });

  it("reads the flat reply the live API now sends", async () => {
    replyWith({ success: true, message: "ok", data: RECIPES, pagination: PAGINATION });
    await expect(getRecipesInfo(2, 10)).resolves.toEqual({ data: RECIPES, pagination: PAGINATION });
  });

  it("stands in a single page when the reply carries no pagination", async () => {
    replyWith({ success: true, data: RECIPES });
    await expect(getRecipesInfo(1, 10)).resolves.toEqual({
      data: RECIPES,
      pagination: { totalCount: 1, totalPages: 1, currentPage: 1 },
    });
  });

  it("uses top-level page fields when that is where the reply puts them", async () => {
    replyWith({ success: true, data: RECIPES, totalPages: 7, currentPage: 3, totalResults: 70 });
    const { pagination } = await getRecipesInfo(3, 10);
    expect(pagination).toEqual({ totalCount: 70, totalPages: 7, currentPage: 3 });
  });

  it("names what it found when the reply holds no list at all", async () => {
    replyWith({ success: true, message: "ok", recipes: RECIPES });
    const error = await getRecipesInfo(1, 10).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FoodoscopeApiError);
    expect((error as Error).message).toBe(
      "Unexpected FoodOScope reply for recipes: no list in it (found: success, message, recipes)"
    );
  });
});

describe("plain lists (ingredient/category/title search)", () => {
  it("reads the flat reply", async () => {
    replyWith({ success: true, data: RECIPES, pagination: {} });
    await expect(getRecipesByIngredientsCategoriesTitle({ includeIngredients: "rice" })).resolves.toEqual(
      RECIPES
    );
  });

  it("still reads the payload-wrapped reply", async () => {
    replyWith({ success: "true", payload: { data: RECIPES } });
    await expect(getRecipesByIngredientsCategoriesTitle({ includeIngredients: "rice" })).resolves.toEqual(
      RECIPES
    );
  });
});

describe("single records", () => {
  it("recipe of the day: payload.data and flat data both give the recipe", async () => {
    replyWith({ success: "true", payload: { data: RECIPE } });
    await expect(getRecipeOfDay()).resolves.toEqual(RECIPE);

    replyWith({ success: true, data: RECIPE });
    await expect(getRecipeOfDay()).resolves.toEqual(RECIPE);
  });

  it("filtered recipe of the day: a bare payload and flat data both give the recipe", async () => {
    // The spec puts this recipe directly in `payload`, with no `data` level.
    replyWith({ success: true, payload: RECIPE });
    await expect(getRecipeDayWithFilters("peanut")).resolves.toEqual(RECIPE);

    replyWith({ success: true, data: RECIPE });
    await expect(getRecipeDayWithFilters("peanut")).resolves.toEqual(RECIPE);
  });
});
