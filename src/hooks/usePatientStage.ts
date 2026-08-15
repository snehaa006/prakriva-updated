import { useApp } from "@/context/AppContext";
import { useCachedPageData } from "@/hooks/useCachedPageData";
import { supabase } from "@/lib/supabase";
import { isPreviewMode } from "@/lib/previewMode";
import { PREVIEW_PROFILE } from "@/lib/previewMockData";
import type { HealthTracks } from "@/lib/healthTrack";

/**
 * Where the signed-in patient is: life stage, trimester and care tracks.
 *
 * The dashboard already loads a much larger profile for its own use. This is
 * the small slice that *other* pages need in order to tailor themselves — the
 * shop, for one — without pulling in the dashboard's meal plans and macros.
 * It shares react-query's cache, so a patient who lands on the shop after the
 * dashboard pays nothing for it.
 *
 * Every field is optional by design: a page using this must still work for a
 * patient whose record is thin, and must never block on it.
 */
export interface PatientStage {
  lifeStage?: string;
  trimester?: string;
  tracks: HealthTracks | null;
}

const fetchStage = async (patientId: string): Promise<Omit<PatientStage, "tracks">> => {
  if (isPreviewMode()) {
    return {
      lifeStage: PREVIEW_PROFILE.lifeStage,
      trimester: PREVIEW_PROFILE.pregnancyTrimester,
    };
  }

  const { data, error } = await supabase
    .from("patients")
    .select("assessment_data")
    .eq("id", patientId)
    .maybeSingle();

  if (error) throw error;

  const assessment = (data?.assessment_data as Record<string, unknown>) ?? {};
  return {
    lifeStage: typeof assessment.lifeStage === "string" ? assessment.lifeStage : undefined,
    trimester:
      typeof assessment.pregnancyTrimester === "string"
        ? assessment.pregnancyTrimester
        : undefined,
  };
};

export function usePatientStage(): PatientStage {
  const { user, healthTracks } = useApp();

  const { data } = useCachedPageData(
    ["patient-stage", user?.id ?? null],
    () => fetchStage(user!.id),
    { enabled: !!user?.id },
  );

  return {
    lifeStage: data?.lifeStage,
    trimester: data?.trimester,
    tracks: healthTracks,
  };
}
