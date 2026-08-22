// Reads Apple Health data synced by the iOS companion app.
//
// Read-only by design: `public.health_samples` is written exclusively by the
// watch/phone sync, and nothing in the web app should be inventing rows there.
//
// Everything goes through the `health_samples_daily` rollup rather than
// selecting rows. A single patient can hold hundreds of thousands of samples —
// heart rate alone records every few seconds during a workout — so pulling raw
// rows would mean tens of megabytes of JSON to draw a chart with 365 points on
// it. The rollup does the grouping in Postgres and returns day/type buckets.
//
// Both functions are `security invoker`, so the existing RLS policies still
// decide what comes back: a patient sees her own rows, a treating doctor sees
// hers via `doctor_treats()`.

import { supabase } from "@/lib/supabase";
import type { DailyBucket } from "@/lib/healthSamples";

/** Postgres/PostgREST codes meaning "that isn't there (yet)". */
const MISSING_CODES = ["42P01", "42883", "PGRST202", "PGRST205", "PGRST106"];

const isMissing = (error: { code?: string } | null): boolean =>
  !!error && MISSING_CODES.includes(error.code ?? "");

export interface HealthSampleData {
  buckets: DailyBucket[];
  sources: Record<string, string[]>;
  /**
   * True when the rollup functions are not deployed on this project. The panel
   * shows a setup note rather than an error — a project that has not applied
   * the migration is misconfigured, not broken.
   */
  unavailable: boolean;
}

const EMPTY: HealthSampleData = { buckets: [], sources: {}, unavailable: false };

/**
 * Day buckets are cut in the browser's timezone, not UTC.
 *
 * This matters most for sleep: a night that starts at 23:00 and ends at 07:00
 * local straddles midnight UTC, so bucketing in UTC would split one night
 * across two days and halve both.
 */
const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

export const fetchHealthSamples = async (
  patientId: string,
  startIso: string | null
): Promise<HealthSampleData> => {
  if (!patientId) return EMPTY;

  const [daily, sources] = await Promise.all([
    supabase.rpc("health_samples_daily", {
      p_patient_id: patientId,
      p_start: startIso,
      p_tz: browserTimeZone(),
    }),
    supabase.rpc("health_samples_sources", {
      p_patient_id: patientId,
      p_start: startIso,
    }),
  ]);

  if (daily.error) {
    if (isMissing(daily.error)) return { ...EMPTY, unavailable: true };
    throw daily.error;
  }

  const sourceMap: Record<string, string[]> = {};
  // A failure here is not worth losing the charts over — the device names are a
  // nice-to-have caption, not the data.
  if (!sources.error && Array.isArray(sources.data)) {
    for (const row of sources.data as { type: string; sources: string[] | null }[]) {
      sourceMap[row.type] = row.sources ?? [];
    }
  }

  return {
    buckets: (daily.data ?? []) as DailyBucket[],
    sources: sourceMap,
    unavailable: false,
  };
};
