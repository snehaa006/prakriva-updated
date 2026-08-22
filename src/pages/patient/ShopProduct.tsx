// src/pages/patient/ShopProduct.tsx
// One product, every seller's price, and the way out to whichever she picks.

import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Info, Star } from "lucide-react";

import { PriceComparison } from "@/components/shop/PriceComparison";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductImage } from "@/components/shop/ProductImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { SHOP_CATALOGUE, categoryLabel, findProduct } from "@/data/shopCatalogue";
import { usePatientStage } from "@/hooks/usePatientStage";
import { recommendProducts } from "@/lib/shop/recommendations";
import { formatPrice } from "@/lib/shop/retailers";
import { highestPrice, lowestPrice } from "@/lib/shop/search";

const ShopProduct = () => {
  const { productId } = useParams<{ productId: string }>();
  const product = productId ? findProduct(productId) : undefined;
  const stage = usePatientStage();

  // An unknown id is a stale link, not an error worth a page of its own.
  if (!product) return <Navigate to="/patient/shop" replace />;

  const low = lowestPrice(product);
  const high = highestPrice(product);
  const spread = low !== undefined && high !== undefined ? high - low : 0;

  // Why this is (or isn't) relevant to her, using the same rules as the
  // dashboard suggestions rather than a second opinion invented here.
  const reason = recommendProducts([product], {
    lifeStage: stage.lifeStage,
    trimester: stage.trimester,
    tracks: stage.tracks,
  })[0]?.reason;

  const related = SHOP_CATALOGUE.filter(
    (p) => p.category === product.category && p.id !== product.id,
  ).slice(0, 3);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Reveal>
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-foreground-secondary">
          <Link to="/patient/shop">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to shop
          </Link>
        </Button>
      </Reveal>

      {/* ── Product header ── */}
      <Reveal index={1} className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-col gap-6 sm:flex-row">
          {/* The one image on the page that is worth loading eagerly: it is
              above the fold and it is what she came to look at. */}
          <ProductImage
            product={product}
            className="rounded-xl sm:w-64 sm:shrink-0"
            sizes="(min-width: 640px) 16rem, 100vw"
            eager
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-caption2">
                {categoryLabel(product.category)}
              </Badge>
              {reason && (
                <Badge className="border-transparent bg-accent-soft text-caption2 text-accent-soft-foreground">
                  {reason}
                </Badge>
              )}
            </div>

            <p className="mt-2 text-caption1 text-foreground-tertiary">{product.brand}</p>
            <h1 className="mt-0.5 text-title2 text-foreground">{product.title}</h1>
            <p className="mt-2 max-w-xl text-footnote leading-relaxed text-foreground-secondary">
              {product.blurb}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              {product.rating !== undefined && (
                <span className="flex items-center gap-1.5 text-footnote text-foreground-secondary">
                  <Star className="h-4 w-4 fill-primary text-primary" />
                  <span className="tabular-nums font-medium text-foreground">
                    {product.rating.toFixed(1)}
                  </span>
                  {product.reviewCount !== undefined && (
                    <span className="text-foreground-tertiary">
                      · {product.reviewCount.toLocaleString("en-IN")} ratings
                    </span>
                  )}
                </span>
              )}
              {low !== undefined && (
                <span className="text-footnote text-foreground-secondary">
                  From{" "}
                  <span className="tabular-nums font-semibold text-foreground">
                    {formatPrice(low)}
                  </span>
                  {spread > 0 && (
                    <>
                      {" "}
                      · save up to{" "}
                      <span className="tabular-nums font-medium text-primary">
                        {formatPrice(spread)}
                      </span>{" "}
                      by comparing
                    </>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Anything ingested carries this. It is deliberately a full-width
            notice rather than fine print — a nutrition app should not be the
            reason someone starts a supplement on her own. */}
        {product.clinicianAdvised && (
          <div className="mt-6 flex gap-3 rounded-lg border border-border bg-accent-soft/50 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-footnote leading-relaxed text-foreground-secondary">
              <span className="font-medium text-foreground">Check with your doctor first.</span>{" "}
              Doses that suit one person can be wrong or unsafe for another, especially during
              pregnancy — and if you're already on a prescription, some supplements interact
              with it. Bring this to your next consultation rather than starting on your own.
            </p>
          </div>
        )}
      </Reveal>

      <Reveal index={2}>
        <PriceComparison product={product} />
      </Reveal>

      {related.length > 0 && (
        <Reveal index={3}>
          <h2 className="text-headline text-foreground">More in {categoryLabel(product.category)}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Reveal>
      )}
    </div>
  );
};

export default ShopProduct;
