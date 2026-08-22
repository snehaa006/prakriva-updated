import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SHOP_CATALOGUE } from "@/data/shopCatalogue";
import { usePatientStage } from "@/hooks/usePatientStage";
import { ProductImage } from "@/components/shop/ProductImage";
import { recommendProducts } from "@/lib/shop/recommendations";
import { formatPrice } from "@/lib/shop/retailers";
import { lowestPrice } from "@/lib/shop/search";

/**
 * "Things you might need" — the shop's beachhead on the dashboard.
 *
 * Compact on purpose. The dashboard is where a patient checks her plan, not
 * where she shops, so this is a short, named list that hands off to the shop
 * rather than a merchandising unit competing with her meals. Each row says why
 * it is there, and none of them says she should buy anything.
 */
export function ShopSuggestions({ limit = 3 }: { limit?: number }) {
  const stage = usePatientStage();
  const suggestions = recommendProducts(
    SHOP_CATALOGUE,
    { lifeStage: stage.lifeStage, trimester: stage.trimester, tracks: stage.tracks },
    limit,
  );

  if (suggestions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-subhead font-semibold">Things you might need</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {suggestions.map(({ product, reason }) => {
          const low = lowestPrice(product);
          return (
            <Link
              key={product.id}
              to={`/patient/shop/${product.id}`}
              className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent-soft/60"
            >
              {/* A thumbnail rather than a glyph, so a row here looks like the
                  tile it leads to. Square: at 40px a 4:3 crop reads as a
                  mis-sized icon rather than as a picture. */}
              <ProductImage
                product={product}
                className="aspect-square h-10 w-10 shrink-0 rounded-lg"
                sizes="40px"
              />
              {/* The price sits inside the second line rather than in its own
                  column: this card lives in the dashboard's narrow sidebar,
                  and a fixed price column on the right squeezed the reason
                  down to "Often wanted in t…" on every row. */}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-footnote font-medium text-foreground">
                  {product.title}
                </span>
                <span className="block text-caption1 text-foreground-secondary">
                  {low !== undefined && (
                    <span className="tabular-nums text-foreground">
                      from {formatPrice(low)}
                    </span>
                  )}
                  {low !== undefined && " · "}
                  {reason}
                </span>
              </span>
            </Link>
          );
        })}

        <Link
          to="/patient/shop"
          className="mt-2 flex items-center gap-1 pt-1 text-caption1 font-medium text-primary hover:underline"
        >
          Browse the shop
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
