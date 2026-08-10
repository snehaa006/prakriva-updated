// App language, applied for real.
//
// Like the theme, the Settings page has always had a language dropdown that
// changed nothing. This provider makes the choice actually drive the UI, and
// persists it so it survives a refresh.
//
// See src/i18n/translations.ts for what is and isn't translated — the coverage
// is deliberately partial and the Settings page says so.

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
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  translate,
  type LanguageCode,
  type TranslationKey,
} from "@/i18n/translations";

const CACHE_KEY = "language";

interface I18nContextValue {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  /** Translate a key for the current language. */
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const isSupported = (value: unknown): value is LanguageCode =>
  LANGUAGES.some((l) => l.code === value && l.available);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const cached = readCache<LanguageCode>(CACHE_KEY);
    return isSupported(cached) ? cached : DEFAULT_LANGUAGE;
  });

  // Keep the document in step, so screen readers announce the right language
  // and the browser picks sensible fonts and hyphenation.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: LanguageCode) => {
    if (!isSupported(next)) return; // never switch to a dictionary we don't have
    setLanguageState(next);
    writeCache(CACHE_KEY, next);
  }, []);

  const t = useCallback((key: TranslationKey) => translate(language, key), [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useTranslation must be used within an I18nProvider");
  return context;
};
