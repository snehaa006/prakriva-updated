// Persistence for the PCOS track's period log.
//
// Local-first, for the same reason `lifestyleLogService` is: a cycle history
// is the patient's own long-running record, and losing it to a flaky
// connection — or to a `menstrual_cycle_logs` table that has not been created
// in this project yet — would be worse than not offering the tracker at all.
// Every write goes to localStorage synchronously and is then mirrored to
// Supabase; reads merge the two, preferring the server where both have an
// entry so a second device wins over a stale cache.

import { supabase } from "@/lib/supabase";
import { CACHE_KEYS, readCache, writeCache } from "@/lib/localCache";
import {
  FLOW_INTENSITIES,
  CYCLE_SYMPTOMS,
  type CycleSymptom,
  type FlowIntensity,
  type MissedMonth,
  type PeriodEntry,
} from "@/lib/cycleTracking";

/** Postgres/PostgREST codes meaning "the table isn't there (yet)". */
const MISSING_TABLE_CODES = ["42P01", "PGRST205", "PGRST106"];

const isMissingTable = (error: { code?: string } | null) =>
  !!error && MISSING_TABLE_CODES.includes(error.code ?? "");

const periodsKey = (patientId: string) => `${CACHE_KEYS.cycleLogs}:${patientId}`;
const missedKey = (patientId: string) =>
  `${CACHE_KEYS.missedCycleMonths}:${patientId}`;

const VALID_SYMPTOMS = new Set(CYCLE_SYMPTOMS.map((s) => s.value));

/** A stable id for a new entry, without pulling in a uuid dependency. */
export const newEntryId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `period-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/** Coerce an unknown (cached JSON, or a Supabase row) into a valid entry. */
const normalisePeriod = (raw: unknown): PeriodEntry | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.startDate))
    return null;

  const flow = r.flow as FlowIntensity;
  const symptoms = Array.isArray(r.symptoms)
    ? (r.symptoms.filter(
        (s): s is CycleSymptom => typeof s === "string" && VALID_SYMPTOMS.has(s as CycleSymptom)
      ) as CycleSymptom[])
    : [];

  return {
    id: typeof r.id === "string" && r.id ? r.id : newEntryId(),
    startDate: r.startDate,
    endDate:
      typeof r.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.endDate)
        ? r.endDate
        : null,
    flow: FLOW_INTENSITIES.includes(flow) ? flow : null,
    symptoms,
    notes: typeof r.notes === "string" ? r.notes : "",
  };
};

const normaliseMissed = (raw: unknown): MissedMonth | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.month !== "string" || !/^\d{4}-\d{2}$/.test(r.month)) return null;
  return { month: r.month, notes: typeof r.notes === "string" ? r.notes : "" };
};

// --- Cache ------------------------------------------------------------------

export const readCachedPeriods = (patientId: string): PeriodEntry[] => {
  const cached = readCache<unknown[]>(periodsKey(patientId));
  if (!Array.isArray(cached)) return [];
  return cached
    .map(normalisePeriod)
    .filter((e): e is PeriodEntry => e !== null)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
};

export const readCachedMissedMonths = (patientId: string): MissedMonth[] => {
  const cached = readCache<unknown[]>(missedKey(patientId));
  if (!Array.isArray(cached)) return [];
  return cached
    .map(normaliseMissed)
    .filter((m): m is MissedMonth => m !== null)
    .sort((a, b) => a.month.localeCompare(b.month));
};

const writeCachedPeriods = (patientId: string, entries: PeriodEntry[]): void =>
  writeCache(periodsKey(patientId), entries);

const writeCachedMissedMonths = (patientId: string, months: MissedMonth[]): void =>
  writeCache(missedKey(patientId), months);

/** Server wins where both sides have an entry; cache-only entries are kept. */
export const mergePeriods = (
  cached: PeriodEntry[],
  remote: PeriodEntry[]
): PeriodEntry[] => {
  // Keyed by start date rather than id: the same period logged on two devices
  // gets two ids but is one bleed, and showing it twice would double-count the
  // cycle history everything else is derived from.
  const byStart = new Map(cached.map((e) => [e.startDate, e]));
  for (const entry of remote) byStart.set(entry.startDate, entry);
  return [...byStart.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
};

export const mergeMissedMonths = (
  cached: MissedMonth[],
  remote: MissedMonth[]
): MissedMonth[] => {
  const byMonth = new Map(cached.map((m) => [m.month, m]));
  for (const month of remote) byMonth.set(month.month, month);
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
};

// --- Supabase ---------------------------------------------------------------

interface PeriodRow {
  id: string;
  start_date: string;
  end_date: string | null;
  flow: string | null;
  symptoms: string[] | null;
  notes: string | null;
}

interface MissedRow {
  month: string;
  notes: string | null;
}

const fromPeriodRow = (row: PeriodRow): PeriodEntry | null =>
  normalisePeriod({
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    flow: row.flow,
    symptoms: row.symptoms ?? [],
    notes: row.notes ?? "",
  });

export interface CycleHistory {
  periods: PeriodEntry[];
  missedMonths: MissedMonth[];
  /** False when Supabase could not be reached or the tables are absent. */
  synced: boolean;
}

/**
 * Load a patient's cycle history: cache first (instant, survives refresh and
 * offline), then merged with whatever Supabase has, with the merge written
 * back to the cache.
 */
export const loadCycleHistory = async (patientId: string): Promise<CycleHistory> => {
  const cachedPeriods = readCachedPeriods(patientId);
  const cachedMissed = readCachedMissedMonths(patientId);

  try {
    const [periodsResult, missedResult] = await Promise.all([
      supabase
        .from("menstrual_cycle_logs")
        .select("id, start_date, end_date, flow, symptoms, notes")
        .eq("patient_id", patientId)
        .order("start_date", { ascending: false })
        .limit(60),
      supabase
        .from("missed_cycle_months")
        .select("month, notes")
        .eq("patient_id", patientId)
        .order("month", { ascending: false })
        .limit(60),
    ]);

    if (periodsResult.error && !isMissingTable(periodsResult.error))
      throw new Error(periodsResult.error.message);
    if (missedResult.error && !isMissingTable(missedResult.error))
      throw new Error(missedResult.error.message);

    const remotePeriods = ((periodsResult.data ?? []) as PeriodRow[])
      .map(fromPeriodRow)
      .filter((e): e is PeriodEntry => e !== null);

    const remoteMissed = ((missedResult.data ?? []) as MissedRow[])
      .map((row) => normaliseMissed({ month: row.month, notes: row.notes ?? "" }))
      .filter((m): m is MissedMonth => m !== null);

    const periods = mergePeriods(cachedPeriods, remotePeriods);
    const missedMonths = mergeMissedMonths(cachedMissed, remoteMissed);

    writeCachedPeriods(patientId, periods);
    writeCachedMissedMonths(patientId, missedMonths);

    // A missing table is not an error, but it is not a sync either — say so,
    // so the page can tell her the log lives on this device only.
    const synced = !isMissingTable(periodsResult.error) && !isMissingTable(missedResult.error);
    return { periods, missedMonths, synced };
  } catch (error) {
    console.error("Could not sync cycle logs; using cached copy:", error);
    return { periods: cachedPeriods, missedMonths: cachedMissed, synced: false };
  }
};

/**
 * Record (or correct) one period, cache first.
 *
 * Returns the new list plus whether it reached Supabase, so the caller can
 * carry on with a working local log and simply say it isn't backed up.
 */
export const savePeriod = async (
  patientId: string,
  entry: PeriodEntry
): Promise<{ periods: PeriodEntry[]; synced: boolean }> => {
  const periods = mergePeriods(readCachedPeriods(patientId), [entry]);
  writeCachedPeriods(patientId, periods);

  try {
    const { error } = await supabase.from("menstrual_cycle_logs").upsert(
      {
        id: entry.id,
        patient_id: patientId,
        start_date: entry.startDate,
        end_date: entry.endDate,
        flow: entry.flow,
        symptoms: entry.symptoms,
        notes: entry.notes,
      },
      { onConflict: "patient_id,start_date" }
    );

    if (!error) return { periods, synced: true };
    if (isMissingTable(error)) return { periods, synced: false };
    throw new Error(error.message);
  } catch (error) {
    console.error("Could not save period entry to Supabase:", error);
    return { periods, synced: false };
  }
};

/** Remove a period entry, cache first. */
export const deletePeriod = async (
  patientId: string,
  entryId: string
): Promise<PeriodEntry[]> => {
  const periods = readCachedPeriods(patientId).filter((e) => e.id !== entryId);
  writeCachedPeriods(patientId, periods);

  try {
    const { error } = await supabase
      .from("menstrual_cycle_logs")
      .delete()
      .eq("patient_id", patientId)
      .eq("id", entryId);
    if (error && !isMissingTable(error)) throw new Error(error.message);
  } catch (error) {
    console.error("Could not delete period entry from Supabase:", error);
  }

  return periods;
};

/** Record a month with no period at all. */
export const saveMissedMonth = async (
  patientId: string,
  missed: MissedMonth
): Promise<{ missedMonths: MissedMonth[]; synced: boolean }> => {
  const missedMonths = mergeMissedMonths(readCachedMissedMonths(patientId), [missed]);
  writeCachedMissedMonths(patientId, missedMonths);

  try {
    const { error } = await supabase.from("missed_cycle_months").upsert(
      { patient_id: patientId, month: missed.month, notes: missed.notes },
      { onConflict: "patient_id,month" }
    );

    if (!error) return { missedMonths, synced: true };
    if (isMissingTable(error)) return { missedMonths, synced: false };
    throw new Error(error.message);
  } catch (error) {
    console.error("Could not save missed month to Supabase:", error);
    return { missedMonths, synced: false };
  }
};

/** Remove a recorded missed month (she logged a period for it after all). */
export const deleteMissedMonth = async (
  patientId: string,
  month: string
): Promise<MissedMonth[]> => {
  const missedMonths = readCachedMissedMonths(patientId).filter((m) => m.month !== month);
  writeCachedMissedMonths(patientId, missedMonths);

  try {
    const { error } = await supabase
      .from("missed_cycle_months")
      .delete()
      .eq("patient_id", patientId)
      .eq("month", month);
    if (error && !isMissingTable(error)) throw new Error(error.message);
  } catch (error) {
    console.error("Could not delete missed month from Supabase:", error);
  }

  return missedMonths;
};

/**
 * A patient's cycle history read by someone else — her doctor, through the
 * `doctor_treats` policy. No cache involved: a clinician must never be shown
 * another patient's locally cached log, and a browser that cannot reach the
 * server has nothing truthful to show here.
 */
export const fetchCycleHistoryForDoctor = async (
  patientId: string
): Promise<{ periods: PeriodEntry[]; missedMonths: MissedMonth[] }> => {
  const [periodsResult, missedResult] = await Promise.all([
    supabase
      .from("menstrual_cycle_logs")
      .select("id, start_date, end_date, flow, symptoms, notes")
      .eq("patient_id", patientId)
      .order("start_date", { ascending: false })
      .limit(60),
    supabase
      .from("missed_cycle_months")
      .select("month, notes")
      .eq("patient_id", patientId)
      .order("month", { ascending: false })
      .limit(60),
  ]);

  if (periodsResult.error && !isMissingTable(periodsResult.error))
    throw new Error(periodsResult.error.message);
  if (missedResult.error && !isMissingTable(missedResult.error))
    throw new Error(missedResult.error.message);

  return {
    periods: ((periodsResult.data ?? []) as PeriodRow[])
      .map(fromPeriodRow)
      .filter((e): e is PeriodEntry => e !== null)
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    missedMonths: ((missedResult.data ?? []) as MissedRow[])
      .map((row) => normaliseMissed({ month: row.month, notes: row.notes ?? "" }))
      .filter((m): m is MissedMonth => m !== null)
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
};
