// src/services/foodoscopeApi.ts
// FoodOScope API service - all endpoints for the recipe database

const BASE_URL = "https://api.foodoscope.com/recipe2-api";

// --- API keys ---
//
// FoodOScope is called straight from the browser, so these keys ship in the
// bundle and are visible to anyone using the app — they are per-app quota
// tokens, not secrets. Supply several and the client rotates to the next one
// whenever a key is rate-limited, expired, or rejected.
//
// Set them in the root `.env` (see `.env.example`) as either:
//   VITE_FOODOSCOPE_API_KEYS=key-one,key-two,key-three   (comma/newline list)
//   VITE_FOODOSCOPE_API_KEY=key-one                       (single key)
//   VITE_FOODOSCOPE_API_KEY_1=... VITE_FOODOSCOPE_API_KEY_2=...  (numbered)
// All three forms are merged, in that order, and duplicates are dropped.

/** Used only when no key is configured in the environment. */
const FALLBACK_KEYS = ["usYgoaB4a9Xv-rrs6WPz9a9dfUktdm3yOe4FNoZWOH4n-qyB"];

/** How many `VITE_FOODOSCOPE_API_KEY_<n>` slots are read. */
const MAX_NUMBERED_KEYS = 20;

function collectKeys(): string[] {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const raw: string[] = [
    ...(env.VITE_FOODOSCOPE_API_KEYS ?? "").split(/[,\n]/),
    env.VITE_FOODOSCOPE_API_KEY ?? "",
  ];
  for (let i = 1; i <= MAX_NUMBERED_KEYS; i++) {
    raw.push(env[`VITE_FOODOSCOPE_API_KEY_${i}`] ?? "");
  }

  const keys = [...new Set(raw.map((key) => key.trim()).filter(Boolean))];
  if (keys.length === 0) {
    if (import.meta.env.DEV) {
      console.warn(
        "[foodoscope] No VITE_FOODOSCOPE_API_KEY* set — using the bundled fallback key. " +
          "Add your keys to .env to enable rotation."
      );
    }
    return FALLBACK_KEYS;
  }
  return keys;
}

interface KeyEntry {
  key: string;
  /** Epoch ms until which this key is skipped when a healthier one exists. */
  cooldownUntil: number;
}

const keyPool: KeyEntry[] = collectKeys().map((key) => ({ key, cooldownUntil: 0 }));

/** The key that last succeeded — tried first so we don't cycle needlessly. */
let activeIndex = 0;

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

async function apiFetch<T>(url: string): Promise<T> {
  let lastError: Error = new FoodoscopeApiError("No FoodOScope API key configured");

  for (const index of candidateOrder()) {
    const { key } = keyPool[index];
    let res: Response;

    try {
      res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
      });
    } catch (err) {
      // Network/CORS failure. Not the key's fault as such, but there's
      // nothing else to vary, so cool it off and try the next one.
      lastError = err instanceof Error ? err : new Error(String(err));
      penalize(index, 0);
      continue;
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
  const data = await apiFetch<{
    success: string;
    message: string;
    payload: { data: RecipeBasic[] };
  }>(url);
  return data.payload.data;
}
