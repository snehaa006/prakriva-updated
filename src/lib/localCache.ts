// Small localStorage-backed cache so work in progress (a half-built meal plan,
// the food palette, a generated diet chart) survives a page refresh instead of
// being thrown away with component state.

const PREFIX = "prakriva:";

interface CacheEnvelope<T> {
  value: T;
  storedAt: number;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Private mode / disabled storage — caching is best effort.
    return null;
  }
}

/** Read a cached value, or `null` when missing, unreadable, or older than `maxAgeMs`. */
export function readCache<T>(key: string, maxAgeMs?: number): T | null {
  const store = storage();
  if (!store) return null;

  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return null;

    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (!envelope || typeof envelope.storedAt !== "number") return null;
    if (maxAgeMs !== undefined && Date.now() - envelope.storedAt > maxAgeMs) {
      store.removeItem(PREFIX + key);
      return null;
    }
    return envelope.value;
  } catch {
    return null;
  }
}

/** Write a value to the cache. Silently no-ops when storage is unavailable or full. */
export function writeCache<T>(key: string, value: T): void {
  const store = storage();
  if (!store) return;

  try {
    const envelope: CacheEnvelope<T> = { value, storedAt: Date.now() };
    store.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // Quota exceeded or non-serialisable value — nothing to do.
  }
}

export function clearCache(key: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/** Drop every cached entry whose key starts with `prefix` (without the namespace). */
export function clearCacheByPrefix(prefix: string): void {
  const store = storage();
  if (!store) return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && key.startsWith(PREFIX + prefix)) doomed.push(key);
    }
    doomed.forEach((key) => store.removeItem(key));
  } catch {
    // ignore
  }
}

/** Cache keys used across the app, kept in one place so they cannot drift. */
export const CACHE_KEYS = {
  foodDatabase: "food-database",
  selectedFoods: "selected-foods",
  recipeBuilderDraft: "recipe-builder-draft",
  dietChartDraft: "personalized-diet-chart-draft",
  dietChartViewerPatient: "diet-chart-viewer-patient",
  foodExplorerPantryPatient: "food-explorer-pantry-patient",
} as const;

/** A day, in ms — the default lifetime for cached in-progress work. */
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
