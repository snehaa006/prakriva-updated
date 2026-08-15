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
 * The shop has no product photography — Prakriva doesn't own these products
 * and shipping scraped retailer images would be both a licensing problem and a
 * maintenance one. So tiles are typographic, led by the category's own mark
 * rather than by a stock photo standing in for the real thing. It also keeps
 * the grid honest: the comparison here is about price and seller, and a photo
 * would imply we know more about the item than we do.
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
