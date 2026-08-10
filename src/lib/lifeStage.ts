// What life stage a patient is in, and what the app should say and show for it.
//
// This lived as a 45-line `LIFE_STAGE_INFO` literal inside the 1600-line
// patient dashboard, which meant the nutrition guidance for pregnancy was only
// reachable by scrolling past the recipe-search filters. It is domain data, so
// it belongs here: pure, dependency-free, and testable without rendering a
// page. See src/lib/__tests__/lifeStage.test.ts.
//
// Distinct from `HealthTrack` (src/lib/healthTrack.ts). A track is a care
// pathway a patient opts into and can hold several of at once; a life stage is
// the single answer to "where is she right now", stored on her assessment and
// used for tone, illustration and nutrition targets.

/** The illustration that stands for a stage. Resolved to a component by
 *  `src/components/illustrations/lifeStageArt.tsx`. */
export type LifeStageArt = "expecting" | "cradle" | "cycle" | "bloom";

export type LifeStage = "pregnancy" | "postpartum" | "menopause" | "not_applicable";

export interface LifeStageInfo {
  /** How the stage is named in the UI. */
  label: string;
  /** Which line-art mark represents it. */
  art: LifeStageArt;
  /** Badge classes — a tinted chip, never a filled one; this is context, not a status. */
  badgeClass: string;
  /** Nutrition guidance shown alongside the day's meals. */
  tips: string[];
}

export const LIFE_STAGES: Record<LifeStage, LifeStageInfo> = {
  pregnancy: {
    label: "Pregnancy",
    art: "expecting",
    badgeClass: "bg-accent-soft text-accent-soft-foreground border-transparent",
    tips: [
      "Aim for 300-450 extra calories/day",
      "Include iron-rich foods like spinach and lentils",
      "Folate from dark leafy greens is essential",
      "Stay hydrated with 8-10 glasses of water",
    ],
  },
  postpartum: {
    label: "Postpartum",
    art: "cradle",
    badgeClass: "bg-accent-soft text-accent-soft-foreground border-transparent",
    tips: [
      "Focus on nutrient-dense recovery foods",
      "Include galactagogues if breastfeeding",
      "Iron-rich foods aid recovery",
      "Hydration is crucial for milk production",
    ],
  },
  menopause: {
    label: "Menopause",
    art: "cycle",
    badgeClass: "bg-accent-soft text-accent-soft-foreground border-transparent",
    tips: [
      "Calcium (1200mg/day) prevents bone loss",
      "Phytoestrogens in soy may help with symptoms",
      "Limit sodium for blood pressure management",
      "Magnesium-rich foods improve sleep quality",
    ],
  },
  not_applicable: {
    label: "General wellness",
    art: "bloom",
    badgeClass: "bg-accent-soft text-accent-soft-foreground border-transparent",
    tips: [
      "Balanced diet with all food groups",
      "5+ servings of fruits and vegetables daily",
      "Stay hydrated with 2+ liters of water",
      "Whole grains for sustained energy",
    ],
  },
};

/**
 * Resolve whatever the patient record holds to a stage we can render.
 *
 * The value comes from a free-text-ish assessment field, so it arrives absent,
 * empty, or occasionally as a stage this build doesn't know. Every one of those
 * falls back to general wellness rather than blanking the header — a patient
 * with a slightly odd record should still see her dashboard.
 */
export const resolveLifeStage = (raw: string | null | undefined): LifeStage =>
  // `hasOwnProperty`, not `in`: `in` walks the prototype chain, so a record
  // holding "constructor" or "toString" would resolve to a stage and then
  // blow up on `.label`.
  raw && Object.prototype.hasOwnProperty.call(LIFE_STAGES, raw)
    ? (raw as LifeStage)
    : "not_applicable";

/** The info block for a raw stage value, fallback included. */
export const lifeStageInfo = (raw: string | null | undefined): LifeStageInfo =>
  LIFE_STAGES[resolveLifeStage(raw)];

/**
 * The stage line under a greeting: "Pregnancy · T2", "Postpartum", and so on.
 * Trimester only qualifies pregnancy, and only when it's actually recorded.
 */
export const describeLifeStage = (
  raw: string | null | undefined,
  trimester?: string | null,
): string => {
  const stage = resolveLifeStage(raw);
  const { label } = LIFE_STAGES[stage];
  return stage === "pregnancy" && trimester ? `${label} · T${trimester}` : label;
};
