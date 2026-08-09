// Whether the current session may load fabricated demo data.
//
// Gated rather than always-on: a patient looking at her own tracker must never
// be shown, or be able to stumble into, made-up sleep and exercise history that
// looks like her own. Demo data is also never mirrored to Supabase — it lives
// in the local cache only (see `cacheLifestyleDay`).

/**
 * True in local development, or on any build when the URL carries `?demo=1`.
 *
 * The query-string escape hatch exists so a deployed preview can be walked
 * through with data in it; ordinary users never hit it, and the tracker shows a
 * prominent banner whenever demo data is loaded.
 */
export const isDemoModeAvailable = (): boolean => {
  if (import.meta.env.DEV) return true;

  try {
    return new URLSearchParams(window.location.search).get("demo") === "1";
  } catch {
    return false;
  }
};
