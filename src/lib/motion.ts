// src/lib/motion.ts
// The one place that decides how a floating surface arrives.
//
// Menus, popovers, selects, tooltips and hover cards are all positioned by the
// same duplicated `useFloatingPosition` hook: it mounts the surface hidden,
// asks floating-ui where it goes, and only then makes it visible. That is
// correct — measuring a surface after painting it in the wrong place is what
// produces the one-frame flicker — but it also meant every one of these
// appeared as a hard cut.
//
// Two things are needed to fix that, and both are the same in all seven files:
//
//   * the entrance has to start when the surface becomes *visible*, not when
//     it mounts, or the first frames of it play behind `visibility: hidden`;
//   * it has to grow out of the edge nearest whatever was clicked, which means
//     the transform origin follows the resolved placement rather than being a
//     fixed `center`.

import type { CSSProperties } from "react";

/**
 * The Tailwind `origin-*` class for a floating-ui placement, so a surface
 * expands away from its trigger rather than out of its own middle.
 *
 * Written as whole class names on purpose — Tailwind scans source text, so a
 * composed `origin-${side}` would never be generated.
 */
export function surfaceOrigin(placement: string): string {
  const [side, align] = placement.split("-");

  if (side === "top") {
    if (align === "start") return "origin-bottom-left";
    if (align === "end") return "origin-bottom-right";
    return "origin-bottom";
  }
  if (side === "left") {
    if (align === "start") return "origin-top-right";
    if (align === "end") return "origin-bottom-right";
    return "origin-right";
  }
  if (side === "right") {
    if (align === "start") return "origin-top-left";
    if (align === "end") return "origin-bottom-left";
    return "origin-left";
  }
  // bottom, and anything unrecognised
  if (align === "start") return "origin-top-left";
  if (align === "end") return "origin-top-right";
  return "origin-top";
}

/**
 * Entrance classes for a floating surface, given its placement and the style
 * object `useFloatingPosition` returned.
 *
 * Empty while the surface is still hidden — the animation class only lands on
 * the render that reveals it, which is what makes the keyframes play from
 * their first frame instead of from wherever they happened to be.
 *
 * `flip()` can move a surface to the opposite side after this origin is
 * chosen; the result is a surface that grows from the wrong edge by a few
 * pixels of scale, which is not worth a second measurement pass to correct.
 */
export function floatingSurfaceMotion(placement: string, styles: CSSProperties): string {
  if (styles.visibility === "hidden") return "";
  return `${surfaceOrigin(placement)} animate-surface-in`;
}
