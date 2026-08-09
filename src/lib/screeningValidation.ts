// Client-side bounds for the screening measurements, mirroring the Pydantic
// Field(ge=..., le=...) constraints in backend/disease_detection/schemas.py.
//
// The backend is still the authority — this exists so a typo (entering 119
// instead of 11.9 for haemoglobin) is caught in the form with a sentence the
// patient can act on, instead of surfacing the raw pydantic validation error.
//
// Keep in sync with schemas.py; the unit tests here pin the expected ranges.

import type { ScreeningInput } from "@/types/diseaseDetection";

export interface FieldRange {
  /** Field label as shown in the form. */
  label: string;
  min: number;
  max: number;
  /** Appended to the message, e.g. "g/dL". */
  unit?: string;
}

/** Measurement bounds, keyed by the `ScreeningInput` field they validate. */
export const MEASUREMENT_RANGES = {
  age: { label: "Age", min: 10, max: 60, unit: "years" },
  gestational_week: { label: "Weeks pregnant", min: 0, max: 45, unit: "weeks" },
  bmi: { label: "BMI", min: 10, max: 60 },
  bp_systolic: { label: "Systolic BP", min: 60, max: 300, unit: "mmHg" },
  bp_diastolic: { label: "Diastolic BP", min: 30, max: 200, unit: "mmHg" },
  hemoglobin: { label: "Haemoglobin", min: 0, max: 25, unit: "g/dL" },
  hdl: { label: "HDL cholesterol", min: 0, max: 200, unit: "mg/dL" },
  triglycerides: { label: "Triglycerides", min: 0, max: 2000, unit: "mg/dL" },
} as const satisfies Record<string, FieldRange>;

export type MeasurementField = keyof typeof MEASUREMENT_RANGES;

/** True when `value` is outside the field's accepted range. */
export const isOutOfRange = (
  field: MeasurementField,
  value: number | null | undefined
): boolean => {
  if (value === null || value === undefined || Number.isNaN(value)) return false;
  const { min, max } = MEASUREMENT_RANGES[field];
  return value < min || value > max;
};

const describe = (field: MeasurementField, value: number): string => {
  const { label, min, max, unit } = MEASUREMENT_RANGES[field] as FieldRange;
  const suffix = unit ? ` ${unit}` : "";
  return `${label} must be between ${min} and ${max}${suffix} — you entered ${value}.`;
};

/**
 * Human-readable problems with the measurements on `form`, empty when it is
 * safe to submit. Fields left blank are "not measured" and never complained
 * about — only values actually outside the accepted range are reported.
 */
export const validateMeasurements = (form: ScreeningInput): string[] => {
  const problems: string[] = [];

  for (const field of Object.keys(MEASUREMENT_RANGES) as MeasurementField[]) {
    const value = form[field] as number | null | undefined;
    if (isOutOfRange(field, value)) {
      problems.push(describe(field, value as number));
    }
  }

  // Only meaningful when both halves are present and in range on their own.
  const { bp_systolic: systolic, bp_diastolic: diastolic } = form;
  if (
    systolic != null &&
    diastolic != null &&
    !isOutOfRange("bp_systolic", systolic) &&
    !isOutOfRange("bp_diastolic", diastolic) &&
    diastolic >= systolic
  ) {
    problems.push(
      `Systolic BP (${systolic}) must be higher than diastolic BP (${diastolic}).`
    );
  }

  return problems;
};
