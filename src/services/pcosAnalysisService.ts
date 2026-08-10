// Assembling the PCOD/PCOS analysis a doctor sees before generating a plan.
//
// For a pregnant patient the doctor opens Patient Analysis, runs the maternal
// screening pipeline, and generates a plan from the result. A PCOS patient has
// no pipeline to run — she already has the diagnosis, and the models behind
// that page are trained on pregnancy conditions. What stands in its place is
// her own tracking: cycles, weight and exercise, read through
// `src/lib/pcosInsights.ts`.
//
// This module is the fetch half of that. Everything it reads is subject to the
// same RLS the patient's own pages are: a doctor reaches these rows through
// `public.doctor_treats`, so a patient she does not treat returns nothing
// rather than an error.

import { supabase } from "@/lib/supabase";
import { analyseCycles, type CycleAnalysis } from "@/lib/cycleTracking";
import { analyseWeights, type WeightAnalysis, type WeightEntry } from "@/lib/weightLog";
import { analyseAcne, type AcneAnalysis } from "@/lib/acneGuidance";
import {
  buildPcosInsight,
  type ActivitySummary,
  type PcosInsight,
} from "@/lib/pcosInsights";
import { lastNDates, todayIso, weeklyAverages, activeDates } from "@/lib/lifestyleLog";
import { fetchCycleHistoryForDoctor } from "@/services/cycleLogService";
import { fetchWeights } from "@/services/weightLogService";
import { fetchAcneEntries, SkinTrackerUnavailableError } from "@/services/acneLogService";
import { fetchLifestyleLogs } from "@/services/lifestyleLogService";
import { heightCmFromAssessment } from "@/services/diseaseDetectionService";

export interface PcosAnalysis {
  cycles: CycleAnalysis;
  weight: WeightAnalysis;
  acne: AcneAnalysis | null;
  activity: ActivitySummary;
  insight: PcosInsight;
}

/**
 * Everything the PCOS track knows about one patient.
 *
 * Each source is fetched independently and a failure in one degrades to an
 * empty history rather than taking the panel down: a doctor with three of four
 * logs in front of her is better served than one looking at an error, and the
 * insight is explicit about what is missing (`insight.gaps`).
 */
export const fetchPcosAnalysis = async (
  patientId: string,
  heightCm?: number | null
): Promise<PcosAnalysis> => {
  const today = todayIso();

  const [cycleHistory, weights, acneEntries, lifestyleLogs, height] = await Promise.all([
    fetchCycleHistoryForDoctor(patientId).catch((error) => {
      console.error("Could not load cycle history:", error);
      return { periods: [], missedMonths: [] };
    }),
    fetchWeights(patientId).catch((error) => {
      console.error("Could not load weight history:", error);
      return [] as WeightEntry[];
    }),
    fetchAcneEntries(patientId).catch((error) => {
      // A project without the skin tracker tables is expected, not broken.
      if (!(error instanceof SkinTrackerUnavailableError)) {
        console.error("Could not load skin check-ins:", error);
      }
      return [];
    }),
    fetchLifestyleLogs(patientId).catch((error) => {
      console.error("Could not load lifestyle logs:", error);
      return [];
    }),
    heightCm !== undefined
      ? Promise.resolve(heightCm)
      : supabase
          .from("patients")
          .select("assessment_data")
          .eq("id", patientId)
          .maybeSingle()
          .then(({ data }) => heightCmFromAssessment(data?.assessment_data ?? null))
          .catch(() => null),
  ]);

  const cycles = analyseCycles(cycleHistory.periods, cycleHistory.missedMonths, today);
  const weight = analyseWeights(weights, height ?? null, { today });
  const acne = acneEntries.length > 0 ? analyseAcne(acneEntries) : null;

  const week = new Set(lastNDates(7, today));
  const averages = weeklyAverages(lifestyleLogs, today);
  const activity: ActivitySummary = {
    avgMinutesPerDay: averages.avgActivityMinutes,
    activeDaysPerWeek: activeDates(lifestyleLogs).filter((date) => week.has(date)).length,
  };

  return {
    cycles,
    weight,
    acne,
    activity,
    insight: buildPcosInsight({ cycles, weight, activity, acne }),
  };
};
