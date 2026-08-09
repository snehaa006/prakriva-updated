// Persistence for the Settings pages.
//
// The settings screens used to be pure component state: every toggle reset on
// navigation and nothing was ever stored. Settings now save locally first (so
// the UI is instant and survives a refresh even offline) and mirror to the
// `user_settings` table, matching the pattern used by the Lifestyle Tracker.
//
// A missing table degrades gracefully — settings still work per-device and the
// page says they aren't synced, rather than erroring.

import { supabase } from "@/lib/supabase";
import { readCache, writeCache } from "@/lib/localCache";
import type { LanguageCode } from "@/i18n/translations";

const MISSING_TABLE_CODES = ["42P01", "PGRST205", "PGRST106"];
const isMissingTable = (error: { code?: string } | null) =>
  !!error && MISSING_TABLE_CODES.includes(error.code ?? "");

const cacheKey = (userId: string) => `user-settings:${userId}`;

export interface UserSettings {
  notifications: Record<string, boolean>;
  preferences: {
    language: LanguageCode;
    timezone: string;
  };
  privacy: Record<string, boolean>;
}

export const PATIENT_DEFAULTS: UserSettings = {
  notifications: {
    mealReminders: true,
    medicineReminders: true,
    appointmentReminders: true,
    weeklyReports: false,
  },
  preferences: { language: "en", timezone: "Asia/Kolkata" },
  privacy: {
    shareDataWithDoctor: true,
    allowAnalytics: false,
    showOnlineStatus: true,
  },
};

export const DOCTOR_DEFAULTS: UserSettings = {
  notifications: {
    newConsultationRequests: true,
    patientAlerts: true,
    scheduleChanges: true,
    weeklyReports: false,
  },
  preferences: { language: "en", timezone: "Asia/Kolkata" },
  privacy: {
    listedInDirectory: true,
    allowAnalytics: false,
    showOnlineStatus: true,
  },
};

/** Merge stored settings over defaults, so a new setting picks up its default. */
const merge = (defaults: UserSettings, stored: unknown): UserSettings => {
  if (!stored || typeof stored !== "object") return defaults;
  const s = stored as Partial<UserSettings>;
  return {
    notifications: { ...defaults.notifications, ...(s.notifications ?? {}) },
    preferences: { ...defaults.preferences, ...(s.preferences ?? {}) },
    privacy: { ...defaults.privacy, ...(s.privacy ?? {}) },
  };
};

/** Cached settings for a user, or the defaults. */
export const readCachedSettings = (userId: string, defaults: UserSettings): UserSettings =>
  merge(defaults, readCache<UserSettings>(cacheKey(userId)));

export const writeCachedSettings = (userId: string, settings: UserSettings): void =>
  writeCache(cacheKey(userId), settings);

/**
 * Load settings: cache first, then whatever the server has.
 *
 * `synced` is false when the server could not be reached or the table is
 * absent, so the page can say the settings are device-only.
 */
export const loadSettings = async (
  userId: string,
  defaults: UserSettings
): Promise<{ settings: UserSettings; synced: boolean }> => {
  const cached = readCachedSettings(userId, defaults);

  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("settings")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      if (isMissingTable(error)) return { settings: cached, synced: false };
      throw new Error(error.message);
    }

    // No row yet is not a failure — it just means nothing has been saved.
    const settings = data?.settings ? merge(defaults, data.settings) : cached;
    writeCachedSettings(userId, settings);
    return { settings, synced: true };
  } catch (error) {
    console.error("Could not load settings; using cached copy:", error);
    return { settings: cached, synced: false };
  }
};

/** Save settings. Returns false when only the local copy could be written. */
export const saveSettings = async (
  userId: string,
  settings: UserSettings
): Promise<boolean> => {
  writeCachedSettings(userId, settings);

  try {
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, settings }, { onConflict: "user_id" });

    if (!error) return true;
    if (isMissingTable(error)) return false;
    throw new Error(error.message);
  } catch (error) {
    console.error("Could not save settings to Supabase:", error);
    return false;
  }
};
