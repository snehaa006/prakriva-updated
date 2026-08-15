import { describe, expect, it } from "vitest";

import { SHOP_CATALOGUE } from "@/data/shopCatalogue";
import type { ShopProduct } from "@/types/shop";

import {
  applyFilters,
  bestOffer,
  highestPrice,
  lowestPrice,
  relevanceScore,
  searchProducts,
  sortProducts,
  suggestQueries,
} from "../search";

const make = (over: Partial<ShopProduct> & { id: string }): ShopProduct => ({
  title: "Thing",
  brand: "Brand",
  category: "sleep-comfort",
  blurb: "A thing.",
  stages: ["pregnancy"],
  keywords: [],
  offers: [{ retailer: "amazon", price: 100, inStock: true }],
  ...over,
});

describe("relevanceScore", () => {
  it("ranks a title match above a keyword match above a brand match", () => {
    const query = "pillow";
    const titleHit = make({ id: "a", title: "Pregnancy Pillow" });
    const keywordHit = make({ id: "b", title: "Bump Wedge", keywords: ["pillow"] });
    const brandHit = make({ id: "c", title: "Bump Wedge", brand: "Pillow Co" });

    expect(relevanceScore(titleHit, query)).toBeGreaterThan(relevanceScore(keywordHit, query));
    expect(relevanceScore(keywordHit, query)).toBeGreaterThan(relevanceScore(brandHit, query));
  });

  it("requires every typed word to match something", () => {
    // "pregnancy pillow" must not match a product that is merely about
    // pregnancy, or the search returns the whole maternity catalogue.
    const pregnancyOnly = make({ id: "a", title: "Maternity Belt", keywords: ["pregnancy"] });
    expect(relevanceScore(pregnancyOnly, "pregnancy pillow")).toBe(0);
    expect(relevanceScore(pregnancyOnly, "pregnancy")).toBeGreaterThan(0);
  });

  it("scores a whole-phrase title hit above the same words scattered", () => {
    const phrase = make({ id: "a", title: "Full Body Pregnancy Pillow" });
    const scattered = make({ id: "b", title: "Pillow for Body Support", keywords: ["pregnancy"] });
    expect(relevanceScore(phrase, "pregnancy pillow")).toBeGreaterThan(
      relevanceScore(scattered, "pregnancy pillow"),
    );
  });

  it("ignores case, punctuation and extra whitespace", () => {
    const p = make({ id: "a", title: "U-Shaped Maternity Pillow" });
    const base = relevanceScore(p, "u shaped pillow");
    expect(relevanceScore(p, "U-SHAPED   pillow!!")).toBe(base);
  });

  it("treats an empty query as matching everything equally", () => {
    expect(relevanceScore(make({ id: "a" }), "")).toBe(1);
    expect(relevanceScore(make({ id: "a" }), "   ")).toBe(1);
  });
});

describe("price helpers", () => {
  const multi = make({
    id: "a",
    offers: [
      { retailer: "amazon", price: 1899, inStock: true },
      { retailer: "flipkart", price: 1499, inStock: false },
      { retailer: "firstcry", price: 2199, inStock: true },
    ],
  });

  it("reports the lowest and highest listed price across retailers", () => {
    expect(lowestPrice(multi)).toBe(1499);
    expect(highestPrice(multi)).toBe(2199);
  });

  it("prefers the cheapest in-stock offer over a cheaper out-of-stock one", () => {
    // Sending a patient to a cheaper listing she cannot buy is a worse
    // outcome than sending her to the cheapest one she can.
    expect(bestOffer(multi)?.retailer).toBe("amazon");
  });

  it("falls back to the cheapest offer when nothing is in stock", () => {
    const allGone = make({
      id: "b",
      offers: [
        { retailer: "amazon", price: 900, inStock: false },
        { retailer: "flipkart", price: 700, inStock: false },
      ],
    });
    expect(bestOffer(allGone)?.retailer).toBe("flipkart");
  });

  it("returns undefined rather than 0 or Infinity for a product with no offers", () => {
    const none = make({ id: "c", offers: [] });
    expect(lowestPrice(none)).toBeUndefined();
    expect(highestPrice(none)).toBeUndefined();
    expect(bestOffer(none)).toBeUndefined();
  });
});

describe("applyFilters", () => {
  const catalogue = [
    make({ id: "a", category: "sleep-comfort", offers: [{ retailer: "amazon", price: 500, inStock: true }] }),
    make({ id: "b", category: "supplements", offers: [{ retailer: "flipkart", price: 1500, inStock: false }] }),
    make({ id: "c", category: "supplements", offers: [{ retailer: "amazon", price: 2500, inStock: true }] }),
  ];

  it("filters by category, retailer and stock", () => {
    expect(applyFilters(catalogue, { category: "supplements" }).map((p) => p.id)).toEqual(["b", "c"]);
    expect(applyFilters(catalogue, { retailer: "flipkart" }).map((p) => p.id)).toEqual(["b"]);
    expect(applyFilters(catalogue, { inStockOnly: true }).map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("treats 'all' and undefined as no filter at all", () => {
    expect(applyFilters(catalogue, { category: "all", retailer: "all" })).toHaveLength(3);
    expect(applyFilters(catalogue, {})).toHaveLength(3);
    expect(applyFilters(catalogue)).toHaveLength(3);
  });

  it("applies a price ceiling against the cheapest offer", () => {
    expect(applyFilters(catalogue, { maxPrice: 1500 }).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("excludes an offer-less product from a price ceiling rather than passing it through", () => {
    const withEmpty = [...catalogue, make({ id: "d", offers: [] })];
    expect(applyFilters(withEmpty, { maxPrice: 99999 }).map((p) => p.id)).not.toContain("d");
  });

  it("ANDs filters together", () => {
    expect(
      applyFilters(catalogue, { category: "supplements", inStockOnly: true }).map((p) => p.id),
    ).toEqual(["c"]);
  });
});

describe("sortProducts", () => {
  const catalogue = [
    make({ id: "b", rating: 4.0, offers: [{ retailer: "amazon", price: 300, inStock: true }] }),
    make({ id: "a", rating: 4.5, offers: [{ retailer: "amazon", price: 300, inStock: true }] }),
    make({ id: "c", rating: 3.0, offers: [{ retailer: "amazon", price: 100, inStock: true }] }),
  ];

  it("sorts by price in both directions", () => {
    expect(sortProducts(catalogue, "price-asc").map((p) => p.id)[0]).toBe("c");
    expect(sortProducts(catalogue, "price-desc").map((p) => p.id)[0]).not.toBe("c");
  });

  it("sorts by rating, highest first", () => {
    expect(sortProducts(catalogue, "rating").map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("is stable and total, so equal items never swap between renders", () => {
    // b and a are the same price; the id tie-break has to settle it the same
    // way every time or the grid reshuffles on each keystroke.
    const once = sortProducts(catalogue, "price-asc").map((p) => p.id);
    const twice = sortProducts([...catalogue].reverse(), "price-asc").map((p) => p.id);
    expect(once).toEqual(twice);
    expect(once).toEqual(["c", "a", "b"]);
  });

  it("puts offer-less products last under both price sorts", () => {
    // "No price" is neither free nor the most expensive thing in the list.
    const withEmpty = [...catalogue, make({ id: "z", offers: [] })];
    expect(sortProducts(withEmpty, "price-asc").at(-1)?.id).toBe("z");
    expect(sortProducts(withEmpty, "price-desc").at(-1)?.id).toBe("z");
  });

  it("does not mutate the array it is given", () => {
    const original = [...catalogue];
    sortProducts(catalogue, "price-asc");
    expect(catalogue).toEqual(original);
  });
});

describe("category priority", () => {
  const mixed = [
    make({ id: "a-baby", category: "baby-essentials" }),
    make({ id: "b-sleep", category: "sleep-comfort" }),
    make({ id: "c-supp", category: "supplements" }),
  ];

  it("breaks relevance ties by the shelf order it is given", () => {
    // Without this, an un-searched shop opens on whatever sorts first by id —
    // newborn diapers, for a patient who is 20 weeks pregnant.
    const ordered = searchProducts(mixed, {
      categoryPriority: ["sleep-comfort", "supplements", "baby-essentials"],
    });
    expect(ordered.map((p) => p.id)).toEqual(["b-sleep", "c-supp", "a-baby"]);
  });

  it("puts categories missing from the priority list last, not first", () => {
    const ordered = searchProducts(mixed, { categoryPriority: ["supplements"] });
    expect(ordered[0].id).toBe("c-supp");
  });

  it("never overrides what she actually searched for", () => {
    const catalogue = [
      make({ id: "match", title: "Pregnancy Pillow", category: "baby-essentials" }),
      make({ id: "other", title: "Muslin Wrap", category: "sleep-comfort", keywords: ["pillow"] }),
    ];
    // sleep-comfort is top priority, but the title hit has to win.
    const ordered = searchProducts(catalogue, {
      query: "pregnancy pillow",
      categoryPriority: ["sleep-comfort", "baby-essentials"],
    });
    expect(ordered[0].id).toBe("match");
  });

  it("is ignored by the price and rating sorts", () => {
    const byPrice = searchProducts(
      [
        make({ id: "cheap", category: "baby-essentials", offers: [{ retailer: "amazon", price: 10, inStock: true }] }),
        make({ id: "dear", category: "sleep-comfort", offers: [{ retailer: "amazon", price: 999, inStock: true }] }),
      ],
      { sort: "price-asc", categoryPriority: ["sleep-comfort"] },
    );
    expect(byPrice[0].id).toBe("cheap");
  });
});

describe("searchProducts against the real catalogue", () => {
  it("puts a pregnancy pillow first for 'pregnancy pillow'", () => {
    const results = searchProducts(SHOP_CATALOGUE, { query: "pregnancy pillow" });
    expect(results.length).toBeGreaterThan(1);
    expect(results[0].category).toBe("sleep-comfort");
    expect(results[0].title.toLowerCase()).toContain("pillow");
  });

  it("finds products by how a patient would phrase it, not just the title", () => {
    // None of these words appear in the matching product's title.
    expect(searchProducts(SHOP_CATALOGUE, { query: "swollen feet" })[0]?.id).toBe(
      "wear-compression-socks",
    );
    expect(searchProducts(SHOP_CATALOGUE, { query: "stretch marks" }).length).toBeGreaterThan(0);
    expect(searchProducts(SHOP_CATALOGUE, { query: "hot flashes" })[0]?.category).toBe(
      "sleep-comfort",
    );
  });

  it("returns nothing for a query the catalogue cannot answer", () => {
    expect(searchProducts(SHOP_CATALOGUE, { query: "laptop charger" })).toEqual([]);
  });

  it("returns the whole catalogue for an empty query", () => {
    expect(searchProducts(SHOP_CATALOGUE)).toHaveLength(SHOP_CATALOGUE.length);
  });

  it("combines a query with filters and a sort", () => {
    const results = searchProducts(SHOP_CATALOGUE, {
      query: "pillow",
      filters: { inStockOnly: true },
      sort: "price-asc",
    });
    const prices = results.map((p) => lowestPrice(p) ?? Infinity);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    expect(results.every((p) => p.offers.some((o) => o.inStock))).toBe(true);
  });
});

describe("suggestQueries", () => {
  it("offers real catalogue terms after a near-miss", () => {
    const suggestions = suggestQueries(SHOP_CATALOGUE, "pillo");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.includes("pillow"))).toBe(true);
  });

  it("offers nothing for an empty query", () => {
    expect(suggestQueries(SHOP_CATALOGUE, "")).toEqual([]);
  });

  it("caps how many it offers", () => {
    expect(suggestQueries(SHOP_CATALOGUE, "pill", 2).length).toBeLessThanOrEqual(2);
  });
});
