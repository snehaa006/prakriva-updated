import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthUserId } from "@/hooks/useAuthUserId";

/**
 * A patient the signed-in doctor is allowed to work with.
 *
 * `id` is the auth/`patients.id` UUID — the value every table (diet_plans,
 * patient_pantry_items, …) keys on. `code` is the human-facing P001-style
 * `patients.patient_code`. Mixing the two up is what made saved plans fail, so
 * anything that talks to the database must use `id`, and only ever show `code`.
 */
export interface DoctorPatient {
  id: string;
  code: string;
  name: string;
  email: string;
  requestStatus: string;
  /** Questionnaire/consultation payload, merged for diet-chart generation. */
  profile: Record<string, unknown>;
  /**
   * `patients.health_tracks` — which care pathways she signed up for. Null in a
   * project that has not applied `supabase/pcos_tracking.sql`; callers fall
   * back to `assessment_data` through `resolveHealthTracks`.
   */
  healthTracks: string[] | null;
}

/** The statuses `public.doctor_treats()` accepts — i.e. patients the doctor can write for. */
export const TREATED_STATUSES = ["pending", "accepted", "completed"] as const;

interface UseDoctorPatientsOptions {
  /** Restrict to certain consultation statuses. Defaults to every treated status. */
  statuses?: readonly string[];
  enabled?: boolean;
}

interface ConsultationRow {
  patient_id: string;
  patient_name: string | null;
  patient_email: string | null;
  status: string;
  requested_at: string;
  full_patient_profile: Record<string, unknown> | null;
  patients: {
    patient_code: string | null;
    name: string | null;
    email: string | null;
    assessment_data: Record<string, unknown> | null;
    health_tracks?: string[] | null;
  } | null;
}

/** Postgres/PostgREST codes meaning "that column isn't there (yet)". */
const MISSING_COLUMN_CODES = ["42703", "PGRST204", "PGRST100"];

export const doctorPatientsQueryKey = (
  doctorId: string | undefined,
  statuses: readonly string[]
) => ["doctor-patients", doctorId ?? "anonymous", [...statuses].sort().join(",")];

export async function fetchDoctorPatients(
  doctorId: string,
  statuses: readonly string[]
): Promise<DoctorPatient[]> {
  const select = (patientColumns: string) =>
    supabase
      .from("consultation_requests")
      .select(
        `patient_id, patient_name, patient_email, status, requested_at, full_patient_profile,
         patients ( ${patientColumns} )`
      )
      .eq("doctor_id", doctorId)
      .in("status", [...statuses])
      .order("requested_at", { ascending: false });

  let { data, error } = await select(
    "patient_code, name, email, assessment_data, health_tracks"
  );

  // `health_tracks` arrived with the PCOD/PCOS tracks. Retry without it rather
  // than leaving the whole patient list broken in a project that has not
  // applied the migration — the tracks still resolve from `assessment_data`.
  if (error && MISSING_COLUMN_CODES.includes(error.code ?? "")) {
    ({ data, error } = await select("patient_code, name, email, assessment_data"));
  }

  if (error) throw new Error(error.message);

  // A doctor can have several requests from the same patient; keep the newest.
  const byPatient = new Map<string, DoctorPatient>();

  for (const row of (data ?? []) as unknown as ConsultationRow[]) {
    if (!row.patient_id || byPatient.has(row.patient_id)) continue;

    const record = row.patients;
    const assessment = record?.assessment_data ?? {};
    const profile: Record<string, unknown> = {
      ...(row.full_patient_profile ?? {}),
      ...assessment,
      assessmentData: assessment,
      patientId: record?.patient_code ?? row.patient_id,
      name: record?.name || row.patient_name || "Unknown",
    };

    byPatient.set(row.patient_id, {
      id: row.patient_id,
      code: record?.patient_code ?? row.patient_id,
      name: record?.name || row.patient_name || "Unknown",
      email: record?.email || row.patient_email || "",
      requestStatus: row.status,
      profile,
      healthTracks: record?.health_tracks ?? null,
    });
  }

  return [...byPatient.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The signed-in doctor's own patients. Cached by react-query so navigating
 * between pages (or coming back after a refresh within the stale window) does
 * not re-hit Supabase.
 */
export function useDoctorPatients(options: UseDoctorPatientsOptions = {}) {
  const { statuses = TREATED_STATUSES, enabled = true } = options;

  // Shared with every other page through `useAuthUserId`'s cache key, so the
  // auth server is asked once rather than per page.
  const doctorId = useAuthUserId() ?? undefined;

  const patientsQuery = useQuery({
    queryKey: doctorPatientsQueryKey(doctorId, statuses),
    queryFn: () => fetchDoctorPatients(doctorId as string, statuses),
    enabled: enabled && !!doctorId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    doctorId,
    patients: patientsQuery.data ?? [],
    // Still resolving who is signed in counts as loading — the patients query
    // has not been allowed to start yet.
    isLoading: !doctorId || patientsQuery.isLoading,
    isFetching: patientsQuery.isFetching,
    error: patientsQuery.error as Error | null,
    refetch: patientsQuery.refetch,
  };
}

export default useDoctorPatients;
