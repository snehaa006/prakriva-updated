// Light / dark / system theme, applied for real.
//
// The Settings page has offered a Theme dropdown since the start, but nothing
// consumed it — picking "Dark" set a piece of component state and no more. This
// provider is what makes it do something: it toggles the `dark` class on
// <html>, which is what `darkMode: ["class"]` in tailwind.config.ts and the
// `.dark` variable block in index.css have always been waiting for.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { readCache, writeCache } from "@/lib/localCache";

export type ThemePreference = "light" | "dark" | "system";

/** What is actually on screen once "system" has been resolved. */
export type ResolvedTheme = "light" | "dark";

const CACHE_KEY = "theme";

interface ThemeContextValue {
  /** What the user chose, including "system". */
  theme: ThemePreference;
  /** What that currently resolves to. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const prefersDark = (): boolean => {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
};

const resolve = (theme: ThemePreference): ResolvedTheme =>
  theme === "system" ? (prefersDark() ? "dark" : "light") : theme;

/** Applied outside React so the class lands before the first paint too. */
const applyTheme = (resolved: ResolvedTheme) => {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved; // native controls + scrollbars follow
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemePreference>(
    () => readCache<ThemePreference>(CACHE_KEY) ?? "system"
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolve(theme));

  useEffect(() => {
    const next = resolve(theme);
    setResolvedTheme(next);
    applyTheme(next);
  }, [theme]);

  // On "system", follow the OS if it changes while the app is open.
  useEffect(() => {
    if (theme !== "system") return;
    let media: MediaQueryList;
    try {
      media = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }

    const onChange = () => {
      const next = resolve("system");
      setResolvedTheme(next);
      applyTheme(next);
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    writeCache(CACHE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
