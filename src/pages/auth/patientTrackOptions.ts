/**
 * Wizard constants and option lists for the patient signup form.
 *
 * Kept out of the component file so it stays exports-only-components and
 * React Fast Refresh keeps working during development — the same split
 * `doctorProfileOptions.ts` exists for.
 */

import type { TrackSignupDetails } from "@/services/healthTrackService";

export const PATIENT_SIGNUP_STEPS = 2;
export const PATIENT_STEP_LABELS = ["Your account", "Your care"];

/** What a PCOD/PCOS patient can ask us to keep an eye on. */
export const PCOS_CONCERNS: { value: string; label: string }[] = [
  { value: "irregular-cycles", label: "Irregular or missed periods" },
  { value: "weight-gain", label: "Weight gain" },
  { value: "acne", label: "Acne / skin changes" },
  { value: "hair-fall", label: "Hair fall or thinning" },
  { value: "excess-hair", label: "Excess facial or body hair" },
  { value: "heavy-flow", label: "Heavy or prolonged bleeding" },
  { value: "fatigue", label: "Fatigue and low energy" },
  { value: "fertility", label: "Trying to conceive" },
];

export const emptyTrackDetails = (): TrackSignupDetails => ({
  dueDate: "",
  diagnosisStatus: "",
  diagnosisYear: "",
  typicalCycleLength: "",
  lastPeriodStart: "",
  concerns: [],
  heightCm: "",
  weightKg: "",
});
