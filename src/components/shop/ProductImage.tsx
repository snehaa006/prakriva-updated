import { useState } from "react";

import { cn } from "@/lib/utils";
import type { ShopProduct } from "@/types/shop";

import { CATEGORY_ICONS } from "./categoryIcons";

/**
 * The photograph on a shelf tile, and the thing that stands in when there
 * isn't one.
 *
 * A shop that shows a row of grey glyphs reads as a spreadsheet; a photograph
 * is what makes a shelf browsable, so every catalogue entry carries one and
 * the catalogue test enforces it. But an `<img>` is the one element on this
 * page that can fail after render — a missing file, a cache miss, an offline
 * device — so the category mark stays as the floor rather than being deleted:
 * `onError` swaps back to it and the tile still reads.
 *
 * While the file is in flight the frame sits in the app's own soft accent and
 * the picture fades in over it. Deliberately one colour for every tile rather
 * than each photo's average tone: the app holds a single hue on purpose (see
 * `lib/__tests__/brandPalette.test.ts`), and thirty-two sampled greys and
 * yellows behind a loading grid is exactly the drift that guard exists to
 * stop. It still keeps the grid from flashing card-shaped white holes.
 */
export function ProductImage({
  product,
  className,
  imgClassName,
  sizes = "(min-width: 1280px) 20rem, (min-width: 640px) 45vw, 90vw",
  eager = false,
}: {
  product: ShopProduct;
  /** Sizing and radius for the frame. The aspect ratio lives here too. */
  className?: string;
  imgClassName?: string;
  sizes?: string;
  /**
   * Load immediately rather than lazily. For the one image above the fold on
   * the product page — everything in a scrolling grid should stay lazy.
   */
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const Icon = CATEGORY_ICONS[product.category];
  const image = failed ? undefined : product.image;

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-accent-soft",
        "aspect-[4/3] w-full",
        className,
      )}
    >
      {image ? (
        <img
          src={image.src}
          alt={image.alt}
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300 ease-ios",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
        />
      ) : (
        // Decorative: the tile always names the product in text beside this,
        // so a screen reader announcing the shelf glyph too is just noise.
        <span className="flex h-full w-full items-center justify-center text-primary/70">
          <Icon className="h-8 w-8" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
