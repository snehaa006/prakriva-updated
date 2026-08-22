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
 * - `butterfly` (default) — the mark: wings drawn as loops around an expecting
 *   figure. This is the logo. It stands alone in app chrome and pairs above
 *   the wordmark in the hero lockup.
 * - `wordmark` — "Prakriva" set in the brand serif. Use it where the name
 *   itself has to be legible, not as a substitute for the mark.
 * - `badge` — the older circular mark on its own cream tile, wordmark baked
 *   in. Kept for anything still pointing at `/logo.png`; prefer `butterfly`.
 */
export type LogoVariant = "butterfly" | "wordmark" | "badge";

/**
 * How the artwork is painted.
 *
 * - `ink` (default) — the mark is drawn in `currentColor`, so it takes the
 *   colour of whatever it sits in. Set that with a text class on the element.
 * - `artwork` — the PNG exactly as supplied: a pale cream mark on transparent.
 *   Right on the hero photograph and the olive sections, invisible on cream.
 *
 * `ink` works by using the PNG as a CSS mask rather than an `<img>`. Both files
 * are a single opaque shape on a fully transparent ground, so the alpha channel
 * *is* the silhouette — masking recolours the mark exactly, at any size, with
 * no second copy of the artwork to keep in sync. If either file is ever
 * redrawn with more than one colour in it, `ink` stops being a valid treatment
 * and those call sites need `artwork` plus artwork that suits a light surface.
 */
export type LogoTone = "ink" | "artwork";

const sources: Record<LogoVariant, string> = {
  butterfly: "/logo-butterfly.png",
  wordmark: "/logo-wordmark.png",
  badge: "/logo.png",
};

/**
 * Intrinsic aspect ratios. A masked element has no intrinsic size — unlike an
 * `<img>`, nothing tells the box how wide to be — so the ratio has to be
 * declared here or every `ink` logo collapses to a square.
 */
const ratios: Record<LogoVariant, string> = {
  butterfly: "936 / 676",
  wordmark: "4344 / 1452",
  badge: "288 / 266",
};

export interface LogoProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /** Height of the logo. Defaults to `md`. */
  size?: LogoSize;
  /** Which artwork to draw. Defaults to `butterfly`. */
  variant?: LogoVariant;
  /** How to paint it. Defaults to `ink`. */
  tone?: LogoTone;
}

/**
 * App logo. Use this instead of hand-rolled brand markup so the mark stays
 * consistent across the patient, doctor and auth areas.
 *
 * The butterfly is the logo; reach for `wordmark` only where the name has to
 * be read. Where both appear together the mark goes above the name, and only
 * one of them should carry the `alt` — otherwise a screen reader says
 * "Prakriva" twice in a row.
 */
export const Logo = React.forwardRef<HTMLImageElement, LogoProps>(
  (
    { size = "md", variant = "butterfly", tone = "ink", className, alt = "Prakriva", ...props },
    ref,
  ) => {
    // The badge is a full-colour tile, so there is no single silhouette to
    // recolour; it is always drawn as supplied.
    if (tone === "artwork" || variant === "badge") {
      return (
        <img
          ref={ref}
          src={sources[variant]}
          alt={alt}
          className={cn(
            "w-auto object-contain",
            // The badge's cream tile needs its corners softened; the
            // transparent artworks must not be clipped.
            variant === "badge" && "rounded-md",
            sizeClasses[size],
            className,
          )}
          {...props}
        />
      );
    }

    const { style, ...rest } = props;
    const mask = `url(${sources[variant]}) center / contain no-repeat`;

    return (
      <span
        // A mask is painted background, not an image element, so the role and
        // label have to be stated. An empty `alt` means decorative, and the
        // element leaves the accessibility tree entirely rather than
        // announcing itself as an unlabelled image.
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={cn("inline-block shrink-0 bg-current", sizeClasses[size], className)}
        style={{
          aspectRatio: ratios[variant],
          WebkitMask: mask,
          mask,
          ...style,
        }}
        {...(rest as React.HTMLAttributes<HTMLSpanElement>)}
      />
    );
  },
) as React.ForwardRefExoticComponent<LogoProps & React.RefAttributes<HTMLImageElement>>;
Logo.displayName = "Logo";
