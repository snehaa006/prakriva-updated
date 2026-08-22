// src/services/mealFeedbackService.ts
// Reads of `meal_feedback` — the per-meal check-ins a patient writes from the
// Plan Hub (how a meal sat with her digestion, mood and energy, plus a note).
// Patients insert their own rows; a treating doctor can read them
// (`doctor_treats` in the table's RLS), which is what lets the Recipe Builder
// show a patient's feedback next to the plan being written for her.
//
// This module is read-only on purpose: feedback is the patient's own statement
// and there is no update or delete policy on the table.

import { supabase } from "@/lib/supabase";

/** One meal check-in, as written by the patient. */
export interface MealFeedback {
  id: string;
  patientId: string;
  patientName: string;
  mealId: string;
  mealName: string;
  /** 1–5 sliders. Null when a row predates the rating or it wasn't stored. */
  digestion: number | null;
  mood: number | null;
  energy: number | null;
  notes: string;
  /** `YYYY-MM-DD` — the day the meal was eaten, not when the row was written. */
  date: string;
  createdAt: string;
}

/** Averages across a set of feedback rows, for the doctor-facing summary. */
export interface MealFeedbackSummary {
  count: number;
  /** Null when no row in the set carried that rating. */
  digestion: number | null;
  mood: number | null;
  energy: number | null;
  /** Rows that carry a written note. */
  noteCount: number;
  /** Most recent feedback date in the set, or null when the set is empty. */
  latestDate: string | null;
}

interface MealFeedbackRow {
  id: string;
  patient_id: string;
  patient_name: string | null;
  meal_id: string | null;
  meal_name: string | null;
  digestion_rating: number | null;
  mood_rating: number | null;
  energy_rating: number | null;
  notes: string | null;
  date: string;
  created_at: string;
}

const toMealFeedback = (row: MealFeedbackRow): MealFeedback => ({
  id: row.id,
  patientId: row.patient_id,
  patientName: row.patient_name ?? "",
  mealId: row.meal_id ?? "",
  mealName: row.meal_name || "a meal",
  digestion: row.digestion_rating,
  mood: row.mood_rating,
  energy: row.energy_rating,
  notes: row.notes ?? "",
  date: row.date,
  createdAt: row.created_at,
});

/**
 * A patient's meal feedback, newest first. `limit` caps how far back to read —
 * the doctor views want a recent window, not the patient's whole history.
 */
export const fetchMealFeedback = async (
  patientId: string,
  limit = 20
): Promise<MealFeedback[]> => {
  if (!patientId) return [];

  const { data, error } = await supabase
    .from("meal_feedback")
    .select(
      "id, patient_id, patient_name, meal_id, meal_name, digestion_rating, mood_rating, energy_rating, notes, date, created_at"
    )
    .eq("patient_id", patientId)
    // Two rows on the same day are ordered by when they were written, so the
    // list reads in the order she actually logged her meals.
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as MealFeedbackRow[]).map(toMealFeedback);
};

const average = (values: number[]): number | null =>
  values.length === 0
    ? null
    : Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;

/** Roll a set of feedback rows into the averages the doctor cards show. */
export const summarizeMealFeedback = (
  entries: MealFeedback[]
): MealFeedbackSummary => {
  const ratings = (pick: (entry: MealFeedback) => number | null) =>
    entries
      .map(pick)
      .filter((value): value is number => typeof value === "number");

  return {
    count: entries.length,
    digestion: average(ratings((entry) => entry.digestion)),
    mood: average(ratings((entry) => entry.mood)),
    energy: average(ratings((entry) => entry.energy)),
    noteCount: entries.filter((entry) => entry.notes.trim().length > 0).length,
    latestDate: entries[0]?.date ?? null,
  };
};
