import { describe, expect, it } from "vitest";
import { emptyScreeningInput } from "@/services/diseaseDetectionService";
import {
  MEASUREMENT_RANGES,
  isOutOfRange,
  validateMeasurements,
} from "../screeningValidation";

describe("MEASUREMENT_RANGES", () => {
  // These pin the values to backend/disease_detection/schemas.py — if the
  // backend loosens or tightens a Field(ge=..., le=...), this test should fail
  // and force the client copy to be updated with it.
  it("matches the backend's Pydantic bounds", () => {
    expect(MEASUREMENT_RANGES.age).toMatchObject({ min: 10, max: 60 });
    expect(MEASUREMENT_RANGES.gestational_week).toMatchObject({ min: 0, max: 45 });
    expect(MEASUREMENT_RANGES.bmi).toMatchObject({ min: 10, max: 60 });
    expect(MEASUREMENT_RANGES.bp_systolic).toMatchObject({ min: 60, max: 300 });
    expect(MEASUREMENT_RANGES.bp_diastolic).toMatchObject({ min: 30, max: 200 });
    expect(MEASUREMENT_RANGES.hemoglobin).toMatchObject({ min: 0, max: 25 });
    expect(MEASUREMENT_RANGES.hdl).toMatchObject({ min: 0, max: 200 });
    expect(MEASUREMENT_RANGES.triglycerides).toMatchObject({ min: 0, max: 2000 });
  });
});

describe("isOutOfRange", () => {
  it("treats a blank value as fine — it means 'not measured'", () => {
    expect(isOutOfRange("hemoglobin", null)).toBe(false);
    expect(isOutOfRange("hemoglobin", undefined)).toBe(false);
  });

  it("accepts values on the boundary", () => {
    expect(isOutOfRange("hemoglobin", 0)).toBe(false);
    expect(isOutOfRange("hemoglobin", 25)).toBe(false);
  });

  it("rejects values past the boundary", () => {
    expect(isOutOfRange("hemoglobin", 25.1)).toBe(true);
    expect(isOutOfRange("bp_systolic", 59)).toBe(true);
  });
});

describe("validateMeasurements", () => {
  it("passes a realistic set of readings", () => {
    const form = {
      ...emptyScreeningInput(),
      age: 27,
      gestational_week: 30,
      bmi: 22.6,
      hemoglobin: 11.9,
      bp_systolic: 118,
      bp_diastolic: 76,
    };

    expect(validateMeasurements(form)).toEqual([]);
  });

  it("catches the 119-instead-of-11.9 haemoglobin typo with an actionable message", () => {
    const form = { ...emptyScreeningInput(), hemoglobin: 119 };
    const problems = validateMeasurements(form);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("Haemoglobin");
    expect(problems[0]).toContain("between 0 and 25 g/dL");
    expect(problems[0]).toContain("119");
  });

  it("reports every out-of-range field, not just the first", () => {
    const form = {
      ...emptyScreeningInput(),
      hemoglobin: 119,
      bp_systolic: 400,
    };

    expect(validateMeasurements(form)).toHaveLength(2);
  });

  it("flags diastolic being at or above systolic", () => {
    const form = {
      ...emptyScreeningInput(),
      bp_systolic: 90,
      bp_diastolic: 120,
    };
    const problems = validateMeasurements(form);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("higher than diastolic");
  });

  it("does not double-report BP ordering when a half is already out of range", () => {
    const form = {
      ...emptyScreeningInput(),
      bp_systolic: 10, // below the 60 minimum
      bp_diastolic: 120,
    };

    // Only the out-of-range complaint, not an extra ordering one.
    expect(validateMeasurements(form)).toHaveLength(1);
  });

  it("says nothing about measurements that were left blank", () => {
    expect(validateMeasurements(emptyScreeningInput())).toEqual([]);
  });
});
