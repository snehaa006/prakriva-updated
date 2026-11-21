import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * FoodOScope rejects `limit` above 10 with a 400 rather than returning a
 * shorter page — Food Explorer asked for 12 and showed "Failed to load
 * recipes". Every request is capped centrally, in apiFetch.
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

import { FOODOSCOPE_MAX_LIMIT, capLimit, getRecipesInfo } from "../foodoscopeApi";

const BASE = "https://api.foodoscope.com/recipe2-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("capLimit", () => {
  it("lowers a limit above FoodOScope's maximum", () => {
    expect(FOODOSCOPE_MAX_LIMIT).toBe(10);
    expect(capLimit(`${BASE}/recipe/recipesinfo?page=1&limit=12`)).toBe(
      `${BASE}/recipe/recipesinfo?page=1&limit=10`
    );
  });

  it("leaves a limit within the maximum alone", () => {
    const url = `${BASE}/recipe/recipesinfo?page=3&limit=5`;
    expect(capLimit(url)).toBe(url);
    expect(capLimit(`${BASE}/x?limit=10`)).toBe(`${BASE}/x?limit=10`);
  });

  it("changes nothing but the limit — other parameters keep their exact encoding", () => {
    expect(
      capLimit(`${BASE}/recipe-search?includeIngredients=rice,moong%20dal&limit=40&page=2`)
    ).toBe(`${BASE}/recipe-search?includeIngredients=rice,moong%20dal&limit=10&page=2`);
  });

  it("leaves URLs without a limit untouched", () => {
    const url = `${BASE}/recipe-bytitle/recipeByTitle?title=pasta`;
    expect(capLimit(url)).toBe(url);
  });
});

describe("requests", () => {
  it("Food Explorer's 12-per-page browse goes out asking for 10", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ success: "true", payload: { data: [], pagination: {} } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await getRecipesInfo(1, 12);

    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/recipe/recipesinfo?page=1&limit=10`,
      expect.anything()
    );
  });
});
