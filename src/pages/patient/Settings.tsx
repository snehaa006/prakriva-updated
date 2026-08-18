// Patient settings: the shared settings screen with a patient's toggles.
//
// The screen itself lives in `src/components/settings/AccountSettings.tsx` —
// it is the same for both roles, and logging out lives inside it rather than
// in the sidebar.

import { AccountSettings } from "@/components/settings/AccountSettings";
import { useTranslation } from "@/context/I18nContext";
import { PATIENT_DEFAULTS } from "@/services/userSettingsService";

export default function Settings() {
  const { t } = useTranslation();

  return (
    <AccountSettings
      defaults={PATIENT_DEFAULTS}
      notifications={[
        {
          key: "mealReminders",
          label: t("settings.notif.meal"),
          description: t("settings.notif.meal.desc"),
        },
        {
          key: "medicineReminders",
          label: t("settings.notif.medicine"),
          description: t("settings.notif.medicine.desc"),
        },
        {
          key: "appointmentReminders",
          label: t("settings.notif.appointment"),
          description: t("settings.notif.appointment.desc"),
        },
        {
          key: "weeklyReports",
          label: t("settings.notif.weekly"),
          description: t("settings.notif.weekly.desc"),
        },
      ]}
      privacy={[
        {
          key: "shareDataWithDoctor",
          label: t("settings.privacy.shareDoctor"),
          description: t("settings.privacy.shareDoctor.desc"),
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
