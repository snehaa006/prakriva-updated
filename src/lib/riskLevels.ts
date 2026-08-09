// Presentation for the screening risk levels, shared by the patient and doctor
// views. Kept out of the component files so the styles can be imported without
// dragging a component along.

import { RiskLevel } from "@/types/diseaseDetection";

/**
 * Risk is the one place in the app where colour has to work hardest, so the
 * three levels escalate in *intensity* as well as hue: pale muted rose → mid
 * coral → saturated red. That ordering survives being read quickly, printed in
 * greyscale, or seen by someone with colour vision deficiency, none of which
 * the old green/amber/red categorical set managed on its own.
 *
 * Every consumer renders `label` alongside the colour, so the level is always
 * stated in words too — colour is reinforcement, never the only carrier.
 */
export const RISK_STYLES: Record<
  RiskLevel,
  { badge: string; bar: string; label: string }
> = {
  low: {
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    bar: "bg-rose-300",
    label: "Low risk",
  },
  moderate: {
    badge: "bg-coral-100 text-coral-800 border-coral-300",
    bar: "bg-coral-500",
    label: "Moderate risk",
  },
  // High risk is the one state that must never be mistaken for the one below
  // it, so it is the only *filled* badge — tint-vs-tint is too subtle once
  // every level lives in the same hue family.
  high: {
    badge: "bg-red-600 text-white border-red-700",
    bar: "bg-red-600",
    label: "High risk",
  },
};
