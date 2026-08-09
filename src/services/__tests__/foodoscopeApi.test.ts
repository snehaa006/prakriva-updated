import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRecipesByIngredientsCategoriesTitle,
  FoodoscopeApiError,
} from "../foodoscopeApi";

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, statusText: "OK", json: async () => body }) as Response;

const errorResponse = (status: number, statusText = "") =>
  ({ ok: false, status, statusText }) as Response;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getRecipesByIngredientsCategoriesTitle", () => {
  it("returns the recipes from the payload", async () => {
    const recipes = [{ Recipe_id: "1", Recipe_title: "Khichdi" }];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ success: "true", message: "ok", payload: { data: recipes } })
      )
    );

    await expect(
      getRecipesByIngredientsCategoriesTitle({ includeIngredients: "rice" })
    ).resolves.toEqual(recipes);
  });

  it("treats a 404 as an empty result, not a failure", async () => {
    // The endpoint answers 404 when no recipe contains every ingredient, which
    // is an ordinary outcome of a narrow filter (e.g. a whole patient pantry).
    vi.stubGlobal("fetch", vi.fn(async () => errorResponse(404, "Not Found")));

    await expect(
      getRecipesByIngredientsCategoriesTitle({
        includeIngredients: "dals,guava,brown rice",
      })
    ).resolves.toEqual([]);
  });

  it("still reports a genuine request error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => errorResponse(400, "Bad Request")));

    await expect(
      getRecipesByIngredientsCategoriesTitle({ includeIngredients: "rice" })
    ).rejects.toBeInstanceOf(FoodoscopeApiError);
  });
});
