import * as React from "react";

import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-8",
  md: "h-12",
  lg: "h-16",
  xl: "h-24",
} as const;

export type LogoSize = keyof typeof sizeClasses;

/**
 * Which artwork to draw.
 *
 * - `badge` — the circular mark with the wordmark baked into it, on its own
 *   cream tile. This is the app-chrome logo: sidebars, mobile headers, favicon.
 * - `wordmark` — "Prakriva" set in the brand serif, cream, transparent
 *   background.
 * - `butterfly` — the mark on its own: wings drawn as loops around an expecting
 *   figure. Pairs above the wordmark in the hero lockup.
 *
 * `wordmark` and `butterfly` are both cream on transparent. They are built to
 * sit *on* something — the floral hero, a dark section — and they disappear
 * against a light surface, so don't reach for either one in app chrome.
 */
export type LogoVariant = "badge" | "wordmark" | "butterfly";

const sources: Record<LogoVariant, string> = {
  badge: "/logo.png",
  wordmark: "/logo-wordmark.png",
  butterfly: "/logo-butterfly.png",
};

export interface LogoProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /** Height of the logo. Defaults to `md`. */
  size?: LogoSize;
  /** Which artwork to draw. Defaults to `badge`. */
  variant?: LogoVariant;
}

/**
 * App logo. Use this instead of hand-rolled brand markup so the mark stays
 * consistent across the patient, doctor and auth areas. Both artworks already
 * include the "Prakriva" wordmark, so don't pair either with the name in text —
 * pass `alt=""` where surrounding copy already names the brand.
 */
export const Logo = React.forwardRef<HTMLImageElement, LogoProps>(
  ({ size = "md", variant = "badge", className, alt = "Prakriva", ...props }, ref) => (
    <img
      ref={ref}
      src={sources[variant]}
      alt={alt}
      className={cn(
        "w-auto object-contain",
        /* The badge artwork is a solid cream tile, so soften its corners
           everywhere. The wordmark is transparent and must not be clipped. */
        variant === "badge" && "rounded-md",
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
);
Logo.displayName = "Logo";
