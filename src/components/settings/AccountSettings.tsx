// Settings — preferences, privacy, and the account actions including logout.
//
// Shared by the patient and doctor settings pages: the sections are identical,
// only the toggles differ, so they are passed in rather than duplicated.
//
// Three things changed when this replaced the old screens, all of them things
// that used to look like features and behave like decoration:
//
// - **Settings persist.** Every toggle is written to this device immediately
//   and mirrored to Supabase, instead of resetting the moment you navigate
//   away.
// - **The language picker works, everywhere.** It drives the app-wide
//   translator (see `src/context/I18nContext.tsx`), so changing it here
//   translates this page and every other one, not just the menu labels.
// - **Logging out lives here.** It was a sidebar row next to the navigation,
//   which put "sign me out" one slip away from "open my meal log", and it
//   never actually ended the Supabase session. Now it is an account action,
//   behind a confirmation, and it signs out for real.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Cloud,
  CloudOff,
  Download,
  Globe,
  Loader2,
  LogOut,
  Moon,
  Shield,
  Trash2,
  UserCog,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/context/AppContext";
import { useTranslation } from "@/context/I18nContext";
import { LanguageSelect } from "@/components/LanguageSelect";
import { signOutUser } from "@/services/authService";
import {
  loadSettings,
  readCachedSettings,
  saveSettings,
  type UserSettings,
} from "@/services/userSettingsService";
import { exportMyData } from "@/services/dataExportService";
import { readTheme, setTheme, type ThemeChoice } from "@/lib/theme";

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India Standard Time (IST)" },
  { value: "Asia/Dubai", label: "Gulf Standard Time (GST)" },
  { value: "Asia/Singapore", label: "Singapore Time (SGT)" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT)" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
];

/** One switch: which stored flag it drives, and how it reads. */
export interface SettingsToggle {
  key: string;
  label: string;
  description: string;
}

export interface AccountSettingsProps {
  /** Defaults for this role — see `userSettingsService`. */
  defaults: UserSettings;
  notifications: SettingsToggle[];
  privacy: SettingsToggle[];
  /**
   * Whether to offer the data export. It collects a patient's own clinical
   * records, so it is patient-only; a doctor's export would be other people's
   * data.
   */
  showExport?: boolean;
}

export function AccountSettings({
  defaults,
  notifications: notificationToggles,
  privacy: privacyToggles,
  showExport = true,
}: AccountSettingsProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, setUser } = useApp();
  const { t, language, setLanguage, hasDeviceChoice } = useTranslation();

  const [settings, setSettings] = useState<UserSettings>(() =>
    user ? readCachedSettings(user.id, defaults) : defaults
  );
  const [theme, setThemeChoice] = useState<ThemeChoice>(readTheme);
  const [synced, setSynced] = useState<boolean | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const appliedStoredLanguage = useRef(false);

  // Load once per user: cache first (already in state), then the server.
  useEffect(() => {
    if (!user) return;
    let active = true;

    void loadSettings(user.id, defaults).then((result) => {
      if (!active) return;
      setSettings(result.settings);
      setSynced(result.synced);

      // The account's language applies on a device that has not chosen one
      // yet — that is what makes the choice follow you to a new phone. A
      // choice made on this device always wins, otherwise loading settings
      // would quietly undo the language the user just picked.
      if (!appliedStoredLanguage.current) {
        appliedStoredLanguage.current = true;
        if (!hasDeviceChoice && result.settings.preferences.language !== language) {
          setLanguage(result.settings.preferences.language);
        }
      }
    });

    return () => {
      active = false;
    };
    // `language`/`setLanguage` are deliberately not dependencies: this runs for
    // a user, not for every language change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Keep the stored preference in step when the language is changed from
  // anywhere — this page, the header switcher, another tab.
  useEffect(() => {
    if (!user || settings.preferences.language === language) return;
    const next: UserSettings = {
      ...settings,
      preferences: { ...settings.preferences, language },
    };
    setSettings(next);
    void saveSettings(user.id, next).then(setSynced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, user?.id]);

  const persist = (next: UserSettings) => {
    setSettings(next);
    if (!user) return;

    void saveSettings(user.id, next).then((ok) => {
      setSynced(ok);
      if (!ok) {
        toast({
          title: t("settings.savedLocal"),
          description: t("settings.savedLocal.desc"),
        });
      }
    });
  };

  const setNotification = (key: string, value: boolean) =>
    persist({ ...settings, notifications: { ...settings.notifications, [key]: value } });

  const setPrivacy = (key: string, value: boolean) =>
    persist({ ...settings, privacy: { ...settings.privacy, [key]: value } });

  const setTimezone = (timezone: string) =>
    persist({ ...settings, preferences: { ...settings.preferences, timezone } });

  const handleTheme = (value: ThemeChoice) => {
    setThemeChoice(value);
    setTheme(value);
  };

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      await exportMyData(user.id, user.name);
      toast({
        title: "Export ready",
        description: "Your data has been downloaded as a JSON file.",
      });
    } catch (error) {
      toast({
        title: "Could not export your data",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = () => {
    toast({
      title: "Account deletion",
      description:
        "Deleting an account also deletes your clinical records, so it is done by request: email support@prakriva.app from this address and we will confirm within 48 hours.",
    });
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOutUser();
    setUser(null);
    navigate("/", { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t("settings.title")}</h1>
        <p className="text-muted-foreground">{t("settings.subtitle")}</p>
        {synced !== null && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            {synced ? <Cloud className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
            {synced ? "Saved to your account" : t("settings.savedLocal")}
          </p>
        )}
      </div>

      <div className="grid gap-6">
        {/* Language — first, because it changes everything below it */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t("settings.language")}
            </CardTitle>
            <CardDescription>{t("settings.language.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <LanguageSelect />

            <div className="space-y-2">
              <Label>{t("settings.timezone")}</Label>
              <Select value={settings.preferences.timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((zone) => (
                    <SelectItem key={zone.value} value={zone.value}>
                      {zone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t("settings.notifications")}
            </CardTitle>
            <CardDescription>{t("settings.notifications.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {notificationToggles.map((item, index) => (
              <div key={item.key}>
                {index > 0 && <Separator className="mb-4" />}
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <Label>{item.label}</Label>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <Switch
                    checked={Boolean(settings.notifications[item.key])}
                    onCheckedChange={(value) => setNotification(item.key, value)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5" />
              {t("settings.appearance")}
            </CardTitle>
            <CardDescription>{t("settings.appearance.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>{t("settings.theme")}</Label>
              <Select value={theme} onValueChange={(value) => handleTheme(value as ThemeChoice)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t("settings.theme.light")}</SelectItem>
                  <SelectItem value="dark">{t("settings.theme.dark")}</SelectItem>
                  <SelectItem value="system">{t("settings.theme.system")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t("settings.privacy")}
            </CardTitle>
            <CardDescription>{t("settings.privacy.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {privacyToggles.map((item, index) => (
              <div key={item.key}>
                {index > 0 && <Separator className="mb-4" />}
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <Label>{item.label}</Label>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <Switch
                    checked={Boolean(settings.privacy[item.key])}
                    onCheckedChange={(value) => setPrivacy(item.key, value)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Account — data, then session, then the irreversible one */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              {t("settings.account")}
            </CardTitle>
            <CardDescription>{t("settings.account.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {showExport && (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <Label>{t("settings.export")}</Label>
                    <p className="text-sm text-muted-foreground">{t("settings.export.desc")}</p>
                  </div>
                  <Button
                    onClick={handleExport}
                    variant="outline"
                    disabled={exporting}
                    className="h-10 w-full sm:w-auto"
                  >
                    {exporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {t("settings.export")}
                  </Button>
                </div>

                <Separator />
              </>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1 space-y-0.5">
                <Label>{t("settings.logout")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.logout.desc")}</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={loggingOut} className="h-10 w-full sm:w-auto">
                    {loggingOut ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="mr-2 h-4 w-4" />
                    )}
                    {t("settings.logout")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("settings.logout.confirm")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("settings.logout.confirmDesc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("action.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void handleLogout()}>
                      {t("settings.logout")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1 space-y-0.5">
                <Label>{t("settings.delete")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.delete.desc")}</p>
              </div>
              <Button
                onClick={handleDeleteAccount}
                variant="destructive"
                className="h-10 w-full sm:w-auto"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("settings.delete")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AccountSettings;
