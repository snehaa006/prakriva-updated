// Presentation for the screening risk levels, shared by the patient and doctor
// views. Kept out of the component files so the styles can be imported without
// dragging a component along.

import { RiskLevel } from "@/types/diseaseDetection";

export const RISK_STYLES: Record<
  RiskLevel,
  { badge: string; bar: string; label: string }
> = {
  low: {
    badge: "bg-green-100 text-green-800 border-green-200",
    bar: "bg-green-500",
    label: "Low risk",
  },
  moderate: {
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    bar: "bg-amber-500",
    label: "Moderate risk",
  },
  high: {
    badge: "bg-red-100 text-red-800 border-red-200",
    bar: "bg-red-500",
    label: "High risk",
  },
};
