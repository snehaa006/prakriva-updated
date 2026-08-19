// Light / dark / system theme.
//
// Tailwind is configured with `darkMode: ["class"]`, so the whole thing is a
// class on `<html>`. The Settings page has always had a theme dropdown; this
// is what makes choosing "Dark" actually darken the app, and what re-applies
// the choice on the next page load before anything renders.
//
// **The default is light, not "system".** Prakriva is a light app — that is
// what it is designed and reviewed in — and defaulting to the operating
// system's preference silently turned it dark for everyone whose laptop is in
// dark mode, without them ever asking for it. Following the OS is still on
// offer, but it is a choice now rather than the starting point.

import { readCache, writeCache } from "@/lib/localCache";

export type ThemeChoice = "light" | "dark" | "system";

const CACHE_KEY = "theme";

export const isThemeChoice = (value: unknown): value is ThemeChoice =>
  value === "light" || value === "dark" || value === "system";

/** The theme used until someone picks one. */
export const DEFAULT_THEME: ThemeChoice = "light";

/** The stored choice, or the light default. */
export const readTheme = (): ThemeChoice => {
  const cached = readCache<ThemeChoice>(CACHE_KEY);
  return isThemeChoice(cached) ? cached : DEFAULT_THEME;
};

const prefersDark = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

/**
 * Put `theme` on the document. Does not persist — see `setTheme`.
 *
 * `colorScheme` is set alongside the class so native controls (scrollbars,
 * date pickers, selects) match, and — on light — so a browser that auto-darkens
 * silent pages leaves this one alone. index.html carries the same declaration
 * as a meta tag, which covers the moment before this code runs.
 */
export const applyTheme = (theme: ThemeChoice): void => {
  if (typeof document === "undefined") return;
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
};

/** Store and apply `theme`. */
export const setTheme = (theme: ThemeChoice): void => {
  writeCache(CACHE_KEY, theme);
  applyTheme(theme);
};

/**
 * Apply the stored theme and keep "System" honest by following the OS when it
 * changes. Returns an unsubscribe function.
 */
export const initTheme = (): (() => void) => {
  applyTheme(readTheme());

  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (readTheme() === "system") applyTheme("system");
  };

  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
