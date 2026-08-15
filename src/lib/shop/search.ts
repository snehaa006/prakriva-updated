import type {
  RetailerOffer,
  ShopFilters,
  ShopProduct,
  ShopSort,
} from "@/types/shop";

/**
 * Search, filter and sort for the patient shop. Pure and dependency-free, so
 * the ranking can be reasoned about in tests rather than by squinting at a
 * grid — see `src/lib/shop/__tests__/search.test.ts`.
 */

/** Lowercase, collapse whitespace, drop punctuation that patients type freely. */
const normalise = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenise = (query: string): string[] =>
  normalise(query).split(" ").filter(Boolean);

/** The cheapest in-stock offer, falling back to the cheapest offer overall. */
export const bestOffer = (product: ShopProduct): RetailerOffer | undefined => {
  const cheapest = (list: RetailerOffer[]) =>
    list.reduce<RetailerOffer | undefined>(
      (best, o) => (best === undefined || o.price < best.price ? o : best),
      undefined,
    );
  return cheapest(product.offers.filter((o) => o.inStock)) ?? cheapest(product.offers);
};

/** Lowest listed price across retailers, or `undefined` for a product with no offers. */
export const lowestPrice = (product: ShopProduct): number | undefined =>
  product.offers.length === 0
    ? undefined
    : Math.min(...product.offers.map((o) => o.price));

/** Highest listed price — the top of the "compare across N sellers" range. */
export const highestPrice = (product: ShopProduct): number | undefined =>
  product.offers.length === 0
    ? undefined
    : Math.max(...product.offers.map((o) => o.price));

/**
 * How well a product answers a query, 0 meaning "not a match at all".
 *
 * Weighted so the obvious result wins: a phrase hit in the title beats
 * scattered word hits, the title beats the keyword list, and the keyword list
 * beats the brand — otherwise searching "pillow" surfaces every product from a
 * brand whose name happens to contain it. Every token must hit something, so
 * "pregnancy pillow" cannot match a product that is merely about pregnancy.
 */
export const relevanceScore = (product: ShopProduct, query: string): number => {
  const tokens = tokenise(query);
  if (tokens.length === 0) return 1; // no query: everything is equally relevant

  const title = normalise(product.title);
  const brand = normalise(product.brand);
  const category = normalise(product.category.replace(/-/g, " "));
  const keywords = product.keywords.map(normalise);

  let score = 0;

  // Whole-phrase hit in the title is the strongest possible signal.
  const phrase = tokens.join(" ");
  if (title === phrase) score += 200;
  else if (title.startsWith(phrase)) score += 120;
  else if (title.includes(phrase)) score += 90;
  if (keywords.some((k) => k === phrase)) score += 80;

  for (const token of tokens) {
    let hit = 0;
    if (title.includes(token)) hit += 30;
    if (keywords.some((k) => k.includes(token))) hit += 18;
    if (category.includes(token)) hit += 10;
    if (brand.includes(token)) hit += 8;

    // A query token that matches nothing disqualifies the product outright,
    // so results stay an AND over the words the patient typed.
    if (hit === 0) return 0;
    score += hit;
  }

  return score;
};

/** Apply the filter panel. Filters are ANDed; `all`/undefined means "no filter". */
export const applyFilters = (
  products: ShopProduct[],
  filters: ShopFilters = {},
): ShopProduct[] =>
  products.filter((product) => {
    if (filters.category && filters.category !== "all" && product.category !== filters.category) {
      return false;
    }
    if (
      filters.retailer &&
      filters.retailer !== "all" &&
      !product.offers.some((o) => o.retailer === filters.retailer)
    ) {
      return false;
    }
    if (filters.inStockOnly && !product.offers.some((o) => o.inStock)) return false;
    if (filters.maxPrice !== undefined) {
      const low = lowestPrice(product);
      // A product with no offers has no price to compare, so a price ceiling
      // excludes it rather than silently letting it through.
      if (low === undefined || low > filters.maxPrice) return false;
    }
    return true;
  });

/**
 * Order a result list.
 *
 * Every sort is total: ties break on relevance and then on `id`, so the same
 * query always produces the same order. Without that, two equally-priced
 * products swap places between renders and the grid looks broken.
 */
export const sortProducts = (
  products: ShopProduct[],
  sort: ShopSort,
  query = "",
  categoryPriority: string[] = [],
): ShopProduct[] => {
  // With no query every product scores the same, so "most relevant" would fall
  // through to the id tie-break and open the shop on whatever sorts first
  // alphabetically — newborn diapers, for a patient who is 20 weeks pregnant.
  // The caller can pass her stage's shelf order to break that tie instead.
  const rank = (p: ShopProduct) => {
    const i = categoryPriority.indexOf(p.category);
    return i === -1 ? categoryPriority.length : i;
  };
  const byRelevance = (a: ShopProduct, b: ShopProduct) =>
    relevanceScore(b, query) - relevanceScore(a, query) ||
    rank(a) - rank(b) ||
    (b.rating ?? 0) - (a.rating ?? 0);
  const byId = (a: ShopProduct, b: ShopProduct) => a.id.localeCompare(b.id);

  // Products with no offers sort last under a price sort in both directions —
  // "no price" is not "free", and it is not "most expensive" either.
  const priced = (p: ShopProduct, fallback: number) => lowestPrice(p) ?? fallback;

  const comparators: Record<ShopSort, (a: ShopProduct, b: ShopProduct) => number> = {
    relevance: byRelevance,
    "price-asc": (a, b) => priced(a, Infinity) - priced(b, Infinity),
    "price-desc": (a, b) => priced(b, -Infinity) - priced(a, -Infinity),
    rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
  };

  return [...products].sort(
    (a, b) => comparators[sort](a, b) || byRelevance(a, b) || byId(a, b),
  );
};

export interface SearchOptions {
  query?: string;
  filters?: ShopFilters;
  sort?: ShopSort;
  /**
   * Shelf order to prefer when relevance alone can't separate two products —
   * in practice, the shelves that matter at this patient's stage. Only affects
   * ties, so it never overrides what she actually searched for.
   */
  categoryPriority?: string[];
}

/** Search → filter → sort, in that order. */
export const searchProducts = (
  catalogue: ShopProduct[],
  { query = "", filters = {}, sort = "relevance", categoryPriority = [] }: SearchOptions = {},
): ShopProduct[] => {
  const matched = query.trim()
    ? catalogue.filter((p) => relevanceScore(p, query) > 0)
    : catalogue;
  return sortProducts(applyFilters(matched, filters), sort, query, categoryPriority);
};

/**
 * Search terms to offer when a query returns nothing.
 *
 * Picked from the catalogue's own keywords by shared prefix, so a patient who
 * typed "pillo" or misspelt a brand gets a real, productive next step instead
 * of a dead end.
 */
export const suggestQueries = (
  catalogue: ShopProduct[],
  query: string,
  limit = 4,
): string[] => {
  const tokens = tokenise(query);
  if (tokens.length === 0) return [];

  const pool = new Set<string>();
  for (const product of catalogue) {
    for (const keyword of product.keywords) {
      const candidate = normalise(keyword);
      if (!candidate) continue;
      // Offer anything sharing a meaningful prefix with a typed word.
      if (
        tokens.some(
          (t) =>
            t.length >= 3 &&
            (candidate.includes(t) || t.startsWith(candidate.slice(0, 4))),
        )
      ) {
        pool.add(keyword);
      }
    }
  }
  return [...pool].sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(0, limit);
};
