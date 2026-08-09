// Shared form sections for the maternal disease screening, used by both the
// patient's self-report page and the doctor's screening page. The patient fills
// what she can answer about herself; the doctor additionally sees the clinical
// measurements and lab panel.

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ScreeningInput,
  SYMPTOM_LABELS,
  SymptomKey,
} from "@/types/diseaseDetection";
import { MEASUREMENT_RANGES, type FieldRange } from "@/lib/screeningValidation";

/** Applies one field change to the screening form. */
export type UpdateField = <K extends keyof ScreeningInput>(
  key: K,
  value: ScreeningInput[K]
) => void;

export interface SectionProps {
  form: ScreeningInput;
  update: UpdateField;
}

/** Checkbox bound to a boolean field on the screening form. */
export const BoolField: React.FC<{
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}> = ({ id, label, checked, onChange }) => (
  <div className="flex items-center space-x-2">
    <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
    <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
      {label}
    </Label>
  </div>
);

/**
 * Numeric input that keeps "not measured" distinct from zero.
 *
 * Pass `range` for a measurement with known clinical bounds: it constrains the
 * native number input and flags an out-of-range value inline, so a typo like
 * 119 g/dL of haemoglobin is caught here rather than coming back as a raw
 * backend validation error.
 */
export const NumberField: React.FC<{
  id: string;
  label: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  step?: string;
  placeholder?: string;
  range?: FieldRange;
}> = ({
  id,
  label,
  value,
  onChange,
  step = "1",
  placeholder = "Not measured",
  range,
}) => {
  const invalid =
    range != null &&
    value != null &&
    !Number.isNaN(value) &&
    (value < range.min || value > range.max);

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        step={step}
        min={range?.min}
        max={range?.max}
        placeholder={placeholder}
        value={value ?? ""}
        aria-invalid={invalid || undefined}
        className={invalid ? "border-destructive focus-visible:ring-destructive" : undefined}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
      {invalid && (
        <p className="text-xs text-destructive">
          Enter a value between {range.min} and {range.max}
          {range.unit ? ` ${range.unit}` : ""}.
        </p>
      )}
    </div>
  );
};

/** Slider bound to one of the mental-health scales. */
export const ScaleField: React.FC<{
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  hint?: string;
}> = ({ label, value, max, onChange, hint }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <span className="text-sm font-medium">
        {value}/{max}
      </span>
    </div>
    <Slider
      value={[value]}
      min={0}
      max={max}
      step={1}
      onValueChange={([v]) => onChange(v)}
    />
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

/**
 * Age, trimester and pregnancy counts.
 *
 * `variant="clinician"` adds BMI and blood pressure — measurements taken at the
 * clinic rather than things a patient reports from memory.
 */
export const BasicsSection: React.FC<
  SectionProps & { variant?: "patient" | "clinician" }
> = ({ form, update, variant = "clinician" }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
    <NumberField
      id="age"
      label="Age (years)"
      value={form.age}
      onChange={(v) => update("age", (v ?? 28) as number)}
      placeholder="28"
    />
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">Trimester</Label>
      <Select
        value={form.trimester}
        onValueChange={(v) => update("trimester", v as ScreeningInput["trimester"])}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="first">First (1-12 weeks)</SelectItem>
          <SelectItem value="second">Second (13-26 weeks)</SelectItem>
          <SelectItem value="third">Third (27-40 weeks)</SelectItem>
          <SelectItem value="unknown">Not sure</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <NumberField
      id="gestational_week"
      label="Weeks pregnant"
      value={form.gestational_week}
      onChange={(v) => update("gestational_week", v)}
      placeholder="e.g. 24"
    />
    <NumberField
      id="gravida"
      label="Pregnancies so far"
      value={form.gravida}
      onChange={(v) => update("gravida", (v ?? 0) as number)}
      placeholder="1"
    />
    <NumberField
      id="parity"
      label="Births so far"
      value={form.parity}
      onChange={(v) => update("parity", (v ?? 0) as number)}
      placeholder="0"
    />

    {variant === "clinician" && (
      <>
        <NumberField
          id="bmi"
          label="BMI"
          step="0.1"
          value={form.bmi}
          onChange={(v) => update("bmi", v)}
        />
        <div />
        <NumberField
          id="bp_systolic"
          label="Systolic BP (mmHg)"
          value={form.bp_systolic}
          onChange={(v) => update("bp_systolic", v)}
        />
        <NumberField
          id="bp_diastolic"
          label="Diastolic BP (mmHg)"
          value={form.bp_diastolic}
          onChange={(v) => update("bp_diastolic", v)}
        />
      </>
    )}
  </div>
);

/** BMI from height (cm) and weight (kg), rounded to one decimal, or null. */
export const computeBmi = (
  heightCm: number | null,
  weightKg: number | null
): number | null => {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  const metres = heightCm / 100;
  return Math.round((weightKg / (metres * metres)) * 10) / 10;
};

/**
 * The measurements a patient can report at each health check — weight (turned
 * into BMI with the height captured at onboarding), haemoglobin and blood
 * pressure. These feed the maternal anaemia / pregnancy-risk model.
 */
export const MaternalVitalsSection: React.FC<{
  form: ScreeningInput;
  update: UpdateField;
  weightKg: number | null;
  onWeightKg: (value: number | null) => void;
  heightCm: number | null;
}> = ({ form, update, weightKg, onWeightKg, heightCm }) => {
  const bmi = computeBmi(heightCm, weightKg);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <NumberField
          id="gestational_week"
          label="Weeks pregnant"
          value={form.gestational_week}
          onChange={(v) => update("gestational_week", v)}
          placeholder="e.g. 24"
          range={MEASUREMENT_RANGES.gestational_week}
        />
        <NumberField
          id="weight_kg"
          label="Weight (kg)"
          step="0.1"
          value={weightKg}
          onChange={onWeightKg}
          placeholder="e.g. 62"
          range={{ label: "Weight", min: 30, max: 250, unit: "kg" }}
        />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">BMI (calculated)</Label>
          <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
            {bmi !== null ? (
              bmi
            ) : (
              <span className="text-muted-foreground">
                {heightCm ? "Enter weight" : "Add height in your questionnaire"}
              </span>
            )}
          </div>
        </div>
        <NumberField
          id="hemoglobin"
          label="Haemoglobin (g/dL)"
          step="0.1"
          value={form.hemoglobin}
          onChange={(v) => update("hemoglobin", v)}
          placeholder="e.g. 11.5"
          range={MEASUREMENT_RANGES.hemoglobin}
        />
        <NumberField
          id="bp_systolic"
          label="Systolic BP (mmHg)"
          value={form.bp_systolic}
          onChange={(v) => update("bp_systolic", v)}
          placeholder="e.g. 118"
          range={MEASUREMENT_RANGES.bp_systolic}
        />
        <NumberField
          id="bp_diastolic"
          label="Diastolic BP (mmHg)"
          value={form.bp_diastolic}
          onChange={(v) => update("bp_diastolic", v)}
          placeholder="e.g. 76"
          range={MEASUREMENT_RANGES.bp_diastolic}
        />
      </div>
      <BoolField
        id="iron_supplement"
        label="Currently taking iron supplements"
        checked={form.iron_supplement}
        onChange={(v) => update("iron_supplement", v)}
      />
      <p className="text-xs text-muted-foreground">
        Enter the most recent readings from your antenatal check-up. Leave a field
        blank if you do not have it — the check still runs on what you provide.
      </p>
    </div>
  );
};

/**
 * Blood-test values from a recent antenatal panel, feeding the gestational
 * diabetes model. All optional — a missing value is filled with the population
 * median and the result says so, rather than blocking the check.
 */
export const BloodResultsSection: React.FC<SectionProps> = ({ form, update }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <NumberField
        id="hba1c"
        label="HbA1c (%)"
        step="0.1"
        value={form.hba1c}
        onChange={(v) => update("hba1c", v)}
        placeholder="e.g. 5.2"
      />
      <NumberField
        id="hdl"
        label="HDL cholesterol (mg/dL)"
        value={form.hdl}
        onChange={(v) => update("hdl", v)}
        placeholder="e.g. 55"
        range={MEASUREMENT_RANGES.hdl}
      />
      <NumberField
        id="triglycerides"
        label="Triglycerides (mg/dL)"
        value={form.triglycerides}
        onChange={(v) => update("triglycerides", v)}
        placeholder="e.g. 150"
        range={MEASUREMENT_RANGES.triglycerides}
      />
    </div>
    <p className="text-xs text-muted-foreground">
      From your most recent blood test report. Leave blank if you do not have
      them — your diabetes risk is still estimated from everything else.
    </p>
  </div>
);

/**
 * The history questions the gestational diabetes model uses. Each one is a
 * model input, not a general questionnaire item. Some arrive pre-ticked from
 * the onboarding questionnaire; the patient can correct them here.
 */
export const DiabetesRiskFactorsSection: React.FC<SectionProps> = ({ form, update }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <BoolField
        id="patient_prior_gdm"
        label="Gestational diabetes in a previous pregnancy"
        checked={form.gestational_diabetes_previous}
        onChange={(v) => update("gestational_diabetes_previous", v)}
      />
      <BoolField
        id="patient_known_prediabetes"
        label="Told you have prediabetes"
        checked={form.known_prediabetes}
        onChange={(v) => update("known_prediabetes", v)}
      />
      <BoolField
        id="patient_family_history"
        label="Diabetes runs in your family"
        checked={form.family_history}
        onChange={(v) => update("family_history", v)}
      />
      <BoolField
        id="patient_pcos"
        label="PCOS"
        checked={form.pcos}
        onChange={(v) => update("pcos", v)}
      />
      <BoolField
        id="patient_large_baby"
        label="A previous baby weighed over 4 kg"
        checked={form.large_baby_previous}
        onChange={(v) => update("large_baby_previous", v)}
      />
      <BoolField
        id="patient_unexplained_loss"
        label="An unexplained pregnancy loss"
        checked={form.unexplained_prenatal_loss}
        onChange={(v) => update("unexplained_prenatal_loss", v)}
      />
      <BoolField
        id="patient_sedentary"
        label="Mostly inactive day to day"
        checked={form.sedentary_lifestyle}
        onChange={(v) => update("sedentary_lifestyle", v)}
      />
    </div>
    <p className="text-xs text-muted-foreground">
      Leave anything unticked that does not apply to you.
    </p>
  </div>
);

/**
 * Thyroid panel plus the history the thyroid model uses. "Suspected" mirrors
 * the source dataset's "query" fields: a clinician raised the possibility
 * without it being confirmed.
 */
export const ThyroidSection: React.FC<SectionProps> = ({ form, update }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <NumberField
        id="tsh_thyroid"
        label="TSH (mIU/L)"
        step="0.01"
        value={form.tsh}
        onChange={(v) => update("tsh", v)}
        placeholder="e.g. 2.1"
      />
      <NumberField
        id="t3_thyroid"
        label="T3"
        step="0.01"
        value={form.t3}
        onChange={(v) => update("t3", v)}
        placeholder="e.g. 2.0"
      />
      <NumberField
        id="tt4"
        label="Total T4 (µg/dL)"
        step="0.1"
        value={form.tt4}
        onChange={(v) => update("tt4", v)}
        placeholder="e.g. 103"
      />
      <NumberField
        id="t4u"
        label="T4 uptake"
        step="0.01"
        value={form.t4u}
        onChange={(v) => update("t4u", v)}
        placeholder="e.g. 0.97"
      />
      <NumberField
        id="fti"
        label="Free thyroxine index"
        step="0.1"
        value={form.fti}
        onChange={(v) => update("fti", v)}
        placeholder="e.g. 107"
      />
    </div>
    <Separator />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <BoolField
        id="on_thyroxine"
        label="Taking thyroxine"
        checked={form.on_thyroxine}
        onChange={(v) => update("on_thyroxine", v)}
      />
      <BoolField
        id="on_antithyroid_medication"
        label="Taking antithyroid medication"
        checked={form.on_antithyroid_medication}
        onChange={(v) => update("on_antithyroid_medication", v)}
      />
      <BoolField
        id="thyroid_surgery"
        label="Previous thyroid surgery"
        checked={form.thyroid_surgery}
        onChange={(v) => update("thyroid_surgery", v)}
      />
      <BoolField
        id="i131_treatment"
        label="Radioactive iodine treatment"
        checked={form.i131_treatment}
        onChange={(v) => update("i131_treatment", v)}
      />
      <BoolField
        id="goitre"
        label="Goitre (swelling in the neck)"
        checked={form.goitre}
        onChange={(v) => update("goitre", v)}
      />
      <BoolField
        id="lithium"
        label="Taking lithium"
        checked={form.lithium}
        onChange={(v) => update("lithium", v)}
      />
      <BoolField
        id="query_hypothyroid"
        label="Underactive thyroid suspected"
        checked={form.query_hypothyroid}
        onChange={(v) => update("query_hypothyroid", v)}
      />
      <BoolField
        id="query_hyperthyroid"
        label="Overactive thyroid suspected"
        checked={form.query_hyperthyroid}
        onChange={(v) => update("query_hyperthyroid", v)}
      />
      <BoolField
        id="currently_unwell"
        label="Unwell when the blood test was taken"
        checked={form.currently_unwell}
        onChange={(v) => update("currently_unwell", v)}
      />
      <BoolField
        id="thyroid_tumour"
        label="Thyroid tumour"
        checked={form.thyroid_tumour}
        onChange={(v) => update("thyroid_tumour", v)}
      />
      <BoolField
        id="query_on_thyroxine"
        label="Unsure whether you take thyroxine"
        checked={form.query_on_thyroxine}
        onChange={(v) => update("query_on_thyroxine", v)}
      />
      <BoolField
        id="hypopituitary"
        label="Pituitary gland condition"
        checked={form.hypopituitary}
        onChange={(v) => update("hypopituitary", v)}
      />
      <BoolField
        id="psych_history"
        label="Psychiatric history"
        checked={form.psych_history}
        onChange={(v) => update("psych_history", v)}
      />
    </div>
    <p className="text-xs text-muted-foreground">
      TSH alone is enough to run the check — the other values sharpen it.
    </p>
  </div>
);

/** The symptom checklist plus the thyroid/GDM specific signs. */
export const SymptomsSection: React.FC<SectionProps> = ({ form, update }) => {
  const toggleSymptom = (symptom: SymptomKey, checked: boolean) =>
    update(
      "symptoms",
      checked
        ? [...form.symptoms, symptom]
        : form.symptoms.filter((s) => s !== symptom)
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {(Object.keys(SYMPTOM_LABELS) as SymptomKey[]).map((symptom) => (
          <BoolField
            key={symptom}
            id={`symptom-${symptom}`}
            label={SYMPTOM_LABELS[symptom]}
            checked={form.symptoms.includes(symptom)}
            onChange={(v) => toggleSymptom(symptom, v)}
          />
        ))}
      </div>
      <Separator />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <BoolField
          id="weight_gain"
          label="Unexplained weight gain"
          checked={form.weight_gain}
          onChange={(v) => update("weight_gain", v)}
        />
        <BoolField
          id="hair_loss"
          label="Hair loss"
          checked={form.hair_loss}
          onChange={(v) => update("hair_loss", v)}
        />
        <BoolField
          id="cold_intolerance"
          label="Cold intolerance"
          checked={form.cold_intolerance}
          onChange={(v) => update("cold_intolerance", v)}
        />
        <BoolField
          id="constipation"
          label="Constipation"
          checked={form.constipation}
          onChange={(v) => update("constipation", v)}
        />
        <BoolField
          id="menstrual_irregularity"
          label="Menstrual irregularity (before pregnancy)"
          checked={form.menstrual_irregularity}
          onChange={(v) => update("menstrual_irregularity", v)}
        />
        <BoolField
          id="excessive_thirst"
          label="Excessive thirst"
          checked={form.excessive_thirst}
          onChange={(v) => update("excessive_thirst", v)}
        />
      </div>
    </div>
  );
};

/** Medical, obstetric and lifestyle history. */
export const HistorySection: React.FC<SectionProps> = ({ form, update }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
    <BoolField
      id="family_history"
      label="Family history of illness"
      checked={form.family_history}
      onChange={(v) => update("family_history", v)}
    />
    <BoolField
      id="pcos"
      label="PCOS"
      checked={form.pcos}
      onChange={(v) => update("pcos", v)}
    />
    <BoolField
      id="previous_miscarriage"
      label="Previous miscarriage"
      checked={form.previous_miscarriage}
      onChange={(v) => update("previous_miscarriage", v)}
    />
    <BoolField
      id="anaemia_history"
      label="History of anaemia"
      checked={form.anaemia_history}
      onChange={(v) => update("anaemia_history", v)}
    />
    <BoolField
      id="iron_supplement"
      label="Currently taking iron supplements"
      checked={form.iron_supplement}
      onChange={(v) => update("iron_supplement", v)}
    />
    <BoolField
      id="previous_uti"
      label="Previous urine infection"
      checked={form.previous_uti}
      onChange={(v) => update("previous_uti", v)}
    />
    <BoolField
      id="previous_complications"
      label="Previous pregnancy complications"
      checked={form.previous_complications}
      onChange={(v) => update("previous_complications", v)}
    />
    <BoolField
      id="gestational_diabetes_previous"
      label="Previous gestational diabetes"
      checked={form.gestational_diabetes_previous}
      onChange={(v) => update("gestational_diabetes_previous", v)}
    />
    <BoolField
      id="known_prediabetes"
      label="Known prediabetes"
      checked={form.known_prediabetes}
      onChange={(v) => update("known_prediabetes", v)}
    />
    <BoolField
      id="large_baby_previous"
      label="Previous large baby"
      checked={form.large_baby_previous}
      onChange={(v) => update("large_baby_previous", v)}
    />
    <BoolField
      id="unexplained_prenatal_loss"
      label="Unexplained pregnancy loss"
      checked={form.unexplained_prenatal_loss}
      onChange={(v) => update("unexplained_prenatal_loss", v)}
    />
    <BoolField
      id="sedentary_lifestyle"
      label="Mostly inactive lifestyle"
      checked={form.sedentary_lifestyle}
      onChange={(v) => update("sedentary_lifestyle", v)}
    />
    <BoolField
      id="smoking"
      label="Smoking"
      checked={form.smoking}
      onChange={(v) => update("smoking", v)}
    />
    <BoolField
      id="alcohol"
      label="Alcohol use"
      checked={form.alcohol}
      onChange={(v) => update("alcohol", v)}
    />
    <BoolField
      id="history_depression"
      label="History of depression"
      checked={form.history_depression}
      onChange={(v) => update("history_depression", v)}
    />
  </div>
);

/** Stress, sleep, mood, support and the EPDS / PHQ-9 self-report scales. */
export const ScalesSection: React.FC<SectionProps> = ({ form, update }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <ScaleField
      label="Stress level"
      value={form.stress_level}
      max={3}
      onChange={(v) => update("stress_level", v)}
      hint="0 minimal · 3 severe"
    />
    <ScaleField
      label="Sleep disturbance"
      value={form.sleep_disturbance}
      max={3}
      onChange={(v) => update("sleep_disturbance", v)}
      hint="0 none · 3 severe"
    />
    <ScaleField
      label="Low mood symptoms"
      value={form.mood_symptoms}
      max={7}
      onChange={(v) => update("mood_symptoms", v)}
      hint="0 none · 7 severe"
    />
    <ScaleField
      label="Social support"
      value={form.social_support}
      max={5}
      onChange={(v) => update("social_support", v)}
      hint="0 low · 5 high"
    />
    <ScaleField
      label="Edinburgh Postnatal Depression Scale (EPDS)"
      value={form.edinburgh_score}
      max={30}
      onChange={(v) => update("edinburgh_score", v)}
      hint="Leave at 0 if you have not taken this questionnaire"
    />
    <ScaleField
      label="PHQ-9"
      value={form.phq9_score}
      max={27}
      onChange={(v) => update("phq9_score", v)}
      hint="Leave at 0 if you have not taken this questionnaire"
    />
  </div>
);

/** Laboratory values, entered by the clinician from a report. */
export const LabsSection: React.FC<SectionProps> = ({ form, update }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
    <NumberField
      id="hemoglobin"
      label="Haemoglobin (g/dL)"
      step="0.1"
      value={form.hemoglobin}
      onChange={(v) => update("hemoglobin", v)}
    />
    <NumberField
      id="hba1c"
      label="HbA1c (%)"
      step="0.1"
      value={form.hba1c}
      onChange={(v) => update("hba1c", v)}
    />
    <NumberField
      id="ogtt_1hr"
      label="OGTT 1-hour (mg/dL)"
      value={form.ogtt_1hr}
      onChange={(v) => update("ogtt_1hr", v)}
    />
    <NumberField
      id="hdl"
      label="HDL cholesterol (mg/dL)"
      value={form.hdl}
      onChange={(v) => update("hdl", v)}
      range={MEASUREMENT_RANGES.hdl}
    />
    <NumberField
      id="triglycerides"
      label="Triglycerides (mg/dL)"
      value={form.triglycerides}
      onChange={(v) => update("triglycerides", v)}
      range={MEASUREMENT_RANGES.triglycerides}
    />
    <NumberField
      id="tsh"
      label="TSH (mIU/L)"
      step="0.01"
      value={form.tsh}
      onChange={(v) => update("tsh", v)}
    />
    <NumberField
      id="t3"
      label="T3"
      step="0.01"
      value={form.t3}
      onChange={(v) => update("t3", v)}
    />
    <NumberField
      id="t4"
      label="Free T4 (ng/dL)"
      step="0.01"
      value={form.t4}
      onChange={(v) => update("t4", v)}
    />
    <NumberField
      id="labs_tt4"
      label="Total T4 (µg/dL)"
      step="0.1"
      value={form.tt4}
      onChange={(v) => update("tt4", v)}
    />
    <NumberField
      id="labs_t4u"
      label="T4 uptake"
      step="0.01"
      value={form.t4u}
      onChange={(v) => update("t4u", v)}
    />
    <NumberField
      id="labs_fti"
      label="Free thyroxine index"
      step="0.1"
      value={form.fti}
      onChange={(v) => update("fti", v)}
    />
    <NumberField
      id="urine_wbc"
      label="Urine WBC count"
      value={form.urine_wbc}
      onChange={(v) => update("urine_wbc", v)}
    />
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">Urine nitrite</Label>
      <Select
        value={form.urine_nitrite}
        onValueChange={(v) =>
          update("urine_nitrite", v as ScreeningInput["urine_nitrite"])
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unknown">Not performed</SelectItem>
          <SelectItem value="positive">Positive</SelectItem>
          <SelectItem value="negative">Negative</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">Proteinuria</Label>
      <Select
        value={form.proteinuria}
        onValueChange={(v) => update("proteinuria", v as ScreeningInput["proteinuria"])}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unknown">Not performed</SelectItem>
          <SelectItem value="positive">Positive</SelectItem>
          <SelectItem value="negative">Negative</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
);
