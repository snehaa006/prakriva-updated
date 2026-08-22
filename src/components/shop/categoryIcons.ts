import {
  Activity,
  Baby,
  BedDouble,
  Droplets,
  HeartPulse,
  Milk,
  Pill,
  Shirt,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type { ShopCategory } from "@/types/shop";

/**
 * A glyph per shelf.
 *
 * Two jobs. It labels the category rail and the filter chips, where a word
 * plus a mark is quicker to hit than a word alone. And it is the floor under
 * the product photography: `ProductImage` falls back to the shelf's glyph when
 * a picture is missing or fails to load, so a tile degrades to something that
 * still reads rather than to an empty frame.
 *
 * It is deliberately *not* the product's own identity. Prakriva doesn't own
 * these products, so the photos in `public/shop` are stock shots of the kind
 * of thing — see `ProductImage` in `types/shop.ts` for why they are ours and
 * served locally rather than hot-linked from a retailer.
 */
export const CATEGORY_ICONS: Record<ShopCategory, LucideIcon> = {
  "sleep-comfort": BedDouble,
  "maternity-wear": Shirt,
  supplements: Pill,
  "skin-body": Sparkles,
  "nursing-feeding": Milk,
  monitoring: HeartPulse,
  "intimate-care": Droplets,
  "baby-essentials": Baby,
  movement: Activity,
};
