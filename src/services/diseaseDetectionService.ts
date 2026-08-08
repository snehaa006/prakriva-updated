// src/services/diseaseDetectionService.ts
// Client for the Flask disease detection pipeline (`/disease/*`), plus the
// Supabase persistence of past screening runs so a doctor can reopen results
// instead of re-entering the form.

import { supabase } from "@/lib/supabase";
import type {
  ConditionKey,
  ScreeningAuthor,
  ScreeningInput,
  ScreeningResult,
  StoredScreening,
  SymptomKey,
} from "@/types/diseaseDetection";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

/** Postgres/PostgREST codes meaning "the table isn't there (yet)". */
const MISSING_TABLE_CODES = ["42P01", "PGRST205", "PGRST106"];

const isMissingTable = (error: { code?: string; message?: string } | null) =>
  !!error && MISSING_TABLE_CODES.includes(error.code ?? "");

/** A screening form with every field at its neutral default. */
export const emptyScreeningInput = (): ScreeningInput => ({
  age: 28,
  trimester: "unknown",
  bmi: null,
  gravida: 1,
  parity: 0,
  bp_systolic: null,
  bp_diastolic: null,

  family_history: false,
  pcos: false,
  previous_miscarriage: false,
  sedentary_lifestyle: false,
  anaemia_history: false,
  previous_complications: false,
  previous_uti: false,
  gestational_diabetes_previous: false,
  unexplained_prenatal_loss: false,
  large_baby_previous: false,
  history_depression: false,
  smoking: false,
  alcohol: false,

  symptoms: [],
  weight_gain: false,
  hair_loss: false,
  cold_intolerance: false,
  constipation: false,
  menstrual_irregularity: false,
  excessive_thirst: false,
  proteinuria: "unknown",

  stress_level: 0,
  sleep_disturbance: 0,
  mood_symptoms: 0,
  social_support: 3,
  edinburgh_score: 0,
  phq9_score: 0,

  hemoglobin: null,
  hba1c: null,
  ogtt_1hr: null,
  urine_wbc: null,
  urine_nitrite: "unknown",
  tsh: null,
  t3: null,
  t4: null,
});

/** Age in whole years from a date of birth, or null when unparseable. */
export const ageFromDob = (dob?: string): number | null => {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

/**
 * The questionnaire payload stored in `patients.assessment_data`.
 *
 * It is free-form `jsonb` that has grown field by field, so it is read
 * defensively rather than typed field by field here.
 */
export type AssessmentData = Record<string, unknown> | null | undefined;

/** True when the questionnaire marks this patient as currently pregnant. */
export const isPregnantPatient = (assessmentData: AssessmentData): boolean =>
  assessmentData?.lifeStage === "pregnancy";

const matches = (values: unknown, ...needles: string[]): boolean => {
  const list = Array.isArray(values) ? values : [values];
  return list.some((value) =>
    typeof value === "string"
      ? needles.some((needle) => value.toLowerCase().includes(needle))
      : false
  );
};

/**
 * Seed a screening form from the patient's onboarding questionnaire.
 *
 * Only what the questionnaire genuinely captures is prefilled — labs and
 * obstetric specifics stay blank for the doctor to enter, because guessing them
 * would put numbers in front of a clinician that nobody measured.
 */
export const buildScreeningInputFromAssessment = (
  assessmentData: AssessmentData
): ScreeningInput => {
  const input = emptyScreeningInput();
  if (!assessmentData) return input;

  const age = ageFromDob(assessmentData.dob as string | undefined);
  if (age !== null && age >= 10 && age <= 60) input.age = age;

  const trimesterMap: Record<string, ScreeningInput["trimester"]> = {
    first: "first",
    second: "second",
    third: "third",
  };
  input.trimester =
    trimesterMap[String(assessmentData.pregnancyTrimester)] ?? "unknown";

  const conditions = assessmentData.currentConditions;
  const familyHistory = assessmentData.familyHistory;
  const digestion = assessmentData.digestionIssues;

  input.pcos = matches(conditions, "pcos", "pcod");
  input.anaemia_history = matches(conditions, "anaemia", "anemia");
  input.gestational_diabetes_previous = matches(conditions, "gestational diabetes");
  input.family_history = Array.isArray(familyHistory) && familyHistory.length > 0;
  input.constipation = matches(digestion, "constipation");
  input.history_depression = matches(conditions, "depression", "anxiety");
  input.sedentary_lifestyle = matches(
    assessmentData.physicalActivity,
    "sedentary",
    "none",
    "low"
  );

  // The questionnaire's 1-5 stress scale maps onto the pipeline's 0-3 scale.
  const stress = Number(assessmentData.stressLevels);
  if (Number.isFinite(stress)) {
    input.stress_level = Math.min(3, Math.max(0, Math.round(((stress - 1) / 4) * 3)));
  }

  // Low reported energy is a sleep/fatigue signal worth carrying through.
  const energy = Number(assessmentData.energyLevels);
  if (Number.isFinite(energy) && energy <= 2) {
    input.symptoms = [...input.symptoms, "fatigue" as SymptomKey];
  }

  return input;
};

/** Run the screening pipeline. `conditions` restricts it to a subset. */
export const screenPatient = async (
  inputs: ScreeningInput,
  conditions?: ConditionKey[]
): Promise<ScreeningResult> => {
  const response = await fetch(`${API_BASE}/disease/screen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(conditions ? { ...inputs, conditions } : inputs),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw new Error(
      body?.error || body?.message || `Screening failed (HTTP ${response.status})`
    );
  }

  return body.data as ScreeningResult;
};

export interface SaveScreeningArgs {
  patientId: string;
  /** The clinician who ran it; absent on a patient's own submission. */
  doctorId?: string | null;
  submittedBy: ScreeningAuthor;
  inputs: ScreeningInput;
  result: ScreeningResult;
}

/**
 * Store a screening run against the patient.
 *
 * Returns `false` (rather than throwing) when the `disease_screenings` table
 * has not been created yet, so the result the caller just ran is still shown.
 */
export const saveScreening = async ({
  patientId,
  doctorId,
  submittedBy,
  inputs,
  result,
}: SaveScreeningArgs): Promise<boolean> => {
  const { error } = await supabase.from("disease_screenings").insert({
    patient_id: patientId,
    doctor_id: doctorId ?? null,
    submitted_by: submittedBy,
    inputs,
    result,
    overall_risk_level: result.overall_risk_level,
    highest_risk_condition: result.highest_risk_condition,
  });

  if (!error) return true;
  if (isMissingTable(error)) return false;
  throw new Error(error.message);
};

/** A `disease_screenings` row as selected below. */
interface ScreeningRow {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  submitted_by: ScreeningAuthor | null;
  created_at: string;
  inputs: ScreeningInput;
  result: ScreeningResult;
}

/** Past screenings for a patient, newest first. Empty when the table is absent. */
export const fetchScreenings = async (
  patientId: string
): Promise<StoredScreening[]> => {
  const { data, error } = await supabase
    .from("disease_screenings")
    .select("id, patient_id, doctor_id, submitted_by, created_at, inputs, result")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as ScreeningRow[]).map((row) => ({
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    // Rows written before `submitted_by` existed were all clinician-run.
    submittedBy: row.submitted_by ?? "doctor",
    createdAt: row.created_at,
    inputs: row.inputs,
    result: row.result,
  }));
};
