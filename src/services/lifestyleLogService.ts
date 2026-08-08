// Persistence for the Lifestyle Tracker's sleep / activity / hydration logs.
//
// Local-first on purpose: the activity streak is the point of the page, and a
// streak that vanishes on refresh — or whenever Supabase is unreachable — is
// worse than no streak at all. Every write goes to localStorage synchronously
// and is then mirrored to Supabase; reads merge the two, preferring the server
// where both have a day so a second device wins over a stale cache.
//
// As with disease screenings and the old junk-food log, a missing
// `lifestyle_logs` table degrades gracefully: the page keeps working entirely
// from the cache rather than erroring.

import { supabase } from "@/lib/supabase";
import {
  DEFAULT_WATER_GOAL,
  type LifestyleDayLog,
  type SleepQuality,
} from "@/lib/lifestyleLog";

/** Postgres/PostgREST codes meaning "the table isn't there (yet)". */
const MISSING_TABLE_CODES = ["42P01", "PGRST205", "PGRST106"];

const isMissingTable = (error: { code?: string } | null) =>
  !!error && MISSING_TABLE_CODES.includes(error.code ?? "");

const cacheKey = (patientId: string) => `prakriva.lifestyleLogs.${patientId}`;

/** Guard every localStorage touch — it throws in private mode and when full. */
const safeStorage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

const SLEEP_QUALITIES: SleepQuality[] = ["deep", "disturbed", "insufficient"];

/** Coerce an unknown (cached JSON, or a Supabase row) into a valid log. */
const normalise = (raw: unknown): LifestyleDayLog | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.date !== "string") return null;

  const minutes: Record<string, number> = {};
  if (r.activityMinutes && typeof r.activityMinutes === "object") {
    for (const [key, value] of Object.entries(r.activityMinutes as object)) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) minutes[key] = n;
    }
  }

  const sleepHours = Number(r.sleepHours);
  const quality = r.sleepQuality as SleepQuality;

  return {
    date: r.date,
    sleepHours: Number.isFinite(sleepHours) && sleepHours > 0 ? sleepHours : null,
    sleepQuality: SLEEP_QUALITIES.includes(quality) ? quality : null,
    activityMinutes: minutes,
    waterGlasses: Math.max(0, Number(r.waterGlasses) || 0),
    waterGoal: Number(r.waterGoal) > 0 ? Number(r.waterGoal) : DEFAULT_WATER_GOAL,
  };
};

/** Everything cached for this patient, oldest first. */
export const readCachedLogs = (patientId: string): LifestyleDayLog[] => {
  const storage = safeStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(cacheKey(patientId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalise)
      .filter((l): l is LifestyleDayLog => l !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
};

/** Overwrite the cache. Silently no-ops when storage is unavailable/full. */
export const writeCachedLogs = (patientId: string, logs: LifestyleDayLog[]): void => {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(cacheKey(patientId), JSON.stringify(logs));
  } catch {
    /* quota or private mode — the in-memory state still works for this session */
  }
};

interface LifestyleLogRow {
  log_date: string;
  sleep_hours: number | null;
  sleep_quality: string | null;
  activity_minutes: Record<string, number> | null;
  water_glasses: number | null;
  water_goal: number | null;
}

const fromRow = (row: LifestyleLogRow): LifestyleDayLog | null =>
  normalise({
    date: row.log_date,
    sleepHours: row.sleep_hours,
    sleepQuality: row.sleep_quality,
    activityMinutes: row.activity_minutes ?? {},
    waterGlasses: row.water_glasses ?? 0,
    waterGoal: row.water_goal ?? DEFAULT_WATER_GOAL,
  });

/** Server-side logs for a patient, most recent `days` calendar days. */
export const fetchLifestyleLogs = async (
  patientId: string,
  days = 90
): Promise<LifestyleDayLog[]> => {
  const { data, error } = await supabase
    .from("lifestyle_logs")
    .select(
      "log_date, sleep_hours, sleep_quality, activity_minutes, water_glasses, water_goal"
    )
    .eq("patient_id", patientId)
    .order("log_date", { ascending: false })
    .limit(days);

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as LifestyleLogRow[])
    .map(fromRow)
    .filter((l): l is LifestyleDayLog => l !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
};

/** Server wins where both sides have a day; cache-only days are kept. */
export const mergeLogs = (
  cached: LifestyleDayLog[],
  remote: LifestyleDayLog[]
): LifestyleDayLog[] => {
  const byDate = new Map(cached.map((l) => [l.date, l]));
  for (const log of remote) byDate.set(log.date, log);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Load a patient's logs: cache first (instant, survives refresh and offline),
 * then merged with whatever Supabase has, with the merge written back to the
 * cache.
 */
export const loadLifestyleLogs = async (
  patientId: string
): Promise<{ logs: LifestyleDayLog[]; synced: boolean }> => {
  const cached = readCachedLogs(patientId);

  try {
    const remote = await fetchLifestyleLogs(patientId);
    const merged = mergeLogs(cached, remote);
    writeCachedLogs(patientId, merged);
    return { logs: merged, synced: true };
  } catch (error) {
    console.error("Could not sync lifestyle logs; using cached copy:", error);
    return { logs: cached, synced: false };
  }
};

/**
 * Record one day, cache first.
 *
 * Returns `false` — rather than throwing — when the day could not be mirrored
 * to Supabase, so the caller can carry on with a working local streak and
 * simply tell the patient it isn't backed up.
 */
export const saveLifestyleDay = async (
  patientId: string,
  log: LifestyleDayLog
): Promise<boolean> => {
  const merged = mergeLogs(readCachedLogs(patientId), [log]);
  writeCachedLogs(patientId, merged);

  try {
    const { error } = await supabase.from("lifestyle_logs").upsert(
      {
        patient_id: patientId,
        log_date: log.date,
        sleep_hours: log.sleepHours,
        sleep_quality: log.sleepQuality,
        activity_minutes: log.activityMinutes,
        water_glasses: log.waterGlasses,
        water_goal: log.waterGoal,
      },
      { onConflict: "patient_id,log_date" }
    );

    if (!error) return true;
    if (isMissingTable(error)) return false;
    throw new Error(error.message);
  } catch (error) {
    console.error("Could not save lifestyle log to Supabase:", error);
    return false;
  }
};
