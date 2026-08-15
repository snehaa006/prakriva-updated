import { describe, expect, it } from "vitest";

import { SHOP_CATALOGUE } from "@/data/shopCatalogue";
import type { ShopProduct } from "@/types/shop";

import { recommendProducts, suggestedCategoryOrder } from "../recommendations";

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

describe("recommendProducts", () => {
  it("only suggests things relevant to her stage or her care pathway", () => {
    const suggestions = recommendProducts(SHOP_CATALOGUE, { lifeStage: "pregnancy" }, 8);
    for (const { product } of suggestions) {
      expect(product.stages).toContain("pregnancy");
    }
  });

  it("never suggests postpartum-only kit to someone still pregnant", () => {
    const ids = recommendProducts(SHOP_CATALOGUE, { lifeStage: "pregnancy" }, 20).map(
      (s) => s.product.id,
    );
    // A breast pump and newborn diapers are postpartum-only in the catalogue.
    expect(ids).not.toContain("feed-electric-pump");
    expect(ids).not.toContain("baby-newborn-diapers");
  });

  it("prefers items matching the trimester she is actually in", () => {
    const third = recommendProducts(
      SHOP_CATALOGUE,
      { lifeStage: "pregnancy", trimester: "3" },
      6,
    );
    // Third-trimester items exist in the catalogue (swaddles, wipes) and
    // should surface once we know the trimester.
    expect(third.some((s) => s.product.trimesters?.includes(3))).toBe(true);
  });

  it("explains a trimester match in those words", () => {
    const suggestions = recommendProducts(
      SHOP_CATALOGUE,
      { lifeStage: "pregnancy", trimester: "2" },
      6,
    );
    const trimesterReason = suggestions.find((s) => s.reason.includes("trimester"));
    expect(trimesterReason?.reason).toBe("Often wanted in the second trimester");
  });

  it("gives every suggestion a reason, phrased as context rather than instruction", () => {
    const suggestions = recommendProducts(SHOP_CATALOGUE, { lifeStage: "pregnancy" }, 6);
    expect(suggestions.length).toBeGreaterThan(0);
    for (const { reason } of suggestions) {
      expect(reason.trim()).not.toBe("");
      // Nothing here may read as a directive to a patient.
      expect(reason.toLowerCase()).not.toMatch(/\byou (should|must|need to)\b/);
    }
  });

  it("varies the categories instead of returning four of the same thing", () => {
    const suggestions = recommendProducts(SHOP_CATALOGUE, { lifeStage: "pregnancy" }, 4);
    const categories = suggestions.map((s) => s.product.category);
    expect(new Set(categories).size).toBe(categories.length);
  });

  it("picks up PCOS items from the care track, not the life stage", () => {
    const suggestions = recommendProducts(
      SHOP_CATALOGUE,
      { lifeStage: "not_applicable", tracks: ["pcos"] },
      8,
    );
    const ids = suggestions.map((s) => s.product.id);
    expect(ids).toContain("supp-myo-inositol");
    expect(suggestions.find((s) => s.product.id === "supp-myo-inositol")?.reason).toContain(
      "PCOD / PCOS",
    );
  });

  it("serves a patient who is both pregnant and on the PCOS track", () => {
    const suggestions = recommendProducts(
      SHOP_CATALOGUE,
      { lifeStage: "pregnancy", trimester: "2", tracks: ["pcos"] },
      6,
    );
    expect(suggestions.length).toBe(6);
    expect(suggestions.some((s) => s.product.stages.includes("pregnancy"))).toBe(true);
  });

  it("still returns something for a patient with no stage and no tracks", () => {
    const suggestions = recommendProducts(SHOP_CATALOGUE, {}, 4);
    expect(suggestions).toHaveLength(4);
  });

  it("handles an unknown stage by falling back to general wellness", () => {
    const unknown = recommendProducts(SHOP_CATALOGUE, { lifeStage: "gestation" }, 4);
    const general = recommendProducts(SHOP_CATALOGUE, { lifeStage: "not_applicable" }, 4);
    expect(unknown.map((s) => s.product.id)).toEqual(general.map((s) => s.product.id));
  });

  it("ignores a trimester that isn't 1, 2 or 3", () => {
    const bogus = recommendProducts(SHOP_CATALOGUE, { lifeStage: "pregnancy", trimester: "9" }, 4);
    const none = recommendProducts(SHOP_CATALOGUE, { lifeStage: "pregnancy" }, 4);
    expect(bogus.map((s) => s.product.id)).toEqual(none.map((s) => s.product.id));
  });

  it("respects the limit and is deterministic", () => {
    const once = recommendProducts(SHOP_CATALOGUE, { lifeStage: "postpartum" }, 3);
    const twice = recommendProducts(SHOP_CATALOGUE, { lifeStage: "postpartum" }, 3);
    expect(once).toHaveLength(3);
    expect(once.map((s) => s.product.id)).toEqual(twice.map((s) => s.product.id));
  });

  it("backfills past the one-per-category rule rather than returning a short list", () => {
    // Two products, same category: the diversity rule alone would return one.
    const narrow = [make({ id: "a" }), make({ id: "b" })];
    expect(recommendProducts(narrow, { lifeStage: "pregnancy" }, 2)).toHaveLength(2);
  });

  it("returns an empty list rather than throwing on an empty catalogue", () => {
    expect(recommendProducts([], { lifeStage: "pregnancy" })).toEqual([]);
  });
});

describe("suggestedCategoryOrder", () => {
  it("leads with sleep and comfort during pregnancy", () => {
    expect(suggestedCategoryOrder({ lifeStage: "pregnancy" })[0]).toBe("sleep-comfort");
  });

  it("leads with feeding after birth", () => {
    expect(suggestedCategoryOrder({ lifeStage: "postpartum" })[0]).toBe("nursing-feeding");
  });

  it("falls back to the general order for an unknown stage", () => {
    expect(suggestedCategoryOrder({ lifeStage: "???" })).toEqual(
      suggestedCategoryOrder({ lifeStage: "not_applicable" }),
    );
  });
});
