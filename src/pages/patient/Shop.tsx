// src/pages/patient/Shop.tsx
// "Shop" — a comparison and referral surface for the things patients at each
// life stage commonly need. Prakriva holds no stock and takes no payment:
// every route out of here ends at a retailer's own product page.

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Plate } from "@/components/illustrations/LineArt";
import { CATEGORY_ICONS } from "@/components/shop/categoryIcons";
import { ProductCard } from "@/components/shop/ProductCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Reveal } from "@/components/ui/reveal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { SHOP_CATALOGUE, SHOP_CATEGORIES } from "@/data/shopCatalogue";
import { usePatientStage } from "@/hooks/usePatientStage";
import { recommendProducts, suggestedCategoryOrder } from "@/lib/shop/recommendations";
import { PRICE_CHECKED_ON, RETAILERS, RETAILER_IDS, formatPrice } from "@/lib/shop/retailers";
import { lowestPrice, searchProducts, suggestQueries } from "@/lib/shop/search";
import { cn } from "@/lib/utils";
import type { RetailerId, ShopCategory, ShopSort } from "@/types/shop";

/** Ceiling for the price slider — the dearest thing in the catalogue, rounded up. */
const PRICE_CEILING =
  Math.ceil(
    Math.max(...SHOP_CATALOGUE.map((p) => lowestPrice(p) ?? 0)) / 500,
  ) * 500;

const SORT_LABELS: { value: ShopSort; label: string }[] = [
  { value: "relevance", label: "Most relevant" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Best rated" },
];

const formattedCheckDate = new Date(PRICE_CHECKED_ON).toLocaleDateString("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const Shop = () => {
  const stage = usePatientStage();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ShopCategory | "all">("all");
  const [retailer, setRetailer] = useState<RetailerId | "all">("all");
  const [maxPrice, setMaxPrice] = useState(PRICE_CEILING);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<ShopSort>("relevance");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const isSearching = query.trim().length > 0;
  const hasFilters =
    category !== "all" || retailer !== "all" || inStockOnly || maxPrice < PRICE_CEILING;

  // The shelves that matter at her stage, used only to break relevance ties —
  // so an un-searched shop opens on sleep and comfort during pregnancy rather
  // than on whatever happens to sort first by id.
  const categoryPriority = useMemo(
    () => suggestedCategoryOrder({ lifeStage: stage.lifeStage }),
    [stage.lifeStage],
  );

  const results = useMemo(
    () =>
      searchProducts(SHOP_CATALOGUE, {
        query,
        sort,
        categoryPriority,
        filters: {
          category,
          retailer,
          inStockOnly,
          maxPrice: maxPrice < PRICE_CEILING ? maxPrice : undefined,
        },
      }),
    [query, sort, categoryPriority, category, retailer, inStockOnly, maxPrice],
  );

  // Shown above the grid on the landing state only — once she has typed a
  // query, what she asked for outranks what we think she might want.
  const suggestions = useMemo(
    () =>
      recommendProducts(
        SHOP_CATALOGUE,
        { lifeStage: stage.lifeStage, trimester: stage.trimester, tracks: stage.tracks },
        4,
      ),
    [stage.lifeStage, stage.trimester, stage.tracks],
  );

  const didYouMean = useMemo(
    () => (results.length === 0 && isSearching ? suggestQueries(SHOP_CATALOGUE, query) : []),
    [results.length, isSearching, query],
  );

  const resetFilters = () => {
    setCategory("all");
    setRetailer("all");
    setMaxPrice(PRICE_CEILING);
    setInStockOnly(false);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header + search ── */}
      <Reveal className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <h1 className="text-title2 text-foreground">Shop</h1>
        <p className="mt-1 max-w-2xl text-footnote text-foreground-secondary">
          Compare what different sellers charge for the things you need, then buy wherever
          suits you. Prakriva doesn't sell any of it — prices are indicative and were last
          checked on {formattedCheckDate}.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-tertiary" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search — try “pregnancy pillow”, “stretch marks”, “iron tablets”"
              aria-label="Search products"
              className="pl-9"
            />
            {isSearching && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-foreground-tertiary transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            className="sm:hidden"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>

        {/* Category rail — the shelves, always reachable in one tap. The rail
            overflows on anything narrower than a desktop, so it fades at the
            right edge rather than ending on a half-drawn chip. */}
        <div className="relative mt-4 after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-10 after:bg-gradient-to-l after:from-card after:to-transparent">
          <div className="scroll-area -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <CategoryChip
            active={category === "all"}
            onClick={() => setCategory("all")}
            label="All"
          />
          {SHOP_CATEGORIES.map((c) => (
            <CategoryChip
              key={c.id}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
              label={c.label}
              Icon={CATEGORY_ICONS[c.id]}
            />
          ))}
          </div>
        </div>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* ── Filters ── */}
        <aside
          className={cn(
            "space-y-6 rounded-xl border border-border bg-card p-5 shadow-xs lg:block lg:h-fit",
            filtersOpen ? "block" : "hidden",
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-subhead font-semibold text-foreground">Filters</h2>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-caption1 text-primary hover:underline"
              >
                Reset
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-caption1 text-foreground-secondary">Seller</Label>
            <Select value={retailer} onValueChange={(v) => setRetailer(v as RetailerId | "all")}>
              <SelectTrigger aria-label="Filter by seller">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any seller</SelectItem>
                {RETAILER_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {RETAILERS[id].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <Label className="text-caption1 text-foreground-secondary">Up to</Label>
              <span className="text-caption1 tabular-nums text-foreground">
                {maxPrice >= PRICE_CEILING ? "Any price" : formatPrice(maxPrice)}
              </span>
            </div>
            <Slider
              value={[maxPrice]}
              min={250}
              max={PRICE_CEILING}
              step={250}
              onValueChange={([v]) => setMaxPrice(v)}
              aria-label="Maximum price"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="in-stock"
              checked={inStockOnly}
              onCheckedChange={(v) => setInStockOnly(v === true)}
            />
            <Label htmlFor="in-stock" className="text-footnote font-normal text-foreground">
              In stock only
            </Label>
          </div>
        </aside>

        {/* ── Results ── */}
        <div className="min-w-0 space-y-5">
          {/* Suggestions lead the landing state; a query replaces them. */}
          {!isSearching && !hasFilters && suggestions.length > 0 && (
            <Reveal index={1}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-headline text-foreground">Suggested for you</h2>
                <span className="text-caption1 text-foreground-tertiary">
                  Based on your stage of care
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {suggestions.map(({ product, reason }, i) => (
                  <Reveal key={product.id} index={i + 2}>
                    <ProductCard product={product} reason={reason} />
                  </Reveal>
                ))}
              </div>
            </Reveal>
          )}

          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-headline text-foreground">
              {isSearching ? `Results for “${query.trim()}”` : "Everything in the shop"}
              <span className="ml-2 text-caption1 font-normal tabular-nums text-foreground-secondary">
                {results.length} {results.length === 1 ? "item" : "items"}
              </span>
            </h2>
            <Select value={sort} onValueChange={(v) => setSort(v as ShopSort)}>
              <SelectTrigger className="w-[190px]" aria-label="Sort results">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_LABELS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {results.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card py-16 text-center">
              <Plate className="h-16 w-16 text-primary/60" />
              <div className="max-w-sm space-y-1.5 px-6">
                <h3 className="text-headline text-foreground">Nothing matched that</h3>
                <p className="text-footnote text-foreground-secondary">
                  {hasFilters
                    ? "Try widening the filters, or search for something else."
                    : "We only stock a curated list, so it's likely we just don't cover this yet."}
                </p>
              </div>
              {didYouMean.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 px-6">
                  {didYouMean.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setQuery(s)}
                      className="rounded-full border border-border px-3 py-1.5 text-caption1 text-foreground transition-colors hover:border-border-strong hover:bg-accent-soft"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {hasFilters && (
                <Button variant="outline" onClick={resetFilters}>
                  Reset filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((product, i) => (
                <Reveal key={product.id} index={Math.min(i, 8)}>
                  <ProductCard product={product} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function CategoryChip({
  active,
  onClick,
  label,
  Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  Icon?: (typeof CATEGORY_ICONS)[ShopCategory];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-caption1 font-medium transition-colors duration-150 ease-ios",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border text-foreground-secondary hover:border-border-strong hover:bg-accent-soft",
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

export default Shop;
