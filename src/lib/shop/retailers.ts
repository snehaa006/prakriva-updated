import type { RetailerId, RetailerOffer, ShopProduct } from "@/types/shop";

/**
 * The storefronts the shop links out to, and the rules for building a safe
 * outbound URL.
 *
 * Everything a patient clicks in the shop leaves Prakriva, so this module is
 * the security boundary for the feature: a bad catalogue entry must not be
 * able to send someone to an arbitrary host. `offerUrl` therefore *validates*
 * rather than trusts, and falls back to a retailer search when validation
 * fails, which lands the patient somewhere useful instead of somewhere wrong.
 */

export interface Retailer {
  id: RetailerId;
  label: string;
  /** Hosts a direct product URL is allowed to be on. */
  hosts: string[];
  /** Search URL for a free-text query, used when there's no valid direct URL. */
  search: (query: string) => string;
}

export const RETAILERS: Record<RetailerId, Retailer> = {
  amazon: {
    id: "amazon",
    label: "Amazon",
    hosts: ["amazon.in", "www.amazon.in", "amzn.to"],
    search: (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
  },
  flipkart: {
    id: "flipkart",
    label: "Flipkart",
    hosts: ["flipkart.com", "www.flipkart.com", "dl.flipkart.com"],
    search: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
  },
  firstcry: {
    id: "firstcry",
    label: "FirstCry",
    hosts: ["firstcry.com", "www.firstcry.com"],
    search: (q) => `https://www.firstcry.com/search?q=${encodeURIComponent(q)}`,
  },
  nykaa: {
    id: "nykaa",
    label: "Nykaa",
    hosts: ["nykaa.com", "www.nykaa.com"],
    search: (q) => `https://www.nykaa.com/search/result/?q=${encodeURIComponent(q)}`,
  },
  brand: {
    id: "brand",
    label: "Brand site",
    // A brand's own store is on its own domain by definition, so there is no
    // fixed allow-list to check against. `offerUrl` still enforces https and a
    // parseable URL, and a brand offer with no URL has nowhere to search, so
    // the catalogue test requires brand offers to carry one.
    hosts: [],
    search: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  },
};

export const RETAILER_IDS = Object.keys(RETAILERS) as RetailerId[];

/**
 * When the catalogue's indicative prices were last verified.
 *
 * The UI must show this next to any price. There is no price feed behind this
 * feature; if one is ever added, this constant and the `price` fields are what
 * it replaces.
 */
export const PRICE_CHECKED_ON = "2026-08-01";

/**
 * Whether a direct product URL is safe to send a patient to.
 *
 * Requires https (never plain http, which would leak the click and can be
 * intercepted) and, for the marketplaces, a host on that retailer's allow-list
 * — matched on the full host or a dot-boundary subdomain, so `amazon.in` and
 * `www.amazon.in` pass while `amazon.in.evil.example` does not.
 */
export const isAllowedOfferUrl = (retailer: RetailerId, url: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;

  const { hosts } = RETAILERS[retailer];
  // A brand's own domain can be anything, so https + parseable is the bar.
  if (hosts.length === 0) return true;

  const host = parsed.hostname.toLowerCase();
  return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
};

/** The query used to find a product on a retailer that has no direct URL. */
export const offerSearchQuery = (product: ShopProduct): string =>
  `${product.brand} ${product.title}`.trim();

/**
 * Where an offer's button should go: the direct product page when we have a
 * valid one, otherwise that retailer's search for the product.
 */
export const offerUrl = (product: ShopProduct, offer: RetailerOffer): string =>
  offer.url && isAllowedOfferUrl(offer.retailer, offer.url)
    ? offer.url
    : RETAILERS[offer.retailer].search(offerSearchQuery(product));

/**
 * The attributes every outbound link in this feature must carry.
 *
 * `noopener`/`noreferrer` stop the opened page from reaching back through
 * `window.opener`; `nofollow sponsored` is the correct declaration for
 * commercial referral links and keeps the app honest with search engines about
 * what these are.
 */
export const OUTBOUND_LINK_REL = "noopener noreferrer nofollow sponsored";

/** Format an INR amount the way the rest of the shop does. */
export const formatPrice = (paise: number): string =>
  `₹${Math.round(paise).toLocaleString("en-IN")}`;
