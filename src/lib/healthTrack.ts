// Which care pathway a patient signed up for.
//
// Prakriva started as a maternal app: every patient was assumed pregnant, so
// the maternal screening ("Health Check") and the pregnancy nutrition targets
// applied to everyone. PCOD/PCOS patients need a different shape of care —
// there is no disease-detection pipeline to run for them, and what a
// practitioner actually needs is their cycle history, their weight trend and
// what they are doing for exercise.
//
// The track is chosen once at signup and decides which tabs a patient sees,
// which analysis a doctor gets, and which nutritional targets the diet plan
// generator starts from.
//
// Pure and dependency-free so it is trivially testable; see
// src/lib/__tests__/healthTrack.test.ts.

export type HealthTrack = "pregnancy" | "pcos" | "general";

export const HEALTH_TRACKS: HealthTrack[] = ["pregnancy", "pcos", "general"];

export const HEALTH_TRACK_LABELS: Record<HealthTrack, string> = {
  pregnancy: "Pregnancy",
  pcos: "PCOD / PCOS",
  general: "General wellness",
};

export const HEALTH_TRACK_DESCRIPTIONS: Record<HealthTrack, string> = {
  pregnancy:
    "Maternal health check, trimester-aware nutrition and pregnancy-safe movement.",
  pcos: "Cycle tracking, weight and skin logs, and insulin-resistance-aware nutrition.",
  general: "Ayurvedic profiling and everyday nutrition, with no condition-specific track.",
};

/**
 * Whether the maternal disease-detection pipeline applies to this track.
 *
 * The screening models are trained on pregnancy conditions (gestational
 * diabetes, preeclampsia, maternal anaemia). Running them for a PCOS patient
 * would produce confident-looking risk scores for conditions the inputs were
 * never about, which is worse than showing nothing — so that whole surface is
 * hidden rather than repurposed.
 */
export const showsDiseaseDetection = (track: HealthTrack): boolean =>
  track === "pregnancy";

/** Whether the cycle, weight and skin trackers apply to this track. */
export const showsCycleTracking = (track: HealthTrack): boolean => track === "pcos";

/**
 * Coerce anything stored (a `patients.health_track` column, a value out of
 * `assessment_data`, signup metadata) into a track.
 *
 * Accepts the historical spellings the questionnaire has used — its
 * `lifeStage` field says `"pregnancy"` / `"none"` — so a patient created
 * before this column existed still resolves.
 */
export const parseHealthTrack = (raw: unknown): HealthTrack | null => {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();

  if (value === "pregnancy" || value === "pregnant") return "pregnancy";
  if (value === "pcos" || value === "pcod" || value === "pcod/pcos" || value === "pcos/pcod")
    return "pcos";
  if (value === "general" || value === "none" || value === "not_applicable") return "general";

  return null;
};

/** Fields a resolution can be read out of, in priority order. */
export interface HealthTrackSources {
  /** `patients.health_track` — the authoritative column once it exists. */
  column?: unknown;
  /** `assessment_data.healthTrack` — written by the questionnaire. */
  assessmentTrack?: unknown;
  /** `assessment_data.lifeStage` — how pregnancy was recorded before tracks. */
  lifeStage?: unknown;
  /** Conditions the patient reported, e.g. `["pcos", "thyroid"]`. */
  conditions?: unknown;
}

const mentionsPcos = (conditions: unknown): boolean => {
  const list = Array.isArray(conditions) ? conditions : [conditions];
  return list.some(
    (value) =>
      typeof value === "string" &&
      (value.toLowerCase().includes("pcos") || value.toLowerCase().includes("pcod"))
  );
};

/**
 * The track for a patient, from whichever source has an answer.
 *
 * Falls back to `general` rather than `pregnancy`: assuming pregnancy is how
 * the app ended up showing a maternal screening to everybody, and a patient
 * whose track we genuinely do not know is better asked than guessed at.
 */
export const resolveHealthTrack = (sources: HealthTrackSources): HealthTrack => {
  const fromColumn = parseHealthTrack(sources.column);
  if (fromColumn) return fromColumn;

  const fromAssessment = parseHealthTrack(sources.assessmentTrack);
  if (fromAssessment) return fromAssessment;

  const fromLifeStage = parseHealthTrack(sources.lifeStage);
  if (fromLifeStage === "pregnancy") return "pregnancy";

  if (mentionsPcos(sources.conditions)) return "pcos";

  return fromLifeStage ?? "general";
};
