import { ArrowUpRight, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  OUTBOUND_LINK_REL,
  PRICE_CHECKED_ON,
  RETAILERS,
  formatPrice,
  isQuickCommerce,
  offerDelivery,
  offerUrl,
} from "@/lib/shop/retailers";
import { cn } from "@/lib/utils";
import type { RetailerOffer, ShopProduct } from "@/types/shop";

import { QuickDeliveryBadge, RetailerChip } from "./RetailerChip";

/**
 * Every seller's listing for one product, cheapest first.
 *
 * This is the whole feature in one component, so it carries the honesty
 * burden: prices here are indicative and dated, the real number lives at the
 * retailer, and the button that takes her there says which retailer it is
 * before she clicks.
 *
 * It compares on two axes rather than one. Blinkit and Instamart are usually
 * dearer than Amazon and usually right anyway, because the thing arrives in
 * minutes instead of days — so "cheapest" and "soonest" are both called out,
 * and every row states its own delivery. A table that ranked on price alone
 * would quietly tell a patient who has run out of nursing pads tonight to wait
 * until Thursday.
 */

const formattedCheckDate = new Date(PRICE_CHECKED_ON).toLocaleDateString("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Cheapest first; out-of-stock listings sink below in-stock ones at any price. */
const rankOffers = (offers: RetailerOffer[]): RetailerOffer[] =>
  [...offers].sort(
    (a, b) => Number(b.inStock) - Number(a.inStock) || a.price - b.price,
  );

function OfferRow({
  product,
  offer,
  isBest,
  isFastest,
}: {
  product: ShopProduct;
  offer: RetailerOffer;
  isBest: boolean;
  isFastest: boolean;
}) {
  const retailer = RETAILERS[offer.retailer];
  const discount =
    offer.listPrice && offer.listPrice > offer.price
      ? Math.round(((offer.listPrice - offer.price) / offer.listPrice) * 100)
      : undefined;

  return (
    <li
      className={cn(
        "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
        isBest && "bg-accent-soft/40",
      )}
    >
      <div className="flex min-w-0 gap-3">
        <RetailerChip retailer={offer.retailer} />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-subhead font-medium text-foreground">{retailer.label}</span>
            {isBest && offer.inStock && (
              <Badge className="bg-accent-soft text-accent-soft-foreground border-transparent text-caption2">
                Lowest price
              </Badge>
            )}
            {isFastest && !isBest && (
              <Badge variant="outline" className="text-caption2">
                Fastest
              </Badge>
            )}
            {!offer.inStock && (
              <Badge variant="outline" className="text-caption2 text-foreground-tertiary">
                Out of stock
              </Badge>
            )}
          </div>

          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-title3 tabular-nums text-foreground">
              {formatPrice(offer.price)}
            </span>
            {offer.listPrice !== undefined && (
              <span className="text-caption1 tabular-nums text-foreground-tertiary line-through">
                {formatPrice(offer.listPrice)}
              </span>
            )}
            {discount !== undefined && (
              <span className="text-caption1 font-medium text-primary">{discount}% off</span>
            )}
          </div>

          {/* Delivery sits under the price rather than in a column of its own:
              it is the other half of the comparison, and on a phone a second
              column would have squeezed both into two words each. */}
          <p className="mt-1 flex items-center gap-1.5 text-caption1 text-foreground-secondary">
            <Truck className="h-3 w-3 shrink-0 text-foreground-tertiary" aria-hidden="true" />
            {offerDelivery(offer)}
          </p>
        </div>
      </div>

      <Button
        asChild
        variant={isBest && offer.inStock ? "default" : "outline"}
        className="shrink-0"
      >
        {/*
          Outbound, so: a new tab, and `rel` carrying noopener/noreferrer (the
          opened page must not reach back through window.opener) plus
          nofollow/sponsored, which is the correct declaration for a referral
          link. The label names the destination — a patient should never have
          to guess where a button is about to send her.
        */}
        <a
          href={offerUrl(product, offer)}
          target="_blank"
          rel={OUTBOUND_LINK_REL}
          aria-label={`View ${product.title} on ${retailer.label} (opens in a new tab)`}
        >
          View on {retailer.label}
          <ArrowUpRight className="ml-1.5 h-4 w-4" />
        </a>
      </Button>
    </li>
  );
}

export function PriceComparison({ product }: { product: ShopProduct }) {
  const offers = rankOffers(product.offers);
  const inStock = offers.filter((o) => o.inStock);
  const bestId = inStock[0] ?? offers[0];
  // `offers` is already cheapest-first, so the first quick-commerce row in it
  // is both the soonest and the cheapest way to get it soon.
  const fastestId = inStock.find(isQuickCommerce);
  const spread =
    inStock.length > 1 ? inStock[inStock.length - 1].price - inStock[0].price : 0;

  if (offers.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card px-5 py-6 text-footnote text-foreground-secondary">
        No sellers listed for this one yet.
      </p>
    );
  }

  return (
    <section aria-labelledby="compare-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="compare-heading" className="text-headline text-foreground">
          Compare {offers.length === 1 ? "seller" : `${offers.length} sellers`}
        </h2>
        <p className="text-caption1 text-foreground-tertiary">
          Indicative prices, last checked {formattedCheckDate}
        </p>
      </div>

      {/* The two answers, before the table that justifies them. Cheapest and
          soonest are different questions and she may only care about one. */}
      {(spread > 0 || fastestId) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {spread > 0 && (
            <span className="rounded-full border border-border px-3 py-1 text-caption1 text-foreground-secondary">
              Up to{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatPrice(spread)}
              </span>{" "}
              between the cheapest and dearest seller
            </span>
          )}
          {fastestId && (
            <span className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-caption1 text-foreground-secondary">
              <QuickDeliveryBadge />
              from {RETAILERS[fastestId.retailer].label} at{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatPrice(fastestId.price)}
              </span>
            </span>
          )}
        </div>
      )}

      {/* A real list: these are N alternatives for the same thing, and a
          screen reader announcing "list, 5 items" is the shape of the answer. */}
      <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {offers.map((offer) => (
          <OfferRow
            key={offer.retailer}
            product={product}
            offer={offer}
            isBest={offer === bestId}
            isFastest={offer === fastestId}
          />
        ))}
      </ul>

      <p className="mt-3 text-caption1 leading-relaxed text-foreground-tertiary">
        Prakriva doesn't sell these products and doesn't take a cut of what you spend.
        Prices and availability change often — and on the ten-minute apps both depend on
        which dark store covers your pin code — so the seller's own page is the one that
        counts.
      </p>
    </section>
  );
}
