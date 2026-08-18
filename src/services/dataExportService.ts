// "Export my data", for real.
//
// The Settings button used to raise a toast promising an email that no code
// ever sent. This gathers what the app actually holds about a patient and
// hands it over as a JSON file, in the browser, with no backend involved.
//
// Row level security is doing the access control: every query below runs as
// the signed-in user, so it can only ever return that user's own rows. Tables
// that don't exist in a given deployment are skipped rather than failing the
// export — a partial export is far more useful than an error.

import { supabase } from "@/lib/supabase";
import { readCachedSettings, PATIENT_DEFAULTS } from "@/services/userSettingsService";

/** Tables holding a patient's own records, and the column that identifies her. */
const PATIENT_TABLES: Array<{ table: string; column: string }> = [
  { table: "lifestyle_logs", column: "patient_id" },
  { table: "menstrual_cycle_logs", column: "patient_id" },
  { table: "missed_cycle_months", column: "patient_id" },
  { table: "weight_logs", column: "patient_id" },
  { table: "acne_logs", column: "patient_id" },
  { table: "disease_screenings", column: "patient_id" },
  { table: "patient_pantry_items", column: "patient_id" },
  { table: "meal_tracking", column: "patient_id" },
  { table: "meal_feedback", column: "patient_id" },
  { table: "diet_plans", column: "patient_id" },
  { table: "user_settings", column: "user_id" },
];

export interface DataExport {
  exportedAt: string;
  account: { id: string; name?: string };
  profile: unknown;
  records: Record<string, unknown[]>;
  /** Anything held only on this device, e.g. settings saved while offline. */
  onThisDevice: Record<string, unknown>;
  /** Tables that could not be read, and why — an export should be honest. */
  unavailable: Record<string, string>;
}

/** Collect everything the app holds about `userId`. */
export const collectMyData = async (userId: string, name?: string): Promise<DataExport> => {
  const records: Record<string, unknown[]> = {};
  const unavailable: Record<string, string> = {};

  const { data: profile, error: profileError } = await supabase
    .from("patients")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) unavailable.patients = profileError.message;

  await Promise.all(
    PATIENT_TABLES.map(async ({ table, column }) => {
      const { data, error } = await supabase.from(table).select("*").eq(column, userId);
      if (error) {
        unavailable[table] = error.message;
        return;
      }
      records[table] = data ?? [];
    })
  );

  return {
    exportedAt: new Date().toISOString(),
    account: { id: userId, name },
    profile: profile ?? null,
    records,
    onThisDevice: { settings: readCachedSettings(userId, PATIENT_DEFAULTS) },
    unavailable,
  };
};

/** Collect the data and save it as a JSON file. */
export const exportMyData = async (userId: string, name?: string): Promise<void> => {
  const payload = await collectMyData(userId, name);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `prakriva-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Give the download a tick to start before the blob goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
