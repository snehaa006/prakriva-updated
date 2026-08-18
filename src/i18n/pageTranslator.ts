// Whole-page translation, at runtime, on the live DOM.
//
// A dictionary-per-string approach would mean touching every one of the app's
// pages and keeping thousands of keys in step forever — which is exactly why
// the previous attempts only ever translated the menus. This does what the
// browser's own "translate this page" does instead: walk the rendered DOM,
// collect the visible text, translate it and write it back.
//
// The parts that make it hold up in a React app:
//
// - A `MutationObserver` re-translates whatever React renders next, so the
//   language survives navigation, dialogs, and data arriving late.
// - Every node remembers the English it came from, so switching back to
//   English is exact rather than a second round of translation.
// - Cached phrases are applied synchronously, so a page you have already
//   visited never flashes English while a request is in flight.
// - Anything inside `[translate="no"]`, `.notranslate`, `<code>`, `<pre>` or
//   an SVG chart is left alone — names, code and axis labels should not be
//   machine-translated.

import {
  backoffRemainingMs,
  isTranslatable,
  lookup,
  normalizeText,
  primeLanguage,
  translateTexts,
} from "@/services/translationService";
import { DEFAULT_LANGUAGE, type LanguageCode } from "@/i18n/translations";

/** Elements whose text is never translated, along with everything inside them. */
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "CODE",
  "PRE",
  "SVG",
  "CANVAS",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "MATH",
]);

/** Attributes that hold user-visible prose. */
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "alt", "aria-label"] as const;

type TranslatableAttribute = (typeof TRANSLATABLE_ATTRIBUTES)[number];

/** What a node held before we touched it, and what we put there. */
interface Record_ {
  /** The original English, with its original whitespace. */
  raw: string;
  /** The normalized English, i.e. the phrase we looked up. */
  source: string;
  /** The normalized translation currently in the DOM. */
  output: string;
}

const shouldSkipElement = (element: Element): boolean => {
  if (SKIP_TAGS.has(element.tagName.toUpperCase())) return true;
  if (element.getAttribute("translate") === "no") return true;
  if (element.classList.contains("notranslate")) return true;
  return element.hasAttribute("data-no-translate");
};

/** Split `raw` into its leading whitespace, its content and its trailing whitespace. */
const padding = (raw: string): [string, string] => {
  const lead = raw.match(/^\s*/)?.[0] ?? "";
  const trail = raw.match(/\s*$/)?.[0] ?? "";
  return [lead, trail];
};

/** Rounds of "nothing came back" before we stop retrying on our own. */
const MAX_EMPTY_ROUNDS = 4;

/** Never retry faster than this, however short the service's backoff is. */
const RETRY_FLOOR_MS = 5_000;

export interface PageTranslatorHandle {
  /** Re-scan the page — used when a route renders new content. */
  refresh: () => void;
  /** Put the page back into English and stop observing. */
  stop: () => void;
}

/**
 * Start translating the document into `language`.
 *
 * Returns a handle whose `stop()` restores the original English. Calling this
 * with `"en"` is a no-op: English is what the app is written in.
 */
export const startPageTranslation = (
  language: LanguageCode,
  onBusyChange?: (busy: boolean) => void
): PageTranslatorHandle => {
  const textRecords = new WeakMap<Text, Record_>();
  const attributeRecords = new WeakMap<Element, Map<TranslatableAttribute, Record_>>();
  const touchedText = new Set<Text>();
  const touchedElements = new Set<Element>();

  let stopped = false;
  let pending = 0;
  let scanQueued: number | undefined;
  let retryTimer: number | undefined;
  let emptyRounds = 0;
  let observer: MutationObserver | undefined;

  const setBusy = (busy: boolean) => onBusyChange?.(busy);

  /** Walk `root`, returning the text nodes and attributes that need translating. */
  const collect = (): {
    nodes: Array<{ node: Text; source: string }>;
    attributes: Array<{ element: Element; attribute: TranslatableAttribute; source: string }>;
    phrases: Set<string>;
  } => {
    const nodes: Array<{ node: Text; source: string }> = [];
    const attributes: Array<{
      element: Element;
      attribute: TranslatableAttribute;
      source: string;
    }> = [];
    const phrases = new Set<string>();

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            return shouldSkipElement(node as Element)
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_ACCEPT;
          }
          return isTranslatable(node.nodeValue ?? "")
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      }
    );

    let current = walker.nextNode();
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) {
        const node = current as Text;
        const value = node.nodeValue ?? "";
        const normalized = normalizeText(value);
        const record = textRecords.get(node);

        // Already carrying our translation — nothing to do. Anything else
        // (a fresh node, or one React has just rewritten) is a new phrase.
        if (!record || record.output !== normalized) {
          nodes.push({ node, source: normalized });
          phrases.add(normalized);
        }
      } else {
        const element = current as Element;
        TRANSLATABLE_ATTRIBUTES.forEach((attribute) => {
          const value = element.getAttribute(attribute);
          if (!value || !isTranslatable(value)) return;

          const normalized = normalizeText(value);
          const record = attributeRecords.get(element)?.get(attribute);
          if (record && record.output === normalized) return;

          attributes.push({ element, attribute, source: normalized });
          phrases.add(normalized);
        });
      }
      current = walker.nextNode();
    }

    return { nodes, attributes, phrases };
  };

  /**
   * Write the translations we have.
   *
   * The observer is detached first: every write below is our own, and letting
   * it see them would queue a scan that finds nothing but costs a frame.
   */
  const apply = (
    nodes: Array<{ node: Text; source: string }>,
    attributes: Array<{ element: Element; attribute: TranslatableAttribute; source: string }>,
    translated: (phrase: string) => string | undefined
  ): boolean => {
    let applied = false;
    observer?.disconnect();

    nodes.forEach(({ node, source }) => {
      if (!node.isConnected) return;
      const output = translated(source);
      if (!output || output === source) return;

      const raw = node.nodeValue ?? "";
      const [lead, trail] = padding(raw);
      node.nodeValue = `${lead}${output}${trail}`;
      textRecords.set(node, { raw, source, output: normalizeText(output) });
      touchedText.add(node);
      applied = true;
    });

    attributes.forEach(({ element, attribute, source }) => {
      if (!element.isConnected) return;
      const output = translated(source);
      if (!output || output === source) return;

      const raw = element.getAttribute(attribute) ?? "";
      element.setAttribute(attribute, output);

      let records = attributeRecords.get(element);
      if (!records) {
        records = new Map();
        attributeRecords.set(element, records);
      }
      records.set(attribute, { raw, source, output: normalizeText(output) });
      touchedElements.add(element);
      applied = true;
    });

    observer?.takeRecords();
    observe();
    return applied;
  };

  /** One pass: apply what is cached, then fetch and apply the rest. */
  const scan = () => {
    if (stopped) return;

    const { nodes, attributes, phrases } = collect();
    if (phrases.size === 0) return;

    // Cached phrases first, synchronously — a revisited page should never
    // flash English.
    apply(nodes, attributes, (phrase) => lookup(phrase, language));

    const missing = [...phrases].filter((phrase) => lookup(phrase, language) === undefined);
    if (missing.length === 0) return;

    pending += 1;
    setBusy(true);

    void translateTexts(missing, language)
      .then((translations) => {
        if (stopped) return;

        if (translations.size === 0) {
          // Nothing came back — the network is down, or we are inside the
          // service's backoff. Come back and finish the page rather than
          // leaving it in two languages, but give up after a few rounds so an
          // offline tab is not retrying forever.
          emptyRounds += 1;
          if (emptyRounds <= MAX_EMPTY_ROUNDS) scheduleRetry();
          return;
        }

        emptyRounds = 0;
        // Re-collect: React may have re-rendered while the request was out, in
        // which case the nodes we found earlier are no longer in the document.
        const fresh = collect();
        apply(fresh.nodes, fresh.attributes, (phrase) =>
          translations.get(phrase) ?? lookup(phrase, language)
        );
      })
      .finally(() => {
        pending -= 1;
        if (pending === 0) setBusy(false);
      });
  };

  /** Try the page again once the service is willing to call out. */
  const scheduleRetry = () => {
    if (stopped || retryTimer !== undefined) return;
    retryTimer = window.setTimeout(
      () => {
        retryTimer = undefined;
        scan();
      },
      Math.max(RETRY_FLOOR_MS, backoffRemainingMs() + 500)
    );
  };

  /** Coalesce the bursts of mutations a React render produces into one scan. */
  const queueScan = () => {
    if (stopped || scanQueued !== undefined) return;
    // New content is a fresh chance to succeed, so a page that gave up on its
    // own retries starts trying again.
    emptyRounds = 0;
    scanQueued = window.setTimeout(() => {
      scanQueued = undefined;
      scan();
    }, 120);
  };

  const observe = () => {
    if (stopped || !observer) return;
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    });
  };

  const restore = () => {
    observer?.disconnect();

    touchedText.forEach((node) => {
      const record = textRecords.get(node);
      if (!record || !node.isConnected) return;
      // Only put English back where our translation is still what's shown —
      // if React has since rendered something else, that something else wins.
      if (normalizeText(node.nodeValue ?? "") === record.output) node.nodeValue = record.raw;
      textRecords.delete(node);
    });

    touchedElements.forEach((element) => {
      const records = attributeRecords.get(element);
      if (!records || !element.isConnected) return;
      records.forEach((record, attribute) => {
        if (normalizeText(element.getAttribute(attribute) ?? "") === record.output) {
          element.setAttribute(attribute, record.raw);
        }
      });
      attributeRecords.delete(element);
    });

    touchedText.clear();
    touchedElements.clear();
  };

  if (language === DEFAULT_LANGUAGE || typeof document === "undefined") {
    return { refresh: () => undefined, stop: () => undefined };
  }

  primeLanguage(language);
  observer = new MutationObserver(queueScan);
  observe();
  scan();

  return {
    refresh: queueScan,
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (scanQueued !== undefined) window.clearTimeout(scanQueued);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      restore();
      observer?.disconnect();
      observer = undefined;
      setBusy(false);
    },
  };
};
