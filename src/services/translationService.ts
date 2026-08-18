// Machine translation for arbitrary UI text.
//
// The app used to have a language dropdown that changed nothing, then a
// hand-written dictionary that covered only the menus. Neither made the site
// multilingual: a patient who reads Tamil still met an English dashboard.
//
// This service translates *any* string on demand, so the page translator
// (`src/i18n/pageTranslator.ts`) can walk the rendered DOM and swap every
// visible phrase — the "Google Translate the whole site" behaviour, but
// running inside the app so it survives navigation and re-renders.
//
// Three things keep it usable rather than merely possible:
//
// - **Curated phrases win.** Anything in `src/i18n/translations.ts` is used
//   verbatim, so navigation and settings read as written, not as guessed.
// - **Everything is cached**, in memory and in localStorage, keyed by
//   language. A page you have already seen re-translates instantly and
//   offline; only genuinely new text costs a request.
// - **Failures are quiet and bounded.** If the translation endpoint is
//   unreachable the text simply stays English, and we back off instead of
//   retrying every render.

import { readCache, writeCache } from "@/lib/localCache";
import {
  DEFAULT_LANGUAGE,
  curatedPhrases,
  type LanguageCode,
} from "@/i18n/translations";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

/** localStorage key holding the phrase cache for one language. */
const cacheKey = (language: LanguageCode) => `translations:${language}`;

/**
 * Cap on cached phrases per language. Large enough for every page of the app
 * several times over, small enough to stay well inside a localStorage quota.
 */
const MAX_CACHED_PHRASES = 6000;

/** Roughly how much text goes in one request, in characters. */
const CHUNK_CHARS = 1200;

/** Requests in flight at once. Keeps a first paint from opening 30 sockets. */
const MAX_CONCURRENT = 4;

/** How long to stop calling the network after a failure. */
const BACKOFF_MS = 60_000;

/**
 * How long to wait for one request.
 *
 * A network that blocks the translation endpoint tends to hang the connection
 * rather than refuse it, and a hung request holds up the fallback behind it —
 * on such a network an untimed request turned "translate this page" into two
 * minutes of English. These are small requests; if one is not answered in a
 * few seconds it is not going to be.
 */
const REQUEST_TIMEOUT_MS = 6_000;

/** Which provider worked last, remembered across sessions. */
const PROVIDER_CACHE_KEY = "translation-provider";

type PhraseMap = Map<string, string>;

const memory = new Map<LanguageCode, PhraseMap>();
const loaded = new Set<LanguageCode>();
const inFlight = new Map<string, Promise<void>>();
let backoffUntil = 0;
let persistTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * The provider that worked last, tried first from then on and remembered
 * across reloads.
 *
 * Without this, a network that blocks the public endpoint pays a failed
 * request — and its timeout — for every batch on every page, which is the
 * difference between "translates a second late" and "translates eventually".
 */
let preferredProvider: string | null = readCache<string>(PROVIDER_CACHE_KEY);

/** Fetch with a deadline: an unanswered request must not block the fallback. */
const fetchWithTimeout = async (
  input: string,
  init?: RequestInit
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Collapse whitespace so the same phrase is one cache entry however JSX
 * happened to indent it, and so batched requests can use newlines as the
 * record separator.
 */
export const normalizeText = (text: string): string => text.replace(/\s+/g, " ").trim();

/** Text worth sending: has a letter in it, and isn't a wall of markup. */
export const isTranslatable = (text: string): boolean => {
  const value = normalizeText(text);
  if (value.length === 0 || value.length > 2000) return false;
  return /\p{L}{2,}/u.test(value);
};

const store = (language: LanguageCode): PhraseMap => {
  let map = memory.get(language);
  if (!map) {
    map = new Map();
    memory.set(language, map);
  }
  return map;
};

/**
 * Load the persisted cache and the curated dictionary for a language.
 *
 * Curated phrases are written last so a hand-checked phrase always beats a
 * machine-translated one cached earlier.
 */
export const primeLanguage = (language: LanguageCode): void => {
  if (language === DEFAULT_LANGUAGE || loaded.has(language)) return;
  loaded.add(language);

  const map = store(language);
  const cached = readCache<Record<string, string>>(cacheKey(language));
  if (cached) {
    Object.entries(cached).forEach(([source, translated]) => {
      if (typeof translated === "string") map.set(source, translated);
    });
  }

  Object.entries(curatedPhrases(language)).forEach(([source, translated]) => {
    map.set(normalizeText(source), translated);
  });
};

const persistSoon = (language: LanguageCode): void => {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const map = store(language);
    // Oldest entries go first when the cap is hit — Map iterates in insertion
    // order, so the tail is what the user has seen most recently.
    const entries = [...map.entries()].slice(-MAX_CACHED_PHRASES);
    writeCache(cacheKey(language), Object.fromEntries(entries));
  }, 1500);
};

/** A translation already known for this language, without touching the network. */
export const lookup = (text: string, language: LanguageCode): string | undefined => {
  if (language === DEFAULT_LANGUAGE) return undefined;
  primeLanguage(language);
  return store(language).get(normalizeText(text));
};

/** Group phrases into request-sized batches. */
const chunk = (texts: string[]): string[][] => {
  const chunks: string[][] = [];
  let current: string[] = [];
  let size = 0;

  texts.forEach((text) => {
    if (current.length > 0 && size + text.length > CHUNK_CHARS) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(text);
    size += text.length + 1;
  });

  if (current.length > 0) chunks.push(current);
  return chunks;
};

interface Provider {
  name: string;
  translate: (texts: string[], target: LanguageCode) => Promise<string[]>;
}

/**
 * Google's public translate endpoint — the same one the Chrome "translate this
 * page" bar uses. It is CORS-enabled and needs no key, which is what makes
 * whole-site translation possible from the browser with no infrastructure.
 *
 * Records are newline-separated: the response echoes each source segment, so a
 * response whose line count doesn't match the request is treated as unusable
 * rather than silently misaligned.
 */
const googleProvider: Provider = {
  name: "google",
  translate: async (texts, target) => {
    const params = new URLSearchParams({
      client: "gtx",
      sl: "en",
      tl: target,
      dt: "t",
      q: texts.join("\n"),
    });

    const response = await fetchWithTimeout(
      `https://translate.googleapis.com/translate_a/single?${params.toString()}`
    );
    if (!response.ok) throw new Error(`translate: HTTP ${response.status}`);

    const payload = (await response.json()) as [
      Array<[string, string, ...unknown[]]> | null,
      ...unknown[]
    ];
    const segments = payload?.[0];
    if (!Array.isArray(segments)) throw new Error("translate: unexpected response");

    const lines = segments
      .map((segment) => (Array.isArray(segment) ? segment[0] ?? "" : ""))
      .join("")
      .split("\n");

    if (lines.length !== texts.length) {
      throw new Error(
        `translate: got ${lines.length} lines for ${texts.length} phrases`
      );
    }
    return lines.map((line) => line.trim());
  },
};

/**
 * The project's own Flask backend, used when the public endpoint is blocked
 * (some corporate and campus networks filter it). Optional by design: if the
 * backend isn't running, this just fails and the text stays English.
 */
const backendProvider: Provider = {
  name: "backend",
  translate: async (texts, target) => {
    const response = await fetchWithTimeout(`${API_BASE}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, target, source: "en" }),
    });
    if (!response.ok) throw new Error(`translate: backend HTTP ${response.status}`);

    const payload = (await response.json()) as { translations?: unknown };
    const translations = payload?.translations;
    if (!Array.isArray(translations) || translations.length !== texts.length) {
      throw new Error("translate: backend returned an unusable payload");
    }
    return translations.map((value) => String(value));
  },
};

const providers: Provider[] = [googleProvider, backendProvider];

/** Providers to try, starting with whichever one worked last. */
const orderedProviders = (): Provider[] => {
  const preferred = providers.find((provider) => provider.name === preferredProvider);
  if (!preferred) return providers;
  return [preferred, ...providers.filter((provider) => provider !== preferred)];
};

const rememberProvider = (provider: Provider): void => {
  if (preferredProvider === provider.name) return;
  preferredProvider = provider.name;
  writeCache(PROVIDER_CACHE_KEY, provider.name);
};

/** Translate one batch, trying each provider in turn. */
const translateChunk = async (
  texts: string[],
  target: LanguageCode
): Promise<string[] | null> => {
  for (const provider of orderedProviders()) {
    try {
      const translations = await provider.translate(texts, target);
      rememberProvider(provider);
      return translations;
    } catch (error) {
      // A misaligned batch is worth one retry one phrase at a time; a network
      // failure is not, so only the first provider gets that treatment.
      if (provider === googleProvider && texts.length > 1) {
        try {
          const translations = await Promise.all(
            texts.map(async (text) => (await provider.translate([text], target))[0])
          );
          rememberProvider(provider);
          return translations;
        } catch {
          // fall through to the next provider
        }
      }
      console.warn(`[i18n] ${provider.name} translation failed:`, error);
    }
  }
  return null;
};

/** Run `tasks` with a ceiling on how many are in flight at once. */
const runPooled = async (tasks: Array<() => Promise<void>>): Promise<void> => {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(MAX_CONCURRENT, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      await task();
    }
  });
  await Promise.all(workers);
};

/**
 * Translate `texts` into `target`, returning every translation now known.
 *
 * Cached phrases come back immediately; the rest are fetched. Anything that
 * could not be translated is simply absent from the map — callers leave those
 * strings in English.
 */
export const translateTexts = async (
  texts: string[],
  target: LanguageCode
): Promise<Map<string, string>> => {
  const result = new Map<string, string>();
  if (target === DEFAULT_LANGUAGE) return result;

  primeLanguage(target);
  const map = store(target);

  const missing: string[] = [];
  const seen = new Set<string>();

  texts.forEach((raw) => {
    const text = normalizeText(raw);
    if (!isTranslatable(text) || seen.has(text)) return;
    seen.add(text);

    const hit = map.get(text);
    if (hit !== undefined) {
      result.set(text, hit);
      return;
    }
    // Another caller is already fetching this one — skip it here and pick it
    // up on the next pass rather than requesting it twice.
    if (!inFlight.has(`${target}|${text}`)) missing.push(text);
  });

  if (missing.length === 0 || Date.now() < backoffUntil) return result;

  const batches = chunk(missing);
  const tasks = batches.map((batch) => async () => {
    const key = batch.map((text) => `${target}|${text}`);
    const pending = translateChunk(batch, target).then((translations) => {
      if (!translations) {
        backoffUntil = Date.now() + BACKOFF_MS;
        return;
      }
      backoffUntil = 0;
      batch.forEach((text, index) => {
        const translated = translations[index];
        if (!translated) return;
        map.set(text, translated);
        result.set(text, translated);
      });
      persistSoon(target);
    });

    key.forEach((k) => inFlight.set(k, pending.then(() => undefined)));
    try {
      await pending;
    } finally {
      key.forEach((k) => inFlight.delete(k));
    }
  });

  await runPooled(tasks);
  return result;
};

/**
 * How long until translation is worth attempting again, in ms.
 *
 * Zero when nothing is wrong. The page translator uses it to come back and
 * finish a page that a network blip left half-translated, instead of leaving
 * it in two languages until something else happens to re-render.
 */
export const backoffRemainingMs = (): number => Math.max(0, backoffUntil - Date.now());

/** Test seam: forget every cached translation and any active backoff. */
export const resetTranslationCache = (): void => {
  memory.clear();
  loaded.clear();
  inFlight.clear();
  backoffUntil = 0;
  preferredProvider = null;
  if (persistTimer) clearTimeout(persistTimer);
};
