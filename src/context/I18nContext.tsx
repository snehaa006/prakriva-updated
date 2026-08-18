// App language, applied to the whole site.
//
// Two things happen when the language changes:
//
// 1. `t(key)` starts returning the hand-written translation for the app
//    chrome (see `src/i18n/translations.ts`).
// 2. The page translator (`src/i18n/pageTranslator.ts`) starts rewriting
//    everything else that is rendered, and keeps doing it as the user moves
//    around — so pages nobody has hand-translated still come out in the
//    chosen language, the way the browser's own translate bar behaves.
//
// The choice is persisted, so it survives a refresh, and it is applied to
// `<html lang>` / `<html dir>` so screen readers, fonts and right-to-left
// scripts behave.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { readCache, writeCache } from "@/lib/localCache";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  findLanguage,
  isLanguageCode,
  translate,
  type LanguageCode,
  type LanguageOption,
  type TranslationKey,
} from "@/i18n/translations";
import { startPageTranslation, type PageTranslatorHandle } from "@/i18n/pageTranslator";
import { primeLanguage } from "@/services/translationService";

const CACHE_KEY = "language";

interface I18nContextValue {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  /** Translate a key for the current language (app chrome only). */
  t: (key: TranslationKey) => string;
  /** Every language the picker offers. */
  languages: LanguageOption[];
  /** True while the page translator is waiting on the network. */
  isTranslating: boolean;
  /**
   * Whether this device has an explicit language choice stored.
   *
   * Settings uses it to decide whether the language saved on the account may
   * be applied: a new device should inherit the account's language, but a
   * choice made *here* must never be overwritten by a stale stored one.
   */
  hasDeviceChoice: boolean;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const readStoredLanguage = (): LanguageCode => {
  const cached = readCache<LanguageCode>(CACHE_KEY);
  return isLanguageCode(cached) ? cached : DEFAULT_LANGUAGE;
};

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<LanguageCode>(readStoredLanguage);
  const [hasDeviceChoice, setHasDeviceChoice] = useState(
    () => isLanguageCode(readCache<LanguageCode>(CACHE_KEY))
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const handleRef = useRef<PageTranslatorHandle | null>(null);

  // Keep the document in step, so screen readers announce the right language,
  // the browser picks sensible fonts and hyphenation, and Urdu/Arabic lay out
  // right-to-left.
  useEffect(() => {
    const option = findLanguage(language);
    document.documentElement.lang = language;
    document.documentElement.dir = option?.rtl ? "rtl" : "ltr";
  }, [language]);

  // One translator at a time. Switching language tears the previous one down,
  // which puts the English back before the new one starts — otherwise we would
  // be translating a translation.
  useEffect(() => {
    handleRef.current?.stop();
    handleRef.current = null;
    setIsTranslating(false);

    if (language === DEFAULT_LANGUAGE) return;

    primeLanguage(language);
    handleRef.current = startPageTranslation(language, setIsTranslating);

    return () => {
      handleRef.current?.stop();
      handleRef.current = null;
    };
  }, [language]);

  const setLanguage = useCallback((next: LanguageCode) => {
    if (!isLanguageCode(next)) return;
    setLanguageState(next);
    setHasDeviceChoice(true);
    writeCache(CACHE_KEY, next);
  }, []);

  const t = useCallback((key: TranslationKey) => translate(language, key), [language]);

  const value = useMemo(
    () => ({ language, setLanguage, t, languages: LANGUAGES, isTranslating, hasDeviceChoice }),
    [language, setLanguage, t, isTranslating, hasDeviceChoice]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useTranslation must be used within an I18nProvider");
  return context;
};
