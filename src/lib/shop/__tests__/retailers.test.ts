import { describe, expect, it } from "vitest";

import type { ShopProduct } from "@/types/shop";

import {
  OUTBOUND_LINK_REL,
  RETAILERS,
  RETAILER_IDS,
  formatPrice,
  isAllowedOfferUrl,
  offerUrl,
} from "../retailers";

/**
 * Every click in the shop leaves the app, so these tests are the security
 * boundary for the feature: a bad catalogue entry must never be able to send a
 * patient to an arbitrary host.
 */

const product: ShopProduct = {
  id: "test",
  title: "Full Body Pregnancy Pillow",
  brand: "Sleepsia",
  category: "sleep-comfort",
  blurb: "A pillow.",
  stages: ["pregnancy"],
  keywords: ["pregnancy pillow"],
  offers: [{ retailer: "amazon", price: 1899, inStock: true }],
};

describe("isAllowedOfferUrl", () => {
  it("accepts the retailer's own host and its subdomains", () => {
    expect(isAllowedOfferUrl("amazon", "https://www.amazon.in/dp/B08X")).toBe(true);
    expect(isAllowedOfferUrl("amazon", "https://amazon.in/dp/B08X")).toBe(true);
    expect(isAllowedOfferUrl("flipkart", "https://dl.flipkart.com/x")).toBe(true);
  });

  it("rejects a look-alike host that merely ends with the brand name", () => {
    // The whole point of the check: `amazon.in.evil.example` and
    // `notamazon.in` both contain the allowed string.
    expect(isAllowedOfferUrl("amazon", "https://amazon.in.evil.example/dp/B08X")).toBe(false);
    expect(isAllowedOfferUrl("amazon", "https://notamazon.in/dp/B08X")).toBe(false);
    expect(isAllowedOfferUrl("flipkart", "https://flipkart.com.attacker.test/")).toBe(false);
  });

  it("rejects a host belonging to a different retailer", () => {
    expect(isAllowedOfferUrl("amazon", "https://www.flipkart.com/x")).toBe(false);
  });

  it("rejects anything that is not https", () => {
    expect(isAllowedOfferUrl("amazon", "http://www.amazon.in/dp/B08X")).toBe(false);
    expect(isAllowedOfferUrl("brand", "http://example.com")).toBe(false);
  });

  it("rejects javascript: and data: URLs outright", () => {
    // These would parse as URLs but must never reach an href.
    expect(isAllowedOfferUrl("brand", "javascript:alert(1)")).toBe(false);
    expect(isAllowedOfferUrl("brand", "data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects unparseable input instead of throwing", () => {
    expect(isAllowedOfferUrl("amazon", "not a url")).toBe(false);
    expect(isAllowedOfferUrl("amazon", "")).toBe(false);
  });

  it("allows any https host for a brand's own store", () => {
    // A brand site is on its own domain by definition, so there is no
    // allow-list to check it against — https is the bar.
    expect(isAllowedOfferUrl("brand", "https://nuawoman.com/product/x")).toBe(true);
  });
});

describe("offerUrl", () => {
  it("uses a valid direct product URL as-is", () => {
    const url = offerUrl(product, {
      retailer: "amazon",
      price: 1,
      inStock: true,
      url: "https://www.amazon.in/dp/B08X",
    });
    expect(url).toBe("https://www.amazon.in/dp/B08X");
  });

  it("falls back to a retailer search when there is no direct URL", () => {
    const url = offerUrl(product, { retailer: "amazon", price: 1, inStock: true });
    expect(url).toContain("https://www.amazon.in/s?k=");
    expect(url).toContain(encodeURIComponent("Sleepsia Full Body Pregnancy Pillow"));
  });

  it("falls back to search rather than following an unsafe URL", () => {
    // The failure mode that matters: a poisoned catalogue entry degrades to a
    // harmless search instead of navigating the patient off-platform.
    const url = offerUrl(product, {
      retailer: "amazon",
      price: 1,
      inStock: true,
      url: "https://amazon.in.evil.example/dp/B08X",
    });
    expect(url).toContain("https://www.amazon.in/s?k=");
    expect(url).not.toContain("evil.example");
  });

  it("percent-encodes the query so it cannot break out of the URL", () => {
    const url = offerUrl(
      { ...product, brand: "A&B", title: "x?y=z#w" },
      { retailer: "flipkart", price: 1, inStock: true },
    );
    expect(new URL(url).searchParams.get("q")).toBe("A&B x?y=z#w");
  });
});

describe("the retailer registry", () => {
  it.each(RETAILER_IDS)("%s builds an https search URL", (id) => {
    const url = RETAILERS[id].search("pregnancy pillow");
    expect(new URL(url).protocol).toBe("https:");
  });

  it("declares outbound links as sponsored and window.opener-safe", () => {
    for (const token of ["noopener", "noreferrer", "nofollow", "sponsored"]) {
      expect(OUTBOUND_LINK_REL).toContain(token);
    }
  });
});

describe("formatPrice", () => {
  it("renders rupees with Indian digit grouping", () => {
    expect(formatPrice(1899)).toBe("₹1,899");
    expect(formatPrice(100000)).toBe("₹1,00,000");
  });

  it("rounds rather than showing fractional rupees", () => {
    expect(formatPrice(1899.4)).toBe("₹1,899");
  });
});
