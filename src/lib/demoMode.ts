// Demo mode for the Lifestyle Tracker: a month of fabricated logs so the
// streaks, calendars, charts and adherence roll-up can be shown working
// without waiting a month for real ones to accumulate.
//
// Two invariants keep fabricated data from ever being mistaken for a patient's
// own history:
//
//  1. It is never written to Supabase, and never written to the lifestyle-log
//     cache either — it is generated on the fly from the flag below. So it
//     cannot leak into the real data on this device or any other.
//  2. Whenever it is showing, the page says so. The flag is persisted, so that
//     stays true across a refresh; an in-memory flag would come back false and
//     leave a fake month looking real.

import { clearCache, readCache, writeCache } from "@/lib/localCache";

/**
 * Per-patient, so switching accounts can't inherit someone else's demo mode.
 *
 * Accepts `null` because the id arrives asynchronously: the page renders (and
 * the toggle can be clicked) before `auth.getUser()` resolves. Falling back to
 * a shared key means the flag is never silently dropped in that window.
 */
const demoFlagKey = (patientId: string | null) =>
  `lifestyle-demo:${patientId ?? "pending"}`;

/**
 * Whether the demo controls are offered at all.
 *
 * Available on every build: this app's whole purpose right now is being shown
 * to people, and a toggle that only exists on localhost cannot do that. The
 * safety comes from it being off by default, needing an explicit click, and
 * announcing itself in a banner for as long as it is on — not from being
 * hidden. `?demo=1` still works as a direct link for a walkthrough.
 */
export const isDemoModeAvailable = (): boolean => true;

/** True when this URL explicitly asks to start in demo mode. */
export const isDemoRequestedByUrl = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).get("demo") === "1";
  } catch {
    return false;
  }
};

/** Whether demo data is currently switched on for this patient. */
export const isDemoDataOn = (patientId: string | null): boolean =>
  readCache<boolean>(demoFlagKey(patientId)) === true;

export const setDemoDataOn = (patientId: string | null, on: boolean): void => {
  if (on) writeCache(demoFlagKey(patientId), true);
  else clearCache(demoFlagKey(patientId));
};
