import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  OUTBOUND_LINK_REL,
  PRICE_CHECKED_ON,
  RETAILERS,
  formatPrice,
  offerUrl,
} from "@/lib/shop/retailers";
import { cn } from "@/lib/utils";
import type { RetailerOffer, ShopProduct } from "@/types/shop";

/**
 * Every seller's listing for one product, cheapest first.
 *
 * This is the whole feature in one component, so it carries the honesty
 * burden: prices here are indicative and dated, the real number lives at the
 * retailer, and the button that takes her there says which retailer it is
 * before she clicks.
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
}: {
  product: ShopProduct;
  offer: RetailerOffer;
  isBest: boolean;
}) {
  const retailer = RETAILERS[offer.retailer];
  const discount =
    offer.listPrice && offer.listPrice > offer.price
      ? Math.round(((offer.listPrice - offer.price) / offer.listPrice) * 100)
      : undefined;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
        isBest && "bg-accent-soft/40",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-subhead font-medium text-foreground">{retailer.label}</span>
          {isBest && offer.inStock && (
            <Badge className="bg-accent-soft text-accent-soft-foreground border-transparent text-caption2">
              Lowest price
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
    </div>
  );
}

export function PriceComparison({ product }: { product: ShopProduct }) {
  const offers = rankOffers(product.offers);
  const bestId = offers.find((o) => o.inStock) ?? offers[0];

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

      <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {offers.map((offer) => (
          <OfferRow
            key={offer.retailer}
            product={product}
            offer={offer}
            isBest={offer === bestId}
          />
        ))}
      </div>

      <p className="mt-3 text-caption1 leading-relaxed text-foreground-tertiary">
        Prakriva doesn't sell these products and doesn't take a cut of what you spend.
        Prices and availability change often — the seller's own page is the one that counts.
      </p>
    </section>
  );
}
