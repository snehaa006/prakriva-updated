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

async function apiFetch<T>(url: string): Promise<T> {
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

    const error = new FoodoscopeApiError(
      `API error: ${res.status} ${res.statusText}`,
      res.status
    );
    // A bad request or missing recipe fails identically on every key.
    if (!isKeyFailure(res.status)) throw error;

    penalize(index, res.status);
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

// --- Endpoint 1: Get Recipes Info (paginated browse) ---
export async function getRecipesInfo(page = 1, limit = 12) {
  const url = `${BASE_URL}/recipe/recipesinfo?page=${page}&limit=${limit}`;
  const data = await apiFetch<{
    success: string;
    message: string;
    payload: { data: RecipeBasic[]; pagination: PaginationInfo };
  }>(url);
  return data.payload;
}

// --- Endpoint 2: Get Recipe of the Day ---
export async function getRecipeOfDay() {
  const url = `${BASE_URL}/recipe/recipeofday`;
  const data = await apiFetch<{
    success: string;
    message: string;
    payload: { data: RecipeOfDay };
  }>(url);
  return data.payload.data;
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
  const data = await apiFetch<{
    success: boolean;
    message: string;
    payload: RecipeOfDay;
  }>(url);
  return data.payload;
}

// --- Endpoint 4: Get Nutrition Info (paginated) ---
export async function getNutritionInfo(page = 1, limit = 10) {
  const url = `${BASE_URL}/recipe-nutri/nutritioninfo?page=${page}&limit=${limit}`;
  const data = await apiFetch<{
    success: string;
    message: string;
    payload: { data: NutritionInfo[]; pagination: PaginationInfo };
  }>(url);
  return data.payload;
}

// --- Endpoint 5: Get Micronutrition Info (paginated) ---
export async function getMicronutritionInfo(page = 1, limit = 10) {
  const url = `${BASE_URL}/recipe-micronutri/micronutritioninfo?page=${page}&limit=${limit}`;
  const data = await apiFetch<{
    success: boolean;
    message: string;
    payload: { data: MicronutritionInfo[]; pagination: PaginationInfo };
  }>(url);
  return data.payload;
}

// --- Endpoint 6: Get Recipes by Range ---
export async function getRecipesByRange(
  field: string,
  min = 0,
  max = 259260,
  page = 1,
  limit = 12
) {
  const url = `${BASE_URL}/recipes/range?min=${min}&max=${max}&page=${page}&limit=${limit}&field=${field}`;
  const data = await apiFetch<{
    success: boolean;
    page: number;
    totalPages: number;
    totalResults: number;
    data: RecipeBasic[];
  }>(url);
  return {
    data: data.data,
    pagination: {
      totalPages: data.totalPages,
      totalResults: data.totalResults,
      currentPage: data.page,
    },
  };
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
  params.set("page_size", String(pageSize));
  params.set("min", String(min));
  params.set("max", String(max));
  if (field) params.set("field", field);
  if (continent) params.set("continent", continent);
  if (subRegion) params.set("subRegion", subRegion);
  const url = `${BASE_URL}/recipes_cuisine/cuisine/${encodeURIComponent(region)}?${params}`;
  const data = await apiFetch<{
    success: boolean;
    page: number;
    totalPages: number;
    totalResults: number;
    data: RecipeBasic[];
  }>(url);
  return {
    data: data.data,
    pagination: {
      totalPages: data.totalPages,
      totalResults: data.totalResults,
      currentPage: data.page,
    },
  };
}

// --- Endpoint 8: Get Recipe by Title ---
export async function getRecipeByTitle(title: string) {
  const url = `${BASE_URL}/recipe-bytitle/recipeByTitle?title=${encodeURIComponent(title)}`;
  const data = await apiFetch<{
    success: boolean;
    message: string;
    data: RecipeBasic[];
  }>(url);
  return data.data;
}

// --- Endpoint 9: Get Recipes by Calories ---
export async function getRecipesByCalories(
  minCalories = 0,
  maxCalories = 612854.6,
  limit = 12,
  page = 1
) {
  const url = `${BASE_URL}/recipes-calories/calories?minCalories=${minCalories}&maxCalories=${maxCalories}&limit=${limit}&page=${page}`;
  const data = await apiFetch<{
    success: boolean;
    message: string;
    data: RecipeBasic[];
    pagination: { totalResults: number; totalPages: number; currentPage: number; itemsPerPage: number };
  }>(url);
  return {
    data: data.data,
    pagination: data.pagination,
  };
}

// --- Endpoint 10: Get Recipes by Region and Diet ---
export async function getRecipesByRegionAndDiet(
  region: string,
  diet: string,
  limit = 12,
  page = 1
) {
  const url = `${BASE_URL}/recipe/region-diet/region-diet?region=${encodeURIComponent(region)}&diet=${encodeURIComponent(diet)}&limit=${limit}&page=${page}`;
  const data = await apiFetch<{
    success: boolean;
    message: string;
    data: RecipeBasic[];
    pagination: { totalCount: number; totalPages: number; currentPage: number; itemsPerPage: number };
  }>(url);
  return {
    data: data.data,
    pagination: data.pagination,
  };
}

// --- Endpoint 11: Get Recipes by Diet ---
export async function getRecipesByDiet(
  diet: string,
  limit = 12,
  page = 1
) {
  const url = `${BASE_URL}/recipe-diet/recipe-diet?diet=${diet}&limit=${limit}&page=${page}`;
  const data = await apiFetch<{
    success: boolean;
    message: string;
    data: RecipeBasic[];
    pagination: { totalCount: number; totalPages: number; currentPage: number; itemsPerPage: number };
  }>(url);
  return {
    data: data.data,
    pagination: data.pagination,
  };
}

// --- Endpoint 12: Get Recipes by Carbs ---
export async function getRecipesByCarbs(
  minCarbs = 0,
  maxCarbs = 100,
  limit = 12,
  page = 1
) {
  const url = `${BASE_URL}/recipe-carbo/recipes-by-carbs?minCarbs=${minCarbs}&maxCarbs=${maxCarbs}&limit=${limit}&page=${page}`;
  const data = await apiFetch<{
    success: boolean;
    message: string;
    data: RecipeBasic[];
    pagination: { totalCount: number; totalPages: number; currentPage: number; itemsPerPage: number };
  }>(url);
  return {
    data: data.data,
    pagination: data.pagination,
  };
}

// --- Endpoint 13: Get Instructions by Recipe ID ---
export async function getInstructionsByRecipeId(recipeId: string) {
  const url = `${BASE_URL}/instructions/${recipeId}`;
  const data = await apiFetch<{
    recipe_id: string;
    steps: string[];
  }>(url);
  return data;
}

// --- Endpoint 14: Get Ingredients by Flavor ---
export async function getIngredientsByFlavor(
  flavor: string,
  page = 1,
  limit = 20
) {
  const url = `${BASE_URL}/ingredients/flavor/${encodeURIComponent(flavor)}?page=${page}&limit=${limit}`;
  const data = await apiFetch<{
    status: string;
    data: FlavorIngredient[];
    pagination: { total: number; page: number; pages: number; limit: number };
  }>(url);
  return {
    data: data.data,
    pagination: data.pagination,
  };
}

// --- Endpoint 15: Get Recipes by Utensils ---
export async function getRecipesByUtensils(
  utensils: string,
  page = 1,
  limit = 12
) {
  const url = `${BASE_URL}/byutensils/utensils?utensils=${encodeURIComponent(utensils)}&page=${page}&limit=${limit}`;
  const data = await apiFetch<{
    success: boolean;
    data: RecipeBasic[];
    pagination: { total: number; totalPages: number; currentPage: number; limit: number; hasNextPage: boolean; hasPrevPage: boolean };
  }>(url);
  return {
    data: data.data,
    pagination: data.pagination,
  };
}

// --- Endpoint 16: Get Recipes by Cooking Method ---
export async function getRecipesByCookingMethod(
  method: string,
  page = 1
) {
  const url = `${BASE_URL}/recipes-method/${encodeURIComponent(method)}?page=${page}`;
  const data = await apiFetch<{
    status: string;
    data: RecipeBasic[];
    pagination: { total: number; page: number; pages: number };
  }>(url);
  return {
    data: data.data,
    pagination: {
      totalResults: data.pagination.total,
      totalPages: data.pagination.pages,
      currentPage: data.pagination.page,
    },
  };
}

// --- Endpoint 17: Get Recipes by Energy ---
export async function getRecipesByEnergy(
  minEnergy = 0,
  maxEnergy = 3440456.64,
  page = 1,
  limit = 12
) {
  const url = `${BASE_URL}/byenergy/energy?minEnergy=${minEnergy}&maxEnergy=${maxEnergy}&page=${page}&limit=${limit}`;
  const data = await apiFetch<{
    recipes: RecipeBasic[];
    pagination: { totalRecipes: number; totalPages: number; currentPage: number; limit: number };
  }>(url);
  return {
    data: data.recipes,
    pagination: {
      totalResults: data.pagination.totalRecipes,
      totalPages: data.pagination.totalPages,
      currentPage: data.pagination.currentPage,
    },
  };
}

// --- Endpoint 18: Search Recipe by ID (with Ingredients) ---
export async function searchRecipeById(recipeId: string) {
  const url = `${BASE_URL}/search-recipe/${recipeId}`;
  const data = await apiFetch<RecipeWithIngredients>(url);
  return data;
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
  const data = await apiFetch<{
    success: string;
    message: string;
    payload: { data: RecipeOfDay[] };
  }>(url);
  return data.payload.data;
}

// --- Endpoint 20: Get Recipes by Protein Range ---
export async function getRecipesByProtein(
  min = 0,
  max = 178134.3738,
  page = 1,
  limit = 12
) {
  const url = `${BASE_URL}/protein/protein-range?min=${min}&max=${max}&page=${page}&limit=${limit}`;
  const data = await apiFetch<{
    success: boolean;
    currentPage: number;
    totalPages: number;
    totalRecipes: number;
    recipesPerPage: number;
    data: RecipeBasic[];
  }>(url);
  return {
    data: data.data,
    pagination: {
      totalResults: data.totalRecipes,
      totalPages: data.totalPages,
      currentPage: data.currentPage,
    },
  };
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
  const data = await apiFetch<{
    success: string;
    message: string;
    payload: { data: RecipeBasic[] };
  }>(url);
  return data.payload.data;
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
    const data = await apiFetch<{
      success: string;
      message: string;
      payload: { data: RecipeBasic[] };
    }>(url);
    return data.payload.data;
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
