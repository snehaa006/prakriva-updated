import * as React from "react";

import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-8",
  md: "h-12",
  lg: "h-16",
  xl: "h-24",
} as const;

export type LogoSize = keyof typeof sizeClasses;

export interface LogoProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /** Height of the logo. Defaults to `md`. */
  size?: LogoSize;
}

/**
 * App logo. Use this instead of hand-rolled brand markup so the mark stays
 * consistent across the patient, doctor and auth areas. The artwork already
 * includes the "Prakriva" wordmark, so don't pair it with the name in text —
 * pass `alt=""` where surrounding copy already names the brand.
 */
export const Logo = React.forwardRef<HTMLImageElement, LogoProps>(
  ({ size = "md", className, alt = "Prakriva", ...props }, ref) => (
    <img
      ref={ref}
      src="/logo.png"
      alt={alt}
      /* The artwork is a solid cream tile, so soften its corners everywhere. */
      className={cn(
        "w-auto object-contain rounded-md",
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
);
Logo.displayName = "Logo";
