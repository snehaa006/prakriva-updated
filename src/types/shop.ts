import type { HealthTrack } from "@/lib/healthTrack";
import type { LifeStage } from "@/lib/lifeStage";

/**
 * Types for the patient shop — a **comparison and referral** surface, not a
 * store.
 *
 * Prakriva does not take payment, hold stock, or fulfil anything. Every route
 * out of this feature ends at a retailer's own product page, which is where
 * the real price, the real stock status and the real returns policy live. That
 * constraint is deliberate and shapes the whole model below: there is no cart,
 * no order, no address, and `price` is explicitly *indicative* rather than
 * authoritative.
 */

/** A storefront we send patients to. */
export type RetailerId =
  | "amazon"
  | "flipkart"
  | "blinkit"
  | "instamart"
  | "firstcry"
  | "nykaa"
  | "brand";

/** One retailer's listing for a product. */
export interface RetailerOffer {
  retailer: RetailerId;
  /**
   * Indicative price in INR, from when the catalogue entry was last checked.
   *
   * This is **not** a live price. Retail prices move daily and this app has no
   * price feed, so the UI must always label it as indicative and date it — see
   * `PRICE_CHECKED_ON`. Showing a stale number as if it were live is worse
   * than showing no number at all.
   */
  price: number;
  /** The retailer's struck-through "MRP", when it lists one above `price`. */
  listPrice?: number;
  /**
   * Direct product URL. Optional: when absent (or when it fails the host check
   * in `lib/shop/retailers.ts`), a retailer search URL is built instead, which
   * degrades to something useful rather than to a dead link.
   */
  url?: string;
  inStock: boolean;
  /**
   * Delivery, in the retailer's own terms, when it differs from what that
   * storefront normally promises (`Retailer.delivery`).
   *
   * Quick-commerce apps are the reason this exists: Blinkit and Instamart are
   * often dearer than a marketplace and worth it anyway, because the thing
   * arrives in minutes rather than days. A price table that hides that is
   * comparing on the wrong axis — cheapest is not the same as best when
   * someone has run out of nursing pads at 2am.
   */
  delivery?: string;
}

export type ShopCategory =
  | "sleep-comfort"
  | "maternity-wear"
  | "supplements"
  | "skin-body"
  | "nursing-feeding"
  | "monitoring"
  | "intimate-care"
  | "baby-essentials"
  | "movement";

/**
 * The photograph shown for a product.
 *
 * Stock photography of the *kind* of thing, served from the app's own
 * `public/shop` folder rather than hot-linked from a retailer. Two reasons:
 * a retailer's product shot is theirs, not ours, and a hot-linked one breaks
 * the moment they re-key their CDN — leaving a grid of broken frames in front
 * of a patient. Local files also mean the shop renders with no network.
 *
 * Because it is a stand-in rather than the exact item, the UI must never let
 * the picture carry information the copy doesn't: it is scenery for the shelf,
 * and the blurb, the price and the retailer are what she decides on.
 */
export interface ProductImage {
  /** Absolute path under `/public`, e.g. `/shop/move-yoga-mat.webp`. */
  src: string;
  /** What the photo shows. Never repeats the title — a screen reader has that. */
  alt: string;
}

export interface ShopProduct {
  id: string;
  title: string;
  brand: string;
  category: ShopCategory;
  /**
   * One factual line about what the thing *is*. Never a health claim — this
   * app is not in a position to tell a patient that a cream prevents stretch
   * marks or that a supplement improves an outcome.
   */
  blurb: string;
  /** Life stages this is relevant to. Drives the dashboard suggestions. */
  stages: LifeStage[];
  /** Pregnancy trimesters it is typically wanted in. Absent means "any". */
  trimesters?: (1 | 2 | 3)[];
  /** Care pathways it is relevant to, beyond life stage (e.g. PCOS). */
  tracks?: HealthTrack[];
  /**
   * Whether a clinician should sign this off before the patient starts it.
   * True for anything ingested. The UI puts a visible notice on these and the
   * catalogue test enforces that every supplement carries the flag.
   */
  clinicianAdvised?: boolean;
  /** Aggregate rating as published by retailers, 0-5. */
  rating?: number;
  reviewCount?: number;
  /** Extra search terms — how a patient might actually phrase it. */
  keywords: string[];
  /** Shelf photograph. See `ProductImage` for why it is ours and not theirs. */
  image?: ProductImage;
  offers: RetailerOffer[];
}

/** How a result list is ordered. */
export type ShopSort = "relevance" | "price-asc" | "price-desc" | "rating";

/** The filter state behind the results list. */
export interface ShopFilters {
  category?: ShopCategory | "all";
  retailer?: RetailerId | "all";
  maxPrice?: number;
  inStockOnly?: boolean;
  /**
   * Only products a ten-minute app carries.
   *
   * Its own filter rather than a seller choice between Blinkit and Instamart,
   * because at 2am with no nursing pads left the question is "who can get this
   * here tonight", not "which of these two apps".
   */
  quickDeliveryOnly?: boolean;
}
