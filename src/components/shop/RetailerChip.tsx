import { Zap } from "lucide-react";

import { RETAILERS, type RetailerKind } from "@/lib/shop/retailers";
import { cn } from "@/lib/utils";
import type { RetailerId } from "@/types/shop";

/**
 * Shading by what kind of storefront it is, not by the seller's brand colour.
 *
 * The app holds one hue on purpose (see `lib/__tests__/brandPalette.test.ts`),
 * so a row of Amazon-amber and Blinkit-yellow chips is off the table — and it
 * would be the wrong cue anyway. What actually separates these rows for a
 * patient is whether the thing arrives tonight or on Thursday, so that is what
 * the tint encodes; the monogram tells the sellers apart.
 */
const KIND_TINT: Record<RetailerKind, string> = {
  "quick-commerce": "bg-accent-soft text-accent-soft-foreground",
  marketplace: "bg-muted text-foreground-secondary",
  brand: "border border-border text-foreground-tertiary",
};

/**
 * A seller, named and tinted.
 *
 * The comparison table is a list of rows that differ only in a word and a
 * number, which is exactly the shape a reader skims past. A two-letter
 * monogram gives each row an anchor she can find again after looking away,
 * without pasting in logos we have no licence to use.
 */
export function RetailerChip({
  retailer,
  size = "md",
  className,
}: {
  retailer: RetailerId;
  size?: "sm" | "md";
  className?: string;
}) {
  const { monogram, kind } = RETAILERS[retailer];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md font-semibold uppercase tracking-wide",
        size === "sm" ? "h-6 w-6 text-caption2" : "h-9 w-9 text-caption1",
        KIND_TINT[kind],
        className,
      )}
    >
      {monogram}
    </span>
  );
}

/**
 * "In minutes" — the reason a quick-commerce row can be the right answer while
 * being the dearest one on the page.
 */
export function QuickDeliveryBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5",
        "text-caption2 font-medium text-accent-soft-foreground",
        className,
      )}
    >
      <Zap className="h-3 w-3" aria-hidden="true" />
      In minutes
    </span>
  );
}
