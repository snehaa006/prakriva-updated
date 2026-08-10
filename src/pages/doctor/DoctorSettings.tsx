// Doctor settings.
//
// `/doctor/settings` was a "Coming Soon" placeholder, which meant a doctor had
// no way to reach the theme control at all. Same screen as the patient side,
// with the practitioner's notification and privacy rows.

import SettingsScreen from "@/components/settings/SettingsScreen";
import { DOCTOR_DEFAULTS } from "@/services/userSettingsService";

const NOTIFICATION_ROWS: [string, string, string][] = [
  ["newConsultationRequests", "settings.notif.newRequest", "settings.notif.newRequest.desc"],
  ["patientAlerts", "settings.notif.patientAlerts", "settings.notif.patientAlerts.desc"],
  ["scheduleChanges", "settings.notif.schedule", "settings.notif.schedule.desc"],
  ["weeklyReports", "settings.notif.weekly", "settings.notif.weekly.desc"],
];

const PRIVACY_ROWS: [string, string, string][] = [
  ["listedInDirectory", "settings.privacy.directory", "settings.privacy.directory.desc"],
  ["allowAnalytics", "settings.privacy.analytics", "settings.privacy.analytics.desc"],
  ["showOnlineStatus", "settings.privacy.onlineStatus", "settings.privacy.onlineStatus.desc"],
];

export default function DoctorSettings() {
  return (
    <SettingsScreen
      role="doctor"
      defaults={DOCTOR_DEFAULTS}
      notificationRows={NOTIFICATION_ROWS}
      privacyRows={PRIVACY_ROWS}
    />
  );
}
