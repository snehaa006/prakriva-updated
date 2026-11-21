// src/services/foodoscopeApi.ts
// FoodOScope API service - all endpoints for the recipe database

const BASE_URL = "https://api.foodoscope.com/recipe2-api";

// --- API keys ---
//
// Keys live in ONE place: the `foodoscope_api_keys` table in Supabase. Add a
// row per key there (dashboard → Table Editor) and it takes effect without a
// redeploy — the pool is loaded on first request and re-checked every few
// minutes. Retire a key by setting `is_active` to false.
//
// FoodOScope is called straight from the browser, so these keys are visible to
// anyone signed in — they are per-app quota tokens, not secrets. With several
// in the table, the client rotates to the next one whenever a key is
// rate-limited, expired, or rejected.
//
// EMERGENCY_KEY below is not a place to add keys. It is the last resort that
// keeps recipes loading if Supabase is unreachable, and it is the same key
// this file has always shipped with.

const EMERGENCY_KEY = "usYgoaB4a9Xv-rrs6WPz9a9dfUktdm3yOe4FNoZWOH4n-qyB";

interface KeyEntry {
  key: string;
  /** Epoch ms until which this key is skipped when a healthier one exists. */
  cooldownUntil: number;
  source: "supabase" | "emergency";
}

const keyPool: KeyEntry[] = [
  { key: EMERGENCY_KEY, cooldownUntil: 0, source: "emergency" },
];

/** The key that last succeeded — tried first so we don't cycle needlessly. */
let activeIndex = 0;

/** True until real keys have been loaded out of Supabase. */
let poolIsEmergencyOnly = true;

const REMOTE_REFRESH_MS = 5 * 60_000;
let remoteLoad: Promise<void> | null = null;
let remoteLoadedAt = 0;

/** Adds keys we don't already hold, keeping the existing cooldown state. */
function mergeKeys(keys: string[]) {
  const fresh = keys
    .map((key) => key.trim())
    .filter((key) => key && !keyPool.some((entry) => entry.key === key));
  if (fresh.length === 0) return;

  if (poolIsEmergencyOnly) {
    // The emergency key is a last resort — real keys replace it outright
    // rather than sitting in front and burning a request on every rotation.
    keyPool.length = 0;
    activeIndex = 0;
    poolIsEmergencyOnly = false;
  }
  keyPool.push(
    ...fresh.map((key) => ({ key, cooldownUntil: 0, source: "supabase" as const }))
  );
}

async function ensureRemoteKeys(): Promise<void> {
  if (remoteLoad && Date.now() - remoteLoadedAt < REMOTE_REFRESH_MS) return remoteLoad;

  remoteLoadedAt = Date.now();
  remoteLoad = (async () => {
    try {
      // Imported lazily so this module stays usable (and testable) without a
      // configured Supabase client.
      const { supabase } = await import("@/lib/supabase");
      const { data, error } = await supabase
        .from("foodoscope_api_keys")
        .select("api_key")
        .eq("is_active", true)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });

      if (error || !data) return;
      mergeKeys(data.map((row: { api_key: string }) => row.api_key));
    } catch {
      // Signed out, offline, or the table is missing — the emergency key
      // keeps recipes loading until Supabase answers again.
    }
  })();

  return remoteLoad;
}

/** Statuses that mean "this key is the problem" — worth retrying on another. */
function isKeyFailure(status: number): boolean {
  return (
    status === 401 || // invalid / revoked key
    status === 402 || // quota exhausted
    status === 403 || // forbidden / suspended key
    status === 429 || // rate limited
    status >= 500 // upstream hiccup; another key may hit a healthier node
  );
}

/**
 * FoodOScope's own words for a key that has run out of credits. It answers
 * that case with **400**, not 402, and checks credits before it looks at the
 * request — so this 400 says nothing about the request, only about the key.
 */
const OUT_OF_TOKENS = /not enough tokens/i;

/** The `error` message from a FoodOScope error body, or "" if there isn't one. */
async function errorMessageOf(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown; message?: unknown } | null;
    return String(body?.error ?? body?.message ?? "");
  } catch {
    return "";
  }
}

/** How long to park a key after a failure, based on why it failed. */
function cooldownFor(status: number): number {
  if (status === 429) return 60_000;
  if (status === 401 || status === 402 || status === 403) return 15 * 60_000;
  return 30_000; // 5xx or network error
}

function penalize(index: number, status: number) {
  keyPool[index].cooldownUntil = Date.now() + cooldownFor(status);
  // Move on so the next request doesn't start on the key that just failed.
  if (activeIndex === index) activeIndex = (index + 1) % keyPool.length;
}

/**
 * Keys to try for one request, in order: the active key first, then the rest
 * in round-robin order. Keys still cooling down go last rather than being
 * dropped, so a request can still succeed when every key is cooling.
 */
function candidateOrder(): number[] {
  const now = Date.now();
  const order = keyPool.map((_, i) => (activeIndex + i) % keyPool.length);
  return [
    ...order.filter((i) => keyPool[i].cooldownUntil <= now),
    ...order.filter((i) => keyPool[i].cooldownUntil > now),
  ];
}

export class FoodoscopeApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "FoodoscopeApiError";
  }
}

/** Snapshot of the key pool — handy when debugging quota problems. */
export function getKeyPoolStatus() {
  const now = Date.now();
  return keyPool.map((entry, i) => ({
    index: i,
    // Never surface a whole key, even though it ships in the bundle.
    keyPreview: `${entry.key.slice(0, 6)}…${entry.key.slice(-4)}`,
    source: entry.source,
    active: i === activeIndex,
    coolingDown: entry.cooldownUntil > now,
    cooldownRemainingMs: Math.max(0, entry.cooldownUntil - now),
  }));
}

// --- Types ---

export interface RecipeBasic {
  _id: string;
  Recipe_id: string;
  Recipe_title: string;
  Calories: string;
  cook_time: string;
  prep_time: string;
  servings: string;
  total_time: string;
  Region: string;
  Sub_region: string;
  Continent: string;
  Source: string;
  "Carbohydrate, by difference (g)": string;
  "Energy (kcal)": string;
  "Protein (g)": string;
  "Total lipid (fat) (g)": string;
  Utensils: string;
  Processes: string;
  vegan: string;
  pescetarian: string;
  ovo_vegetarian: string;
  lacto_vegetarian: string;
  ovo_lacto_vegetarian: string;
  url?: string;
  img_url?: string;
  instructions?: string;
}

export interface RecipeWithIngredients {
  recipe: RecipeBasic;
  ingredients: RecipeIngredient[];
}

export interface RecipeIngredient {
  _id: string;
  recipe_no: string;
  ingredient_Phrase: string;
  ingredient: string;
  state?: string;
  quantity?: string;
  unit?: string;
  ing_id: string;
  ndb_id: string;
  M_or_A: string;
}

export interface NutritionInfo {
  _id: string;
  recipeTitle: string;
  Recipe_id: string;
  "Ash (g)": string;
  "Calcium, Ca (mg)": string;
  "Carbohydrate, by difference (g)": string;
  "Cholesterol (mg)": string;
  "Copper, Cu (mg)": string;
  "Energy (kJ)": string;
  "Energy (kcal)": string;
  "Fiber, total dietary (g)": string;
  "Iron, Fe (mg)": string;
  "Magnesium, Mg (mg)": string;
  "Manganese, Mn (mg)": string;
  "Niacin (mg)": string;
  "Phosphorus, P (mg)": string;
  "Potassium, K (mg)": string;
  "Protein (g)": string;
  "Sodium, Na (mg)": string;
  "Total lipid (fat) (g)": string;
  "Vitamin A, IU (IU)": string;
  "Vitamin C, total ascorbic acid (mg)": string;
  "Water (g)": string;
  "Zinc, Zn (mg)": string;
  [key: string]: string;
}

export interface MicronutritionInfo {
  _id: string;
  Recipe_id: string;
  Recipe_title: string;
  Calories: string;
  total_time: string;
  Continent: string;
  Region: string;
  Sub_region: string;
  Processes: string;
  [key: string]: string;
}

export interface FlavorIngredient {
  _id: string;
  IngID: string;
  ingredient: string;
  frequency: string;
  generic_name: string;
  FlavorDB_Category: string;
  Dietrx_Category: string;
  flavordb_id: string;
  Diet_rx_link: string;
}

export interface PaginationInfo {
  totalCount?: number;
  totalResults?: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage?: number;
  limit?: number;
}

export interface RecipeOfDay {
  _id: string;
  Recipe_id: string;
  Recipe_title: string;
  Calories: string;
  cook_time: string;
  prep_time: string;
  servings: string;
  total_time: string;
  url?: string;
  img_url?: string;
  Region: string;
  Sub_region: string;
  Continent: string;
  Source: string;
  "Carbohydrate, by difference (g)": string;
  "Energy (kcal)": string;
  "Protein (g)": string;
  "Total lipid (fat) (g)": string;
  Utensils: string;
  Processes: string;
  vegan: string;
  pescetarian: string;
  ovo_vegetarian: string;
  lacto_vegetarian: string;
  ovo_lacto_vegetarian: string;
  instructions?: string;
  ingredients?: { name: string }[];
}

// --- Helper ---

// Without this, a request that hangs instead of erroring (a stalled
// connection, an upstream node that accepts but never answers) blocks this
// key forever — and with it, every sequential call made while generating a
// diet chart. Aborting after a timeout turns that into an ordinary failure
// the key-rotation logic already knows how to route around.
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * The most results FoodOScope returns in one request. Asking for more is not
 * a shorter page but a 400 ("Limit cannot be greater than 10"), which took
 * Food Explorer down when it asked for 12. Every URL is capped here, in the
 * one place all calls pass through, rather than at each call site. Callers
 * page by the API's own pagination totals, so page counts stay consistent.
 */
export const FOODOSCOPE_MAX_LIMIT = 10;

/** `url` with its `limit` query parameter lowered to the API's maximum. */
export function capLimit(url: string): string {
  // Only the limit value is touched: re-serialising the whole query string
  // would re-encode the other parameters (commas in ingredient lists, etc.).
  return url.replace(/([?&]limit=)(\d+)/, (match, prefix: string, value: string) =>
    Number(value) > FOODOSCOPE_MAX_LIMIT ? `${prefix}${FOODOSCOPE_MAX_LIMIT}` : match
  );
}

async function apiFetch<T>(rawUrl: string): Promise<T> {
  const url = capLimit(rawUrl);
  await ensureRemoteKeys();

  let lastError: Error = new FoodoscopeApiError("No FoodOScope API key configured");

  for (const index of candidateOrder()) {
    const { key } = keyPool[index];
    let res: Response;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        signal: controller.signal,
      });
    } catch (err) {
      // Network/CORS failure, or the timeout above firing. Not the key's
      // fault as such, but there's nothing else to vary, so cool it off and
      // try the next one.
      lastError = err instanceof Error ? err : new Error(String(err));
      penalize(index, 0);
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.ok) {
      activeIndex = index;
      keyPool[index].cooldownUntil = 0;
      return res.json();
    }

    const detail = res.status === 400 ? await errorMessageOf(res) : "";
    const error = new FoodoscopeApiError(
      `API error: ${res.status} ${detail || res.statusText}`.trim(),
      res.status
    );
    // An exhausted key is a key failure, whatever status it arrives with;
    // treat it as the 402 it means so it cools down like one.
    const keyStatus = OUT_OF_TOKENS.test(detail) ? 402 : res.status;
    // A bad request or missing recipe fails identically on every key.
    if (!isKeyFailure(keyStatus)) throw error;

    penalize(index, keyStatus);
    lastError = error;
  }

  throw lastError;
}

/**
 * Calls a FoodOScope path with the rotating key pool and hands back the raw
 * JSON body. Everything below wraps `apiFetch` in a typed helper instead; this
 * exists for the standalone `public/mealCompatibility.html` page, which is
 * embedded in an iframe and asks the app to make its calls (see
 * `src/pages/patient/FoodCompatibility.tsx`) so it doesn't need keys of its own.
 */
export async function fetchFoodoscopePath<T = unknown>(path: string): Promise<T> {
  if (!path.startsWith("/")) {
    throw new FoodoscopeApiError(`FoodOScope path must start with "/": ${path}`);
  }
  return apiFetch<T>(`${BASE_URL}${path}`);
}

// --- Reply shapes ---
//
// Every endpoint the app uses now answers in one shape (recorded from the live
// API in November 2026):
//
//   { success, message, data, meta: { page, limit, total, totalPages } }
//
// `data` is the list, or the single record (search-recipe nests
// `{ recipe, ingredients, instructions }` inside it). The published spec still
// shows the older `{ payload: { data, pagination } }`, and earlier live replies
// put lists and page counts at the top level under several names. The readers
// below accept all of these, so the next reshuffle degrades instead of breaking,
// and a reply they cannot read fails with an error naming what it did contain.

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** The object in a reply that holds `data`: its `payload` if wrapped, else the reply. */
function replyBody(reply: unknown): Obj {
  if (isObj(reply) && isObj(reply.payload)) return reply.payload;
  return isObj(reply) ? reply : {};
}

const fieldsOf = (body: Obj) => Object.keys(body).join(", ") || "nothing";

/** The list in a reply. Throws a readable error naming what *was* there. */
function listOf<T>(reply: unknown, what: string): T[] {
  if (Array.isArray(reply)) return reply as T[];
  const body = replyBody(reply);
  // `recipes` is where the energy endpoint used to put its list.
  const list = [body.data, body.recipes].find(Array.isArray);
  if (list) return list as T[];
  throw new FoodoscopeApiError(
    `Unexpected FoodOScope reply for ${what}: no list in it (found: ${fieldsOf(body)})`
  );
}

/**
 * Page counts under every name the app's screens read them by — each was
 * written against a different reply (`totalCount`, `totalResults`, `total`,
 * `totalRecipes`; `totalPages`, `pages`; `currentPage`, `page`) — so a screen
 * keeps working whichever name it uses.
 */
export interface PageInfo {
  totalCount: number;
  totalResults: number;
  total: number;
  totalRecipes: number;
  totalPages: number;
  pages: number;
  currentPage: number;
  page: number;
  limit: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const COUNT_KEYS = ["total", "totalCount", "totalResults", "totalRecipes"];
const PAGES_KEYS = ["totalPages", "pages"];

/** Page counts from `meta` (live), `pagination` (spec/older) or the top level. */
function pageInfoOf(body: Obj, count: number, page: number): PageInfo {
  const source =
    [body.meta, body.pagination, body].find(
      (o): o is Obj => isObj(o) && [...COUNT_KEYS, ...PAGES_KEYS].some((k) => k in o)
    ) ?? {};
  const num = (...keys: string[]) => {
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value))) {
        return Number(value);
      }
    }
    return undefined;
  };
  const total = num(...COUNT_KEYS) ?? count;
  const limit = num("limit", "itemsPerPage", "recipesPerPage") ?? Math.max(count, 1);
  const totalPages = num(...PAGES_KEYS) ?? Math.max(1, Math.ceil(total / limit));
  const currentPage = num("page", "currentPage") ?? page;
  return {
    totalCount: total,
    totalResults: total,
    total,
    totalRecipes: total,
    totalPages,
    pages: totalPages,
    currentPage,
    page: currentPage,
    limit,
    itemsPerPage: limit,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}

/** A list plus its page counts. */
function pageOf<T>(reply: unknown, what: string, page: number) {
  const data = listOf<T>(reply, what);
  return { data, pagination: pageInfoOf(replyBody(reply), data.length, page) };
}

/** A single record: `data` when the reply nests it there, else the body itself. */
function recordOf<T>(reply: unknown): T {
  const body = replyBody(reply);
  return (isObj(body.data) ? body.data : body) as T;
}

// --- Endpoint 1: Get Recipes Info (paginated browse) ---
export async function getRecipesInfo(page = 1, limit = 12) {
  const url = `${BASE_URL}/recipe/recipesinfo?page=${page}&limit=${limit}`;
  return pageOf<RecipeBasic>(await apiFetch<unknown>(url), "recipes", page);
}

// --- Endpoint 2: Get Recipe of the Day ---
export async function getRecipeOfDay() {
  const url = `${BASE_URL}/recipe/recipeofday`;
  return recordOf<RecipeOfDay>(await apiFetch<unknown>(url));
}

// --- Endpoint 3: Get Recipe of Day with Ingredient/Category Filters ---
export async function getRecipeDayWithFilters(
  excludeIngredients?: string,
  excludeCategories?: string
) {
  const params = new URLSearchParams();
  if (excludeIngredients) params.set("excludeIngredients", excludeIngredients);
  if (excludeCategories) params.set("excludeCategories", excludeCategories);
  const url = `${BASE_URL}/recipe/recipe-day/with-ingredients-categories?${params}`;
  return recordOf<RecipeOfDay>(await apiFetch<unknown>(url));
}

// --- Endpoint 4: Get Nutrition Info (paginated) ---
export async function getNutritionInfo(page = 1, limit = 10) {
  const url = `${BASE_URL}/recipe-nutri/nutritioninfo?page=${page}&limit=${limit}`;
  return pageOf<NutritionInfo>(await apiFetch<unknown>(url), "nutrition info", page);
}

// --- Endpoint 5: Get Micronutrition Info (paginated) ---
export async function getMicronutritionInfo(page = 1, limit = 10) {
  const url = `${BASE_URL}/recipe-micronutri/micronutritioninfo?page=${page}&limit=${limit}`;
  return pageOf<MicronutritionInfo>(await apiFetch<unknown>(url), "micronutrition info", page);
}

// --- Endpoint 6: Get Recipes by Range ---
export async function getRecipesByRange(
  /** One of `total_time`, `prep_time` or `cook_time` — the API rejects any other field. */
  field: string,
  min = 0,
  max = 259260,
  page = 1,
  limit = 12
) {
  const url = `${BASE_URL}/recipes/range?min=${min}&max=${max}&page=${page}&limit=${limit}&field=${field}`;
  return pageOf<RecipeBasic>(await apiFetch<unknown>(url), "recipes by range", page);
}

// --- Endpoint 7: Get Recipes by Cuisine ---
export async function getRecipesByCuisine(
  region: string,
  page = 1,
  pageSize = 12,
  continent?: string,
  subRegion?: string,
  field?: string,
  min = 0,
  max = 259260
) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  // The endpoint now takes `limit`; it rejects the old `page_size` outright.
  params.set("limit", String(pageSize));
  params.set("min", String(min));
  params.set("max", String(max));
  if (field) params.set("field", field);
  if (continent) params.set("continent", continent);
  if (subRegion) params.set("subRegion", subRegion);
  const url = `${BASE_URL}/recipes_cuisine/cuisine/${encodeURIComponent(region)}?${params}`;
  return pageOf<RecipeBasic>(await apiFetch<unknown>(url), "recipes by cuisine", page);
}

// --- Endpoint 8: Get Recipe by Title ---
export async function getRecipeByTitle(title: string) {
  const url = `${BASE_URL}/recipe-bytitle/recipeByTitle?title=${encodeURIComponent(title)}`;
  return listOf<RecipeBasic>(await apiFetch<unknown>(url), "recipes by title");
}

// --- Endpoint 9: Get Recipes by Calories ---
export async function getRecipesByCalories(
  minCalories = 0,
  maxCalories = 612854.6,
  limit = 12,
  page = 1
) {
  const url = `${BASE_URL}/recipes-calories/calories?minCalories=${minCalories}&maxCalories=${maxCalories}&limit=${limit}&page=${page}`;
  return pageOf<RecipeBasic>(await apiFetch<unknown>(url), "recipes by calories", page);
}

// --- Endpoint 10: Get Recipes by Region and Diet ---
export async function getRecipesByRegionAndDiet(
  region: string,
  diet: string,
  limit = 12,
  page = 1
) {
  const url = `${BASE_URL}/recipe/region-diet/region-diet?region=${encodeURIComponent(region)}&diet=${encodeURIComponent(diet)}&limit=${limit}&page=${page}`;
  return pageOf<RecipeBasic>(await apiFetch<unknown>(url), "recipes by region and diet", page);
}

// --- Endpoint 11: Get Recipes by Diet ---
export async function getRecipesByDiet(
  diet: string,
  limit = 12,
  page = 1
) {
  const url = `${BASE_URL}/recipe-diet/recipe-diet?diet=${diet}&limit=${limit}&page=${page}`;
  return pageOf<RecipeBasic>(await apiFetch<unknown>(url), "recipes by diet", page);
}

// --- Endpoint 12: Get Recipes by Carbs ---
export async function getRecipesByCarbs(
  minCarbs = 0,
  maxCarbs = 100,
  limit = 12,
  page = 1
) {
  const url = `${BASE_URL}/recipe-carbo/recipes-by-carbs?minCarbs=${minCarbs}&maxCarbs=${maxCarbs}&limit=${limit}&page=${page}`;
  return pageOf<RecipeBasic>(await apiFetch<unknown>(url), "recipes by carbs", page);
}

// --- Endpoint 13: Get Instructions by Recipe ID ---
export async function getInstructionsByRecipeId(
  recipeId: string
): Promise<{ recipe_id: string; steps: string[] }> {
  const url = `${BASE_URL}/instructions/${recipeId}`;
  // Live: { data: { recipe_id, steps } }; older replies had both at the top.
  const record = recordOf<{ recipe_id?: unknown; steps?: unknown }>(await apiFetch<unknown>(url));
  const steps = Array.isArray(record.steps)
    ? record.steps.map(String)
    : typeof record.steps === "string" && record.steps
      ? [record.steps]
      : [];
  return { recipe_id: String(record.recipe_id ?? recipeId), steps };
}

// --- Endpoint 14: Get Ingredients by Flavor ---
export async function getIngredientsByFlavor(
  flavor: string,
  page = 1,
  limit = 20
) {
  const url = `${BASE_URL}/ingredients/flavor/${encodeURIComponent(flavor)}?page=${page}&limit=${limit}`;
  return pageOf<FlavorIngredient>(await apiFetch<unknown>(url), "ingredients by flavor", page);
}

// --- Endpoint 15: Get Recipes by Utensils ---
export async function getRecipesByUtensils(
  utensils: string,
  page = 1,
  limit = 12
) {
  const url = `${BASE_URL}/byutensils/utensils?utensils=${encodeURIComponent(utensils)}&page=${page}&limit=${limit}`;
  return pageOf<RecipeBasic>(await apiFetch<unknown>(url), "recipes by utensils", page);
}

// --- Endpoint 16: Get Recipes by Cooking Method ---
export async function getRecipesByCookingMethod(
  method: string,
  page = 1
) {
  const url = `${BASE_URL}/recipes-method/${encodeURIComponent(method)}?page=${page}`;
  return pageOf<RecipeBasic>(await apiFetch<unknown>(url), "recipes by cooking method", page);
}

// --- Endpoint 17: Get Recipes by Energy ---
export async function getRecipesByEnergy(
  minEnergy = 0,
  maxEnergy = 3440456.64,
  page = 1,
  limit = 12
) {
  const url = `${BASE_URL}/byenergy/energy?minEnergy=${minEnergy}&maxEnergy=${maxEnergy}&page=${page}&limit=${limit}`;
  return pageOf<RecipeBasic>(await apiFetch<unknown>(url), "recipes by energy", page);
}

// --- Endpoint 18: Search Recipe by ID (with Ingredients) ---
export async function searchRecipeById(recipeId: string): Promise<RecipeWithIngredients> {
  const url = `${BASE_URL}/search-recipe/${recipeId}`;
  const body = replyBody(await apiFetch<unknown>(url));
  // Live: data: { recipe, ingredients, instructions }. Older: { recipe,
  // ingredients } at the top. Spec: payload: { data: <the recipe>, ingredients }.
  const data = isObj(body.data) ? body.data : undefined;
  const holder = data && isObj(data.recipe) ? data : body;
  const recipe = isObj(holder.recipe) ? holder.recipe : data;
  if (!recipe) {
    throw new FoodoscopeApiError(
      `Unexpected FoodOScope reply for recipe ${recipeId}: no recipe in it (found: ${fieldsOf(body)})`
    );
  }
  const ingredients = [holder.ingredients, body.ingredients].find(Array.isArray) ?? [];
  return {
    recipe: recipe as unknown as RecipeBasic,
    ingredients: ingredients as RecipeIngredient[],
  };
}

// --- Endpoint 19: Get Recipe of Day by Category ---
export async function getRecipeDayByCategory(
  excludeDietrxCategories?: string,
  page = 1,
  limit = 10
) {
  const params = new URLSearchParams();
  if (excludeDietrxCategories) params.set("excludeDietrxCategories", excludeDietrxCategories);
  params.set("page", String(page));
  params.set("limit", String(limit));
  const url = `${BASE_URL}/recipe-Day-category/?${params}`;
  return listOf<RecipeOfDay>(await apiFetch<unknown>(url), "recipes of the day");
}

// --- Endpoint 20: Get Recipes by Protein Range ---
export async function getRecipesByProtein(
  min = 0,
  max = 178134.3738,
  page = 1,
  limit = 12
) {
  const url = `${BASE_URL}/protein/protein-range?min=${min}&max=${max}&page=${page}&limit=${limit}`;
  return pageOf<RecipeBasic>(await apiFetch<unknown>(url), "recipes by protein", page);
}

// --- Endpoint 21: Get Recipes by Category (Include/Exclude) ---
export async function getRecipesByCategory(
  includeDietrxCategories?: string,
  excludeDietrxCategories?: string,
  page = 1,
  limit = 12
) {
  const params = new URLSearchParams();
  if (includeDietrxCategories) params.set("includeDietrxCategories", includeDietrxCategories);
  if (excludeDietrxCategories) params.set("excludeDietrxCategories", excludeDietrxCategories);
  params.set("page", String(page));
  params.set("limit", String(limit));
  const url = `${BASE_URL}/category/?${params}`;
  return listOf<RecipeBasic>(await apiFetch<unknown>(url), "recipes by category");
}

// --- Endpoint 22: Get Recipes by Ingredients/Categories/Title ---
export async function getRecipesByIngredientsCategoriesTitle(
  params: {
    includeIngredients?: string;
    excludeIngredients?: string;
    includeCategories?: string;
    excludeCategories?: string;
    title?: string;
    page?: number;
    limit?: number;
  }
) {
  const searchParams = new URLSearchParams();
  if (params.includeIngredients) searchParams.set("includeIngredients", params.includeIngredients);
  if (params.excludeIngredients) searchParams.set("excludeIngredients", params.excludeIngredients);
  if (params.includeCategories) searchParams.set("includeCategories", params.includeCategories);
  if (params.excludeCategories) searchParams.set("excludeCategories", params.excludeCategories);
  if (params.title) searchParams.set("title", params.title);
  searchParams.set("page", String(params.page || 1));
  searchParams.set("limit", String(params.limit || 12));
  const url = `${BASE_URL}/recipebyingredient/by-ingredients-categories-title?${searchParams}`;

  try {
    return listOf<RecipeBasic>(await apiFetch<unknown>(url), "recipe search");
  } catch (err) {
    // This endpoint answers 404 when no recipe contains every requested
    // ingredient — a normal outcome of a narrow filter, not a failure. Report
    // it as "no matches" so the UI shows its empty state rather than a red
    // "Failed to load recipes" card.
    if (err instanceof FoodoscopeApiError && err.status === 404) {
      console.warn("No recipes matched the ingredient filter:", url);
      return [];
    }
    throw err;
  }
}
