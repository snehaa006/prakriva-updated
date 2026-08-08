// Reads the meal statuses logged on the Meal Logging page (`meal_tracking`)
// so the Lifestyle Tracker can show whether daily nutrition was completed and
// whether the provided diet plan was actually followed.
//
// Read-only: Meal Logging owns writing this table. A missing table degrades
// gracefully to "nothing logged yet", matching the rest of the app.

import { supabase } from "@/lib/supabase";
import type { MealTrackingDay } from "@/lib/dietAdherence";

const MISSING_TABLE_CODES = ["42P01", "PGRST205", "PGRST106"];

const isMissingTable = (error: { code?: string } | null) =>
  !!error && MISSING_TABLE_CODES.includes(error.code ?? "");

interface MealTrackingRow {
  date: string;
  total_meals: number | null;
  eaten_count: number | null;
  skipped_count: number | null;
  calories_consumed: number | null;
}

/** Meal tracking rows on or after `fromDate` ("YYYY-MM-DD"), oldest first. */
export const fetchMealTracking = async (
  patientId: string,
  fromDate: string
): Promise<MealTrackingDay[]> => {
  const { data, error } = await supabase
    .from("meal_tracking")
    .select("date, total_meals, eaten_count, skipped_count, calories_consumed")
    .eq("patient_id", patientId)
    .gte("date", fromDate)
    .order("date", { ascending: true });

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as MealTrackingRow[]).map((row) => ({
    date: row.date,
    totalMeals: row.total_meals ?? 0,
    eatenCount: row.eaten_count ?? 0,
    skippedCount: row.skipped_count ?? 0,
    caloriesConsumed: row.calories_consumed ?? 0,
  }));
};
