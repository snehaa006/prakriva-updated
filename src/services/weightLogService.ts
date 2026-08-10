// Persistence for the weight log.
//
// Same local-first contract as the cycle and lifestyle logs: the reading is
// cached synchronously and then mirrored to `weight_logs`, so a weight curve
// survives a refresh, an offline week, and a project that has not applied
// `supabase/pcos_tracking.sql` yet.
//
// One reading per patient per day, upserted — weighing yourself twice in a
// morning corrects the day rather than adding a second point.

import { supabase } from "@/lib/supabase";
import { CACHE_KEYS, readCache, writeCache } from "@/lib/localCache";
import { sortWeights, type WeightEntry } from "@/lib/weightLog";

/** Postgres/PostgREST codes meaning "the table isn't there (yet)". */
const MISSING_TABLE_CODES = ["42P01", "PGRST205", "PGRST106"];

const isMissingTable = (error: { code?: string } | null) =>
  !!error && MISSING_TABLE_CODES.includes(error.code ?? "");

const cacheKey = (patientId: string) => `${CACHE_KEYS.weightLogs}:${patientId}`;

const normalise = (raw: unknown): WeightEntry | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return null;

  const weight = Number(r.weightKg);
  // 25–250 kg mirrors the signup field's bounds; anything outside is a typo
  // (a weight in pounds, a stray digit) and would distort every trend read
  // off it.
  if (!Number.isFinite(weight) || weight < 25 || weight > 250) return null;

  return {
    date: r.date,
    weightKg: Math.round(weight * 10) / 10,
    notes: typeof r.notes === "string" ? r.notes : "",
  };
};

export const readCachedWeights = (patientId: string): WeightEntry[] => {
  const cached = readCache<unknown[]>(cacheKey(patientId));
  if (!Array.isArray(cached)) return [];
  return sortWeights(cached.map(normalise).filter((e): e is WeightEntry => e !== null));
};

const writeCachedWeights = (patientId: string, entries: WeightEntry[]): void =>
  writeCache(cacheKey(patientId), entries);

/** Server wins where both sides have a day; cache-only days are kept. */
export const mergeWeights = (
  cached: WeightEntry[],
  remote: WeightEntry[]
): WeightEntry[] => {
  const byDate = new Map(cached.map((e) => [e.date, e]));
  for (const entry of remote) byDate.set(entry.date, entry);
  return sortWeights([...byDate.values()]);
};

interface WeightRow {
  log_date: string;
  weight_kg: number | string | null;
  notes: string | null;
}

const fromRow = (row: WeightRow): WeightEntry | null =>
  normalise({
    date: row.log_date,
    weightKg: Number(row.weight_kg),
    notes: row.notes ?? "",
  });

/** Server-side weight history for a patient, oldest first. */
export const fetchWeights = async (
  patientId: string,
  limit = 180
): Promise<WeightEntry[]> => {
  const { data, error } = await supabase
    .from("weight_logs")
    .select("log_date, weight_kg, notes")
    .eq("patient_id", patientId)
    .order("log_date", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }

  return sortWeights(
    ((data ?? []) as WeightRow[]).map(fromRow).filter((e): e is WeightEntry => e !== null)
  );
};

/** Cache first, then merged with Supabase, with the merge written back. */
export const loadWeights = async (
  patientId: string
): Promise<{ weights: WeightEntry[]; synced: boolean }> => {
  const cached = readCachedWeights(patientId);

  try {
    const merged = mergeWeights(cached, await fetchWeights(patientId));
    writeCachedWeights(patientId, merged);
    return { weights: merged, synced: true };
  } catch (error) {
    console.error("Could not sync weight logs; using cached copy:", error);
    return { weights: cached, synced: false };
  }
};

/**
 * Record one reading, cache first. Returns the new list and whether it was
 * mirrored, so the caller can show a working local chart either way.
 */
export const saveWeight = async (
  patientId: string,
  entry: WeightEntry
): Promise<{ weights: WeightEntry[]; synced: boolean }> => {
  const weights = mergeWeights(readCachedWeights(patientId), [entry]);
  writeCachedWeights(patientId, weights);

  try {
    const { error } = await supabase.from("weight_logs").upsert(
      {
        patient_id: patientId,
        log_date: entry.date,
        weight_kg: entry.weightKg,
        notes: entry.notes,
      },
      { onConflict: "patient_id,log_date" }
    );

    if (!error) return { weights, synced: true };
    if (isMissingTable(error)) return { weights, synced: false };
    throw new Error(error.message);
  } catch (error) {
    console.error("Could not save weight to Supabase:", error);
    return { weights, synced: false };
  }
};

/** Delete one day's reading, cache first. */
export const deleteWeight = async (
  patientId: string,
  date: string
): Promise<WeightEntry[]> => {
  const weights = readCachedWeights(patientId).filter((e) => e.date !== date);
  writeCachedWeights(patientId, weights);

  try {
    const { error } = await supabase
      .from("weight_logs")
      .delete()
      .eq("patient_id", patientId)
      .eq("log_date", date);
    if (error && !isMissingTable(error)) throw new Error(error.message);
  } catch (error) {
    console.error("Could not delete weight entry from Supabase:", error);
  }

  return weights;
};
