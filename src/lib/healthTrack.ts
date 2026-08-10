// Which care pathways a patient is on.
//
// Prakriva started as a maternal app: every patient was assumed pregnant, so
// the maternal screening ("Health Check") and the pregnancy nutrition targets
// applied to everyone. PCOD/PCOS patients need a different shape of care —
// there is no disease-detection pipeline to run for them, and what a
// practitioner actually needs is their cycle history, their weight trend and
// what they are doing for exercise.
//
// These are a **set, not a choice**. Pregnancy and PCOS routinely coexist —
// PCOS is one of the more common reasons a pregnancy is higher-risk, and a
// patient does not stop having it the month she conceives. A patient carrying
// both gets the maternal screening *and* the cycle/weight/skin trackers, and
// her plan is built from both. An empty set is general wellness: no screening,
// no condition trackers.
//
// Pure and dependency-free so it is trivially testable; see
// src/lib/__tests__/healthTrack.test.ts.

/** A condition-specific care pathway. General wellness is the absence of any. */
export type HealthTrack = "pregnancy" | "pcos";

/** Every pathway a patient is on. Empty means general wellness. */
export type HealthTracks = HealthTrack[];

export const HEALTH_TRACKS: HealthTrack[] = ["pregnancy", "pcos"];

export const HEALTH_TRACK_LABELS: Record<HealthTrack, string> = {
  pregnancy: "Pregnancy",
  pcos: "PCOD / PCOS",
};

export const HEALTH_TRACK_DESCRIPTIONS: Record<HealthTrack, string> = {
  pregnancy:
    "Maternal health check, trimester-aware nutrition and pregnancy-safe movement.",
  pcos: "Cycle tracking, weight and skin logs, and insulin-resistance-aware nutrition.",
};

export const GENERAL_TRACK_LABEL = "General wellness";
export const GENERAL_TRACK_DESCRIPTION =
  "Ayurvedic profiling and everyday nutrition, with no condition-specific tracking.";

/** How to describe a patient's tracks in one line. */
export const describeHealthTracks = (tracks: HealthTracks): string =>
  tracks.length === 0
    ? GENERAL_TRACK_LABEL
    : HEALTH_TRACKS.filter((t) => tracks.includes(t))
        .map((t) => HEALTH_TRACK_LABELS[t])
        .join(" + ");

/**
 * Whether the maternal disease-detection pipeline applies.
 *
 * The screening models are trained on pregnancy conditions (gestational
 * diabetes, preeclampsia, maternal anaemia). Running them for a patient who is
 * not pregnant would produce confident-looking risk scores for conditions the
 * inputs were never about, which is worse than showing nothing — so that whole
 * surface is hidden rather than repurposed. A pregnant patient who also has
 * PCOS keeps it: she is pregnant, and PCOS is one of the things that makes a
 * pregnancy higher-risk.
 */
export const showsDiseaseDetection = (tracks: HealthTracks): boolean =>
  tracks.includes("pregnancy");

/** Whether the cycle, weight and skin trackers apply. */
export const showsCycleTracking = (tracks: HealthTracks): boolean =>
  tracks.includes("pcos");

/**
 * Whether the onboarding questionnaire is a gate or an invitation.
 *
 * A PCOD/PCOS patient has just answered a form of her own at signup — her
 * diagnosis, her cycle, her height and weight, and what she wants tracked —
 * and being dropped straight into a five-section Ayurvedic assessment reads as
 * being asked the same thing twice. Worse, it stands between her and the
 * trackers she signed up for, which is the one part of the app that is useless
 * unless she starts logging early: a cycle history only becomes an analysis
 * after a few entries.
 *
 * So for her it is offered rather than demanded. It is not deleted — the
 * Prakriti answers are what the diet chart generator builds a dosha from
 * (`src/services/dietChartService.ts`), and without them it falls back to a
 * default constitution — so her profile keeps a prompt to fill it in when she
 * wants to. Everyone else still completes it first; nothing about the other
 * pathways changed.
 */
export const requiresQuestionnaire = (tracks: HealthTracks): boolean =>
  !tracks.includes("pcos");

/**
 * Which life stage the diet plan generator should use.
 *
 * Pregnancy wins over PCOS whenever both are present, and that ordering is a
 * safety rule rather than a preference: the PCOS targets run a calorie deficit
 * and exclude foods, neither of which belongs anywhere near a pregnancy. The
 * PCOS-specific emphasis still reaches her plan, through the pregnancy-safe
 * subset of `buildPcosInsight` (src/lib/pcosInsights.ts).
 */
export const lifeStageForTracks = (tracks: HealthTracks): string => {
  if (tracks.includes("pregnancy")) return "pregnancy";
  if (tracks.includes("pcos")) return "pcos";
  return "not_applicable";
};

/**
 * Coerce one stored value into a track.
 *
 * Accepts the historical spellings the questionnaire has used — its
 * `lifeStage` field says `"pregnancy"` / `"none"` — so a patient created
 * before these tracks existed still resolves. `"general"`, `"none"` and
 * `"not_applicable"` are recognised but are not tracks, so they parse to null;
 * general wellness is the empty set.
 */
export const parseHealthTrack = (raw: unknown): HealthTrack | null => {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();

  if (value === "pregnancy" || value === "pregnant") return "pregnancy";
  if (value === "pcos" || value === "pcod" || value === "pcod/pcos" || value === "pcos/pcod")
    return "pcos";

  return null;
};

/** True for the values that explicitly mean "no condition track". */
export const isGeneralValue = (raw: unknown): boolean => {
  if (typeof raw !== "string") return false;
  const value = raw.trim().toLowerCase();
  return value === "general" || value === "none" || value === "not_applicable";
};

/** Normalise anything list-shaped into a deduplicated, ordered track set. */
export const parseHealthTracks = (raw: unknown): HealthTracks | null => {
  const list = Array.isArray(raw) ? raw : [raw];
  const parsed = list.map(parseHealthTrack).filter((t): t is HealthTrack => t !== null);

  if (parsed.length > 0) {
    return HEALTH_TRACKS.filter((t) => parsed.includes(t));
  }

  // An explicit "general" is an answer — an empty set — not a missing one.
  return list.some(isGeneralValue) ? [] : null;
};

/** Fields a resolution can be read out of, in priority order. */
export interface HealthTrackSources {
  /** `patients.health_tracks` — the authoritative column once it exists. */
  column?: unknown;
  /** `assessment_data.healthTracks` — written by signup. */
  assessmentTracks?: unknown;
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
 * The tracks a patient is on, from whichever source has an answer.
 *
 * Falls back to the empty set rather than pregnancy: assuming pregnancy is how
 * the app ended up showing a maternal screening to everybody, and a patient
 * whose track we genuinely do not know is better asked than guessed at.
 */
export const resolveHealthTracks = (sources: HealthTrackSources): HealthTracks => {
  const fromColumn = parseHealthTracks(sources.column);
  if (fromColumn) return fromColumn;

  const fromAssessment = parseHealthTracks(sources.assessmentTracks);
  if (fromAssessment) return fromAssessment;

  // Older profiles carry at most one track between these two fields, so they
  // are combined rather than treated as competing answers: a patient whose
  // questionnaire says pregnancy and who also reported PCOS as a condition is
  // on both, and that is exactly the case a single-valued column got wrong.
  const legacy: HealthTrack[] = [];
  if (parseHealthTrack(sources.lifeStage) === "pregnancy") legacy.push("pregnancy");
  if (parseHealthTrack(sources.lifeStage) === "pcos" || mentionsPcos(sources.conditions))
    legacy.push("pcos");

  return HEALTH_TRACKS.filter((t) => legacy.includes(t));
};
