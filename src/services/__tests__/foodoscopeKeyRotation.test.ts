import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Key rotation against FoodOScope's real failure shapes. An exhausted key
 * answers `400 {"error":"Not enough tokens"}` — not 402 — and the rotation used
 * to treat every 400 as a bad request, so the first exhausted key in the table
 * ended the request and newly added keys were never tried.
 */

// The keys the `foodoscope_api_keys` table hands back, in priority order.
const table = vi.hoisted(() => ({ rows: [] as { api_key: string }[] }));

vi.mock("@/lib/supabase", () => {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  query.select = chain;
  query.eq = chain;
  query.order = chain;
  // Awaiting the builder resolves the query, as supabase-js does.
  query.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: table.rows, error: null });
  return { supabase: { from: () => query } };
});

const reply = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 400 ? "Bad Request" : "OK",
    json: async () => body,
  }) as Response;

const OUT_OF_TOKENS = { error: "Not enough tokens" };
const RECIPES = { success: "true", payload: { data: [{ Recipe_id: "1" }] } };

/** A fetch whose answer depends on which key the request carries. */
const fetchByKey = (answers: Record<string, () => Response>) =>
  vi.fn(async (_url: string, init?: RequestInit) => {
    const auth = (init?.headers as Record<string, string>).Authorization;
    return answers[auth.replace("Bearer ", "")]();
  });

const keysTried = (fetchMock: ReturnType<typeof fetchByKey>) =>
  fetchMock.mock.calls.map(([, init]) =>
    (init?.headers as Record<string, string>).Authorization.replace("Bearer ", "")
  );

// The key pool lives in module state, so every test loads a fresh copy.
const load = async () => {
  vi.resetModules();
  return import("../foodoscopeApi");
};

beforeEach(() => {
  table.rows = [{ api_key: "old-exhausted" }, { api_key: "new-key" }];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FoodOScope key rotation", () => {
  it("moves past a key that is out of tokens to the next one", async () => {
    const api = await load();
    const fetchMock = fetchByKey({
      "old-exhausted": () => reply(400, OUT_OF_TOKENS),
      "new-key": () => reply(200, RECIPES),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.fetchFoodoscopePath("/recipe/recipesinfo?page=1&limit=12")).resolves.toEqual(
      RECIPES
    );
    expect(keysTried(fetchMock)).toEqual(["old-exhausted", "new-key"]);
  });

  it("goes straight to the working key on the next request", async () => {
    const api = await load();
    const fetchMock = fetchByKey({
      "old-exhausted": () => reply(400, OUT_OF_TOKENS),
      "new-key": () => reply(200, RECIPES),
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.fetchFoodoscopePath("/recipe/recipesinfo?page=1&limit=12");
    fetchMock.mockClear();
    await api.fetchFoodoscopePath("/recipe/recipesinfo?page=2&limit=12");

    expect(keysTried(fetchMock)).toEqual(["new-key"]);
  });

  it("still fails fast on a genuine bad request, without burning other keys", async () => {
    const api = await load();
    const fetchMock = fetchByKey({
      "old-exhausted": () => reply(400, { error: "page must be a number" }),
      "new-key": () => reply(200, RECIPES),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.fetchFoodoscopePath("/recipe/recipesinfo?page=x")).rejects.toThrow(
      "page must be a number"
    );
    expect(keysTried(fetchMock)).toEqual(["old-exhausted"]);
  });

  it("says the keys are out of tokens when every one of them is", async () => {
    const api = await load();
    vi.stubGlobal(
      "fetch",
      fetchByKey({
        "old-exhausted": () => reply(400, OUT_OF_TOKENS),
        "new-key": () => reply(400, OUT_OF_TOKENS),
      })
    );

    const error = await api
      .fetchFoodoscopePath("/recipe/recipesinfo?page=1&limit=12")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(api.FoodoscopeApiError);
    expect((error as Error).message).toBe("API error: 400 Not enough tokens");
    expect(api.getKeyPoolStatus().every((key) => key.coolingDown)).toBe(true);
  });
});
