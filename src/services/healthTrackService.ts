// Reading (and back-filling) which care pathway a patient is on.
//
// The track is chosen at signup and stored in two places on purpose:
//
//   1. `auth.users.raw_user_meta_data.healthTrack` — written by `signUp()`, so
//      it exists even when email confirmation means there is no session yet and
//      the browser cannot write to `patients`.
//   2. `patients.health_track` — the column everything reads, populated by the
//      `on_auth_user_created` trigger in a fresh project, and back-filled here
//      on first sign-in for accounts created before the column existed.
//
// As with the other tables added since launch, a missing column degrades
// gracefully: the app falls back to `assessment_data` and keeps working rather
// than erroring.

import { supabase } from "@/lib/supabase";
import {
  parseHealthTrack,
  resolveHealthTrack,
  type HealthTrack,
} from "@/lib/healthTrack";

/** Postgres/PostgREST codes meaning "that table or column isn't there (yet)". */
const MISSING_SCHEMA_CODES = ["42P01", "42703", "PGRST204", "PGRST205", "PGRST106"];

const isMissingSchema = (error: { code?: string } | null) =>
  !!error && MISSING_SCHEMA_CODES.includes(error.code ?? "");

export interface PatientTrackProfile {
  track: HealthTrack;
  /** Raw `patients.assessment_data`, so callers don't fetch it twice. */
  assessmentData: Record<string, unknown> | null;
  /** True when the resolution came from a real stored value, not a fallback. */
  isExplicit: boolean;
}

/** The track details a track-specific signup form collects. */
export interface TrackSignupDetails {
  /** Pregnancy: estimated due date, ISO "YYYY-MM-DD". */
  dueDate?: string;
  /** PCOS: whether a clinician has diagnosed it, or it is self-suspected. */
  diagnosisStatus?: string;
  /** PCOS: year of diagnosis. */
  diagnosisYear?: string;
  /** PCOS: typical cycle length in days, as entered. */
  typicalCycleLength?: string;
  /** PCOS: date of the last period that started, ISO "YYYY-MM-DD". */
  lastPeriodStart?: string;
  /** PCOS: the symptoms she wants tracked (acne, weight gain, hair fall, ...). */
  concerns?: string[];
  /** Both: height in cm, so BMI works without waiting for the questionnaire. */
  heightCm?: string;
  /** Both: current weight in kg, seeding the weight log. */
  weightKg?: string;
}

/**
 * Read a patient's track.
 *
 * Selects the column and `assessment_data` together and falls back to the
 * assessment when the column is absent, so this works against a project that
 * has not applied `supabase/pcos_tracking.sql` yet.
 */
export const fetchHealthTrack = async (
  patientId: string
): Promise<PatientTrackProfile> => {
  const withColumn = await supabase
    .from("patients")
    .select("health_track, assessment_data")
    .eq("id", patientId)
    .maybeSingle();

  let row = withColumn.data as
    | { health_track?: unknown; assessment_data?: Record<string, unknown> | null }
    | null;

  if (withColumn.error) {
    if (!isMissingSchema(withColumn.error)) throw new Error(withColumn.error.message);

    const fallback = await supabase
      .from("patients")
      .select("assessment_data")
      .eq("id", patientId)
      .maybeSingle();

    if (fallback.error) throw new Error(fallback.error.message);
    row = fallback.data as { assessment_data?: Record<string, unknown> | null } | null;
  }

  const assessment = (row?.assessment_data ?? null) as Record<string, unknown> | null;

  const track = resolveHealthTrack({
    column: row?.health_track,
    assessmentTrack: assessment?.healthTrack,
    lifeStage: assessment?.lifeStage,
    conditions: assessment?.currentConditions,
  });

  const isExplicit =
    parseHealthTrack(row?.health_track) !== null ||
    parseHealthTrack(assessment?.healthTrack) !== null;

  return { track, assessmentData: assessment, isExplicit };
};

/**
 * Write the track (and the signup details behind it) onto the patient row.
 *
 * `assessment_data` is merged rather than replaced — the questionnaire owns
 * that document, and a signup that clobbered it would wipe a returning
 * patient's Ayurvedic profile. Returns `false` when the column is not there
 * yet, so the caller can carry on with what it has.
 */
export const saveHealthTrack = async (
  patientId: string,
  track: HealthTrack,
  details: TrackSignupDetails = {}
): Promise<boolean> => {
  const { data: existing } = await supabase
    .from("patients")
    .select("assessment_data")
    .eq("id", patientId)
    .maybeSingle();

  const merged: Record<string, unknown> = {
    ...((existing?.assessment_data as Record<string, unknown>) ?? {}),
    healthTrack: track,
    // Keep `lifeStage` in step: the diet chart generator and the maternal
    // screening both key off it, and a signup that set only the new field
    // would leave a pregnant patient on general-adult nutrition targets — or a
    // PCOS patient on them, missing the low-glycaemic profile entirely.
    lifeStage:
      track === "pregnancy" ? "pregnancy" : track === "pcos" ? "pcos" : "not_applicable",
    ...(details.dueDate ? { dueDate: details.dueDate } : {}),
    ...(details.heightCm ? { heightCm: details.heightCm } : {}),
    ...(track === "pcos"
      ? {
          pcosDiagnosisStatus: details.diagnosisStatus ?? "",
          pcosDiagnosisYear: details.diagnosisYear ?? "",
          typicalCycleLength: details.typicalCycleLength ?? "",
          lastPeriodStart: details.lastPeriodStart ?? "",
          pcosConcerns: details.concerns ?? [],
        }
      : {}),
  };

  const withColumn = await supabase
    .from("patients")
    .update({ health_track: track, assessment_data: merged })
    .eq("id", patientId);

  if (!withColumn.error) return true;
  if (!isMissingSchema(withColumn.error)) throw new Error(withColumn.error.message);

  // No `health_track` column in this project — the assessment copy still
  // resolves through `resolveHealthTrack`.
  const { error } = await supabase
    .from("patients")
    .update({ assessment_data: merged })
    .eq("id", patientId);

  if (error) throw new Error(error.message);
  return false;
};

/**
 * Back-fill the track from signup metadata when the patient row has none.
 *
 * Signup with email confirmation on has no session, so `saveHealthTrack`
 * cannot run at the time the choice is made. This is called on session load
 * and closes that gap on the first successful sign-in.
 */
export const syncHealthTrackFromMetadata = async (
  patientId: string,
  metadata: Record<string, unknown> | undefined
): Promise<HealthTrack | null> => {
  const claimed = parseHealthTrack(metadata?.healthTrack);
  if (!claimed) return null;

  try {
    const { track, isExplicit } = await fetchHealthTrack(patientId);
    if (isExplicit) return track;

    const raw = (metadata?.healthTrackDetails ?? {}) as TrackSignupDetails;
    await saveHealthTrack(patientId, claimed, raw);
    return claimed;
  } catch (error) {
    console.error("Could not sync health track from signup metadata:", error);
    return null;
  }
};
