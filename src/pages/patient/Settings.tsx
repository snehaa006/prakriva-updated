// Patient settings. The screen itself is shared with the doctor area — this
// page only says which notification and privacy rows a patient sees.

import SettingsScreen from "@/components/settings/SettingsScreen";
import { PATIENT_DEFAULTS } from "@/services/userSettingsService";

const NOTIFICATION_ROWS: [string, string, string][] = [
  ["mealReminders", "settings.notif.meal", "settings.notif.meal.desc"],
  ["medicineReminders", "settings.notif.medicine", "settings.notif.medicine.desc"],
  ["appointmentReminders", "settings.notif.appointment", "settings.notif.appointment.desc"],
  ["weeklyReports", "settings.notif.weekly", "settings.notif.weekly.desc"],
];

const PRIVACY_ROWS: [string, string, string][] = [
  ["shareDataWithDoctor", "settings.privacy.shareDoctor", "settings.privacy.shareDoctor.desc"],
  ["allowAnalytics", "settings.privacy.analytics", "settings.privacy.analytics.desc"],
  ["showOnlineStatus", "settings.privacy.onlineStatus", "settings.privacy.onlineStatus.desc"],
];

export default function Settings() {
  return (
    <SettingsScreen
      role="patient"
      defaults={PATIENT_DEFAULTS}
      notificationRows={NOTIFICATION_ROWS}
      privacyRows={PRIVACY_ROWS}
    />
  );
}
