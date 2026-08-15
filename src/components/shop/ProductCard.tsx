import { Link } from "react-router-dom";
import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { categoryLabel } from "@/data/shopCatalogue";
import { bestOffer, highestPrice, lowestPrice } from "@/lib/shop/search";
import { RETAILERS, formatPrice } from "@/lib/shop/retailers";
import { cn } from "@/lib/utils";
import type { ShopProduct } from "@/types/shop";

import { CATEGORY_ICONS } from "./categoryIcons";

/**
 * One tile in the results grid.
 *
 * The whole tile is a link to the product's comparison page rather than
 * straight out to a retailer: the point of this feature is that she sees every
 * seller's price before she leaves, so the last thing it should do is bounce
 * her to Amazon on the first click.
 */
export function ProductCard({ product, reason }: { product: ShopProduct; reason?: string }) {
  const Icon = CATEGORY_ICONS[product.category];
  const low = lowestPrice(product);
  const high = highestPrice(product);
  const best = bestOffer(product);
  const sellers = product.offers.length;
  const anyInStock = product.offers.some((o) => o.inStock);

  return (
    <Link
      to={`/patient/shop/${product.id}`}
      className={cn(
        "group flex h-full flex-col rounded-xl border border-border bg-card p-4 text-left",
        "transition-all duration-200 ease-ios hover:border-border-strong hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-primary">
          <Icon className="h-5 w-5" />
        </span>
        {product.clinicianAdvised && (
          <Badge variant="outline" className="shrink-0 text-caption2">
            Ask your doctor
          </Badge>
        )}
      </div>

      <p className="text-caption1 text-foreground-tertiary">{product.brand}</p>
      <h3 className="mt-0.5 line-clamp-2 text-subhead font-semibold text-foreground">
        {product.title}
      </h3>

      {reason ? (
        <p className="mt-1.5 text-caption1 text-primary">{reason}</p>
      ) : (
        <p className="mt-1.5 text-caption1 text-foreground-secondary">
          {categoryLabel(product.category)}
        </p>
      )}

      <div className="mt-3 flex-1" />

      {product.rating !== undefined && (
        <div className="flex items-center gap-1 text-caption1 text-foreground-secondary">
          <Star className="h-3 w-3 fill-primary text-primary" />
          <span className="tabular-nums">{product.rating.toFixed(1)}</span>
          {product.reviewCount !== undefined && (
            <span className="text-foreground-tertiary">
              ({product.reviewCount.toLocaleString("en-IN")})
            </span>
          )}
        </div>
      )}

      {/* The range is the product here — it's what makes comparing worth a
          click — so it sits beside the headline price. `whitespace-nowrap`
          keeps "– ₹1,825" together: without it the dash and the figure break
          across lines and the range reads as a stray minus sign. */}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <span className="text-title3 tabular-nums text-foreground">
          {low !== undefined ? formatPrice(low) : "—"}
        </span>
        {low !== undefined && high !== undefined && high > low && (
          <span className="whitespace-nowrap text-caption1 tabular-nums text-foreground-tertiary">
            – {formatPrice(high)}
          </span>
        )}
      </div>

      <p className="mt-1 text-caption1 text-foreground-secondary">
        {sellers === 1 ? "1 seller" : `${sellers} sellers`}
        {best && anyInStock && ` · lowest at ${RETAILERS[best.retailer].label}`}
        {!anyInStock && " · out of stock"}
      </p>
    </Link>
  );
}
