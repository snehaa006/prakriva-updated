import { describe, expect, it } from "vitest";

import { isAllowedOfferUrl } from "@/lib/shop/retailers";
import { LIFE_STAGES } from "@/lib/lifeStage";
import { HEALTH_TRACKS } from "@/lib/healthTrack";

import { SHOP_CATALOGUE, SHOP_CATEGORIES, categoryLabel, findProduct } from "../shopCatalogue";

/**
 * The catalogue is hand-written data shown to pregnant and postpartum
 * patients, so these tests enforce the editorial rules in its header comment
 * rather than just its shape. A future edit that adds a health claim, an
 * un-flagged supplement or an off-host link fails the build.
 */

const CATEGORY_IDS = SHOP_CATEGORIES.map((c) => c.id);

describe("catalogue shape", () => {
  it("has a unique id for every product", () => {
    const ids = SHOP_CATALOGUE.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every product a known category", () => {
    for (const p of SHOP_CATALOGUE) {
      expect(CATEGORY_IDS).toContain(p.category);
    }
  });

  it("uses every category it advertises", () => {
    // An empty shelf in the category rail is a dead end for the patient.
    for (const id of CATEGORY_IDS) {
      expect(SHOP_CATALOGUE.some((p) => p.category === id)).toBe(true);
    }
  });

  it("gives every product at least one life stage, all of them known", () => {
    for (const p of SHOP_CATALOGUE) {
      expect(p.stages.length).toBeGreaterThan(0);
      for (const stage of p.stages) {
        expect(Object.keys(LIFE_STAGES)).toContain(stage);
      }
    }
  });

  it("uses only known care tracks", () => {
    for (const p of SHOP_CATALOGUE) {
      for (const track of p.tracks ?? []) {
        expect(HEALTH_TRACKS).toContain(track);
      }
    }
  });

  it("gives every product search keywords", () => {
    for (const p of SHOP_CATALOGUE) {
      expect(p.keywords.length).toBeGreaterThan(0);
      expect(p.keywords.every((k) => k.trim().length > 0)).toBe(true);
    }
  });

  it("keeps ratings and trimesters inside their valid ranges", () => {
    for (const p of SHOP_CATALOGUE) {
      if (p.rating !== undefined) {
        expect(p.rating).toBeGreaterThan(0);
        expect(p.rating).toBeLessThanOrEqual(5);
      }
      for (const t of p.trimesters ?? []) {
        expect([1, 2, 3]).toContain(t);
      }
    }
  });

  it("finds a product by id and returns undefined for one that does not exist", () => {
    expect(findProduct(SHOP_CATALOGUE[0].id)?.id).toBe(SHOP_CATALOGUE[0].id);
    expect(findProduct("nope")).toBeUndefined();
  });

  it("labels every category", () => {
    for (const id of CATEGORY_IDS) {
      expect(categoryLabel(id)).not.toBe(id);
    }
  });
});

describe("offers", () => {
  it("gives every product at least one offer to compare", () => {
    // A product with no offers has nothing to compare and no way out to a
    // retailer — it is a dead tile in the grid.
    for (const p of SHOP_CATALOGUE) {
      expect(p.offers.length).toBeGreaterThan(0);
    }
  });

  it("keeps a struck-through list price above the price being charged", () => {
    for (const p of SHOP_CATALOGUE) {
      for (const o of p.offers) {
        if (o.listPrice !== undefined) {
          expect(o.listPrice).toBeGreaterThan(o.price);
        }
      }
    }
  });

  it("prices everything as a positive whole number of rupees", () => {
    for (const p of SHOP_CATALOGUE) {
      for (const o of p.offers) {
        expect(o.price).toBeGreaterThan(0);
        expect(Number.isInteger(o.price)).toBe(true);
      }
    }
  });

  it("lists each retailer at most once per product", () => {
    for (const p of SHOP_CATALOGUE) {
      const retailers = p.offers.map((o) => o.retailer);
      expect(new Set(retailers).size).toBe(retailers.length);
    }
  });

  it("only carries direct URLs that pass the outbound host check", () => {
    for (const p of SHOP_CATALOGUE) {
      for (const o of p.offers) {
        if (o.url) {
          expect(isAllowedOfferUrl(o.retailer, o.url)).toBe(true);
        }
      }
    }
  });

  it("gives every brand-site offer a URL, since there is no brand search to fall back to", () => {
    for (const p of SHOP_CATALOGUE) {
      for (const o of p.offers) {
        if (o.retailer === "brand") expect(o.url).toBeTruthy();
      }
    }
  });
});

describe("editorial rules", () => {
  it("flags every ingested product as needing a clinician's sign-off", () => {
    // A nutrition app must not nudge a pregnant patient into self-prescribing.
    for (const p of SHOP_CATALOGUE) {
      if (p.category === "supplements") {
        expect(p.clinicianAdvised).toBe(true);
      }
    }
  });

  it("makes no claim about what a product does to a body", () => {
    const CLAIMS =
      /\b(cure[sd]?|treats?|prevent[s|ed]?|heals?|reduces? (pain|risk)|guarantee[sd]?|clinically proven|boosts? immunity|improves? fertility)\b/i;
    const offenders = SHOP_CATALOGUE.filter((p) => CLAIMS.test(p.blurb)).map(
      (p) => `${p.id}: ${p.blurb}`,
    );
    expect(offenders).toEqual([]);
  });

  it("describes every product in a complete sentence", () => {
    for (const p of SHOP_CATALOGUE) {
      expect(p.blurb.length).toBeGreaterThan(20);
      expect(p.blurb.endsWith(".")).toBe(true);
    }
  });

  it("stocks no home fetal doppler, at any price", () => {
    // Deliberately excluded: a reassuring heartbeat found by an untrained user
    // delays presentation when something is actually wrong.
    const banned = /\b(fetal|foetal)\s+doppler\b|\bheartbeat monitor\b/i;
    const offenders = SHOP_CATALOGUE.filter(
      (p) => banned.test(p.title) || banned.test(p.blurb) || p.keywords.some((k) => banned.test(k)),
    );
    expect(offenders.map((p) => p.id)).toEqual([]);
  });

  it("covers the stages the app actually supports", () => {
    // Every life stage the dashboard can show must have something to suggest,
    // or its shop tab is empty for that patient.
    for (const stage of Object.keys(LIFE_STAGES)) {
      expect(SHOP_CATALOGUE.some((p) => p.stages.includes(stage as never))).toBe(true);
    }
  });
});
