// types/diseaseDetection.ts
// Mirrors backend/disease_detection/schemas.py. Keep the two in sync — the
// backend validates every field and rejects unknown symptom keys.

export type RiskLevel = "low" | "moderate" | "high";

export type Ternary = "positive" | "negative" | "unknown";

export type Trimester = "first" | "second" | "third" | "unknown";

export type ConditionKey =
  | "anaemia"
  | "pregnancy_risk"
  | "gdm"
  | "preeclampsia"
  | "uti"
  | "thyroid"
  | "miscarriage"
  | "mental_health";

export type SymptomKey =
  | "fatigue"
  | "dizziness"
  | "painful_urination"
  | "frequent_urination"
  | "lower_abdominal_pain"
  | "back_pain"
  | "fever"
  | "blurred_vision"
  | "palpitations"
  | "shortness_of_breath"
  | "headache"
  | "cold_hands_feet"
  | "swelling"
  | "pale_skin"
  | "cloudy_urine"
  | "blood_in_urine"
  | "bleeding"
  | "cramping";

export interface ScreeningInput {
  // Basic information
  age: number;
  trimester: Trimester;
  gestational_week?: number | null;
  bmi?: number | null;
  iron_supplement: boolean;
  gravida: number;
  parity: number;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;

  // History / risk factors
  family_history: boolean;
  pcos: boolean;
  previous_miscarriage: boolean;
  sedentary_lifestyle: boolean;
  anaemia_history: boolean;
  previous_complications: boolean;
  previous_uti: boolean;
  gestational_diabetes_previous: boolean;
  known_prediabetes: boolean;
  diabetes: boolean;
  hypertension_history: boolean;
  unexplained_prenatal_loss: boolean;
  large_baby_previous: boolean;
  history_depression: boolean;
  smoking: boolean;
  alcohol: boolean;

  // Thyroid history — inputs to the thyroid model. "query_*" means a clinician
  // raised the possibility without it being confirmed.
  on_thyroxine: boolean;
  query_on_thyroxine: boolean;
  on_antithyroid_medication: boolean;
  currently_unwell: boolean;
  thyroid_surgery: boolean;
  i131_treatment: boolean;
  query_hypothyroid: boolean;
  query_hyperthyroid: boolean;
  lithium: boolean;
  goitre: boolean;
  thyroid_tumour: boolean;
  hypopituitary: boolean;
  psych_history: boolean;

  // Symptoms / signs
  symptoms: SymptomKey[];
  weight_gain: boolean;
  hair_loss: boolean;
  cold_intolerance: boolean;
  constipation: boolean;
  menstrual_irregularity: boolean;
  excessive_thirst: boolean;
  proteinuria: Ternary;

  // Mental health scales
  stress_level: number; // 0-3
  sleep_disturbance: number; // 0-3
  mood_symptoms: number; // 0-7
  social_support: number; // 0-5
  edinburgh_score: number; // 0-30
  phq9_score: number; // 0-27

  // Optional laboratory values — null means "test not performed"
  hemoglobin?: number | null;
  hba1c?: number | null;
  ogtt_1hr?: number | null;
  /** Ultrasound findings — used by the preeclampsia model. */
  fetal_weight_kg?: number | null;
  amniotic_fluid_cm?: number | null;
  /** Lipids — used by the GDM early-screening model. */
  hdl?: number | null;
  triglycerides?: number | null;
  urine_wbc?: number | null;
  urine_nitrite: Ternary;
  tsh?: number | null;
  t3?: number | null;
  /** Free T4 (ng/dL) — used by the rule-based scorer. */
  t4?: number | null;
  /** Total T4 (ug/dL) — a different assay from `t4`, used by the thyroid model. */
  tt4?: number | null;
  t4u?: number | null;
  fti?: number | null;
}

export interface ConditionRisk {
  condition: ConditionKey;
  label: string;
  score: number; // 0-100
  risk_level: RiskLevel;
  reasons: string[];
  recommendations: string[];
  detector: string;
  details: Record<string, unknown>;
}

export interface ScreeningResult {
  generated_at: string;
  conditions: ConditionRisk[];
  overall_risk_level: RiskLevel;
  highest_risk_condition: ConditionKey | null;
  disclaimer: string;
}

/** Who filled in the screening: the patient herself, or her clinician. */
export type ScreeningAuthor = "patient" | "doctor";

/** One stored screening run, as persisted in `disease_screenings`. */
export interface StoredScreening {
  id: string;
  patientId: string;
  doctorId: string | null;
  submittedBy: ScreeningAuthor;
  createdAt: string;
  inputs: ScreeningInput;
  result: ScreeningResult;
}

export const CONDITION_LABELS: Record<ConditionKey, string> = {
  anaemia: "Anaemia",
  pregnancy_risk: "Pregnancy Risk",
  gdm: "Gestational Diabetes",
  preeclampsia: "Preeclampsia",
  uti: "Urinary Tract Infection",
  thyroid: "Thyroid Disorder",
  miscarriage: "Miscarriage Risk",
  mental_health: "Perinatal Mental Health",
};

export const SYMPTOM_LABELS: Record<SymptomKey, string> = {
  fatigue: "Fatigue",
  dizziness: "Dizziness / lightheadedness",
  painful_urination: "Painful or burning urination",
  frequent_urination: "Frequent urination",
  lower_abdominal_pain: "Lower abdominal pain",
  back_pain: "Back pain",
  fever: "Fever",
  blurred_vision: "Blurred vision",
  palpitations: "Palpitations",
  shortness_of_breath: "Shortness of breath",
  headache: "Headache",
  cold_hands_feet: "Cold hands / feet",
  swelling: "Swelling (oedema)",
  pale_skin: "Pale skin",
  cloudy_urine: "Cloudy or foul-smelling urine",
  blood_in_urine: "Blood in urine",
  bleeding: "Vaginal bleeding",
  cramping: "Cramping",
};
