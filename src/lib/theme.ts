// Light / dark / system theme.
//
// Tailwind is configured with `darkMode: ["class"]`, so the whole thing is a
// class on `<html>`. The Settings page has always had a theme dropdown; this
// is what makes choosing "Dark" actually darken the app, and what re-applies
// the choice on the next page load before anything renders.

import { readCache, writeCache } from "@/lib/localCache";

export type ThemeChoice = "light" | "dark" | "system";

const CACHE_KEY = "theme";

export const isThemeChoice = (value: unknown): value is ThemeChoice =>
  value === "light" || value === "dark" || value === "system";

/** The stored choice, defaulting to following the operating system. */
export const readTheme = (): ThemeChoice => {
  const cached = readCache<ThemeChoice>(CACHE_KEY);
  return isThemeChoice(cached) ? cached : "system";
};

const prefersDark = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

/** Put `theme` on the document. Does not persist — see `setTheme`. */
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
