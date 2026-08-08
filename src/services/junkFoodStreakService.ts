// src/services/junkFoodStreakService.ts
// Supabase persistence for the "No Junk Food Streak" feature on the Lifestyle
// Tracker page. Degrades gracefully when junk_food_streak_logs hasn't been
// created yet — the streak just reads as untracked rather than erroring,
// matching the pattern in diseaseDetectionService.ts.

import { supabase } from "@/lib/supabase";
import type { JunkFoodLogEntry } from "@/lib/junkFoodStreak";

/** Postgres/PostgREST codes meaning "the table isn't there (yet)". */
const MISSING_TABLE_CODES = ["42P01", "PGRST205", "PGRST106"];

const isMissingTable = (error: { code?: string; message?: string } | null) =>
  !!error && MISSING_TABLE_CODES.includes(error.code ?? "");

interface JunkFoodLogRow {
  log_date: string;
  ate_junk_food: boolean;
}

/** A patient's junk-food logs, most recent `days` calendar days. */
export const fetchJunkFoodLogs = async (
  patientId: string,
  days = 60
): Promise<JunkFoodLogEntry[]> => {
  const { data, error } = await supabase
    .from("junk_food_streak_logs")
    .select("log_date, ate_junk_food")
    .eq("patient_id", patientId)
    .order("log_date", { ascending: false })
    .limit(days);

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as JunkFoodLogRow[]).map((row) => ({
    date: row.log_date,
    ateJunkFood: row.ate_junk_food,
  }));
};

/**
 * Record (or correct) one day's entry.
 *
 * Returns `false` — rather than throwing — when the table does not exist yet,
 * so the caller can still update its local state and simply not persist.
 */
export const logJunkFoodDay = async (
  patientId: string,
  date: string,
  ateJunkFood: boolean
): Promise<boolean> => {
  const { error } = await supabase.from("junk_food_streak_logs").upsert(
    {
      patient_id: patientId,
      log_date: date,
      ate_junk_food: ateJunkFood,
    },
    { onConflict: "patient_id,log_date" }
  );

  if (!error) return true;
  if (isMissingTable(error)) return false;
  throw new Error(error.message);
};
