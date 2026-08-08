// src/services/ingredientCatalogService.ts
//
// The pantry vocabulary, loaded from the recipe API itself.
//
// FoodOScope indexes its ingredients under FlavorDB categories, and each entry
// carries a `frequency` — how many recipes actually use it. Pulling the list
// from there means a patient can only pick ingredients the recipe search can
// really match, and the common ones sort to the top.
//
// The list is fetched once and cached for a week; `src/data/ingredients.ts` is
// the offline fallback for a first visit that cannot reach the API, and the
// source of the local-name aliases (methi, bhindi, jeera) the API has no idea
// about.

import { getIngredientsByFlavor, type FlavorIngredient } from "./foodoscopeApi";
import { INGREDIENTS } from "@/data/ingredients";
import { readCache, writeCache, ONE_DAY_MS } from "@/lib/localCache";

export interface CatalogIngredient {
  /** Shown to the patient and stored as the pantry food name. */
  label: string;
  /** Sent to the recipe API — the name it indexes. */
  searchTerm: string;
  category: string;
  /** Recipes using this ingredient; drives the ordering. 0 when unknown. */
  frequency: number;
  /** Extra words that should match while typing (local names, synonyms). */
  aliases: string[];
}

export interface IngredientCatalog {
  ingredients: CatalogIngredient[];
  /** "api" when it came from FoodOScope, "fallback" when only the local list. */
  source: "api" | "fallback";
  fetchedAt: string;
}

/**
 * The categories FoodOScope groups its ingredients under. These are the same
 * values the recipe filter accepts for `includeCategories`.
 */
export const FLAVOR_INGREDIENT_CATEGORIES = [
  // The twelve the Food Explorer's flavor browser already uses…
  "Vegetable-Bulb",
  "Vegetable-Root",
  "Vegetable-Fruit",
  "Vegetable-Tuber",
  "Fruit",
  "Spice",
  "Herb",
  "Nut",
  "Cereal",
  "Dairy",
  "Meat",
  "Seafood",
  // …plus the rest of the FlavorDB families a kitchen draws on. A category the
  // API doesn't know simply 404s and is skipped.
  "Vegetable",
  "Vegetable-Stem",
  "Legume",
  "Seed",
  "Fish",
  "Plant Derivative",
  "Beverage",
  "Fungus",
] as const;

const CACHE_KEY = "ingredient-catalog";
const CACHE_TTL = 7 * ONE_DAY_MS;

/** Page size and page cap per category — the cap bounds a runaway paginator. */
const PAGE_SIZE = 100;
const MAX_PAGES_PER_CATEGORY = 5;
/** Spacing between pages of one category, to stay polite to the rate limiter. */
const PAGE_SPACING_MS = 200;
/** Categories fetched at once. Small enough not to burst, big enough to be quick. */
const CATEGORY_CONCURRENCY = 4;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run `worker` over `items`, at most `limit` at a time, in order. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

const titleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/** Aliases from the local catalogue, keyed by the term they search on. */
function localAliases(): Map<string, string[]> {
  const byTerm = new Map<string, string[]>();
  for (const option of INGREDIENTS) {
    const key = option.searchTerm.toLowerCase();
    const words = [
      ...(option.aliases ?? []),
      // The curated label itself is a useful synonym: someone typing "toor dal"
      // should still land on `lentil`.
      option.label,
    ];
    byTerm.set(key, [...(byTerm.get(key) ?? []), ...words]);
  }
  return byTerm;
}

function toCatalogIngredient(
  row: FlavorIngredient,
  category: string,
  aliases: Map<string, string[]>
): CatalogIngredient | null {
  const searchTerm = (row.ingredient || "").trim().toLowerCase();
  if (!searchTerm) return null;

  const generic = (row.generic_name || "").trim();
  return {
    label: generic ? titleCase(generic) : titleCase(searchTerm),
    searchTerm,
    category: row.FlavorDB_Category?.trim() || category,
    frequency: Number(row.frequency) || 0,
    aliases: aliases.get(searchTerm) ?? [],
  };
}

/** The local list, shaped like an API catalogue, for the offline fallback. */
export function fallbackCatalog(): IngredientCatalog {
  return {
    ingredients: INGREDIENTS.map((option) => ({
      label: option.label,
      searchTerm: option.searchTerm,
      category: option.category,
      frequency: 0,
      aliases: option.aliases ?? [],
    })),
    source: "fallback",
    fetchedAt: new Date().toISOString(),
  };
}

/** Every ingredient FoodOScope lists under one category. */
async function fetchCategory(
  category: string,
  aliases: Map<string, string[]>
): Promise<CatalogIngredient[]> {
  const collected: CatalogIngredient[] = [];

  for (let page = 1; page <= MAX_PAGES_PER_CATEGORY; page++) {
    if (page > 1) await delay(PAGE_SPACING_MS);

    let result: Awaited<ReturnType<typeof getIngredientsByFlavor>>;
    try {
      result = await getIngredientsByFlavor(category, page, PAGE_SIZE);
    } catch {
      // A category the API doesn't know answers 404 — skip it and keep going.
      break;
    }

    const rows = result?.data ?? [];
    for (const row of rows) {
      const entry = toCatalogIngredient(row, category, aliases);
      if (entry) collected.push(entry);
    }

    const pages = result?.pagination?.pages ?? 1;
    if (rows.length === 0 || page >= pages) break;
  }

  return collected;
}

/**
 * Load the ingredient vocabulary, preferring FoodOScope's own list.
 *
 * Cached in localStorage for a week — a patient adding food should never wait
 * on ~30 category requests more than once.
 */
export async function loadIngredientCatalog(options?: {
  force?: boolean;
}): Promise<IngredientCatalog> {
  if (!options?.force) {
    const cached = readCache<IngredientCatalog>(CACHE_KEY, CACHE_TTL);
    if (cached && cached.ingredients.length > 0) return cached;
  }

  const aliases = localAliases();
  const byTerm = new Map<string, CatalogIngredient>();

  const perCategory = await mapWithConcurrency(
    FLAVOR_INGREDIENT_CATEGORIES,
    CATEGORY_CONCURRENCY,
    (category) => fetchCategory(category, aliases)
  );

  for (const entry of perCategory.flat()) {
    const existing = byTerm.get(entry.searchTerm);
    // The same ingredient can appear under several categories; keep the entry
    // the recipe database uses most.
    if (!existing || entry.frequency > existing.frequency) {
      byTerm.set(entry.searchTerm, entry);
    }
  }

  if (byTerm.size === 0) {
    // Offline, signed out, or every category failed — the local list keeps the
    // page usable, and is not cached so the next visit retries the API.
    return fallbackCatalog();
  }

  // Anything curated that the API didn't return still belongs in the list: it
  // is a real kitchen staple, and its search term is a plain noun.
  for (const option of INGREDIENTS) {
    const term = option.searchTerm.toLowerCase();
    if (byTerm.has(term)) continue;
    byTerm.set(term, {
      label: option.label,
      searchTerm: term,
      category: option.category,
      frequency: 0,
      aliases: option.aliases ?? [],
    });
  }

  const catalog: IngredientCatalog = {
    // Most-used ingredients first, then alphabetically — so "onion" and "rice"
    // beat obscure entries when someone types a common prefix.
    ingredients: [...byTerm.values()].sort(
      (a, b) => b.frequency - a.frequency || a.label.localeCompare(b.label)
    ),
    source: "api",
    fetchedAt: new Date().toISOString(),
  };

  writeCache(CACHE_KEY, catalog);
  return catalog;
}

/** The haystack the picker filters on: label, category, term and aliases. */
export function catalogSearchValue(entry: CatalogIngredient): string {
  return [entry.label, entry.searchTerm, entry.category, ...entry.aliases].join(" ");
}

/** Group a catalogue by category, most-used ingredient first within each. */
export function groupByCategory(
  ingredients: CatalogIngredient[]
): { category: string; options: CatalogIngredient[] }[] {
  const groups = new Map<string, CatalogIngredient[]>();
  for (const entry of ingredients) {
    groups.set(entry.category, [...(groups.get(entry.category) ?? []), entry]);
  }
  return [...groups.entries()]
    .map(([category, options]) => ({ category, options }))
    .sort((a, b) => b.options.length - a.options.length);
}
