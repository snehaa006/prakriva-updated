// Doctor settings: the shared settings screen with a doctor's toggles.
//
// This route used to render the words "Settings - Coming Soon". It is the same
// screen the patient side uses — language, notifications, appearance, privacy
// and the account actions, logout included — with the notifications and
// privacy switches that apply to a practitioner.
//
// The data export is deliberately absent: a doctor's records are their
// patients' data, and exporting it from a settings page is not the same
// consent-checked path a clinical record request goes through.

import { AccountSettings } from "@/components/settings/AccountSettings";
import { useTranslation } from "@/context/I18nContext";
import { DOCTOR_DEFAULTS } from "@/services/userSettingsService";

export default function DoctorSettings() {
  const { t } = useTranslation();

  return (
    <AccountSettings
      defaults={DOCTOR_DEFAULTS}
      showExport={false}
      notifications={[
        {
          key: "newConsultationRequests",
          label: t("settings.notif.newRequest"),
          description: t("settings.notif.newRequest.desc"),
        },
        {
          key: "patientAlerts",
          label: t("settings.notif.patientAlerts"),
          description: t("settings.notif.patientAlerts.desc"),
        },
        {
          key: "scheduleChanges",
          label: t("settings.notif.schedule"),
          description: t("settings.notif.schedule.desc"),
        },
        {
          key: "weeklyReports",
          label: t("settings.notif.weekly"),
          description: t("settings.notif.weekly.desc"),
        },
      ]}
      privacy={[
        {
          key: "listedInDirectory",
          label: t("settings.privacy.directory"),
          description: t("settings.privacy.directory.desc"),
        },
        {
          key: "allowAnalytics",
          label: t("settings.privacy.analytics"),
          description: t("settings.privacy.analytics.desc"),
        },
        {
          key: "showOnlineStatus",
          label: t("settings.privacy.onlineStatus"),
          description: t("settings.privacy.onlineStatus.desc"),
        },
      ]}
    />
  );
}
