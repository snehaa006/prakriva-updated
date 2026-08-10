// The Settings screen, shared by the patient and doctor areas.
//
// This is the missing half of the theme/language/persistence work: the
// providers and `userSettingsService` already existed, but nothing was wired
// to them, so picking "Dark" set a piece of component state and no more.
//
// Two rules make the theme behave the way people expect:
//
//   1. `ThemeContext` is the source of truth for what is on screen, not the
//      settings object. The select reads `theme` from the provider, so the
//      control can never disagree with the page it is sitting on.
//   2. Choosing a theme applies it immediately and *then* persists. "Light"
//      means light now; "System" hands control back to the OS, including
//      later changes while the app is open.
//
// Everything saves local-first and mirrors to Supabase. When the mirror is
// unavailable the page says so rather than pretending to have synced.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  CloudOff,
  Download,
  Loader2,
  Monitor,
  Moon,
  Palette,
  Shield,
  Sun,
  Trash2,
  UserCog,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/context/AppContext";
import { useTheme, type ThemePreference } from "@/context/ThemeContext";
import { useTranslation } from "@/context/I18nContext";
import { LANGUAGES, type LanguageCode } from "@/i18n/translations";
import {
  loadSettings,
  saveSettings,
  type UserSettings,
} from "@/services/userSettingsService";

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India Standard Time (IST)" },
  { value: "Asia/Dubai", label: "Gulf Standard Time (GST)" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT)" },
];

const THEME_OPTIONS: { value: ThemePreference; icon: typeof Sun; key: string }[] = [
  { value: "light", icon: Sun, key: "settings.theme.light" },
  { value: "dark", icon: Moon, key: "settings.theme.dark" },
  { value: "system", icon: Monitor, key: "settings.theme.system" },
];

/** A labelled switch row. */
const ToggleRow = ({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) => (
  <div className="flex items-start justify-between gap-4">
    <div className="space-y-0.5">
      <Label>{label}</Label>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export interface SettingsScreenProps {
  /** Which notification/privacy set to show. */
  role: "patient" | "doctor";
  defaults: UserSettings;
  /** Notification rows for this role, as [settings key, label key, description key]. */
  notificationRows: [string, string, string][];
  /** Privacy rows for this role, same shape. */
  privacyRows: [string, string, string][];
}

export const SettingsScreen = ({
  role,
  defaults,
  notificationRows,
  privacyRows,
}: SettingsScreenProps) => {
  const { toast } = useToast();
  const { user } = useApp();
  const { theme, setTheme } = useTheme();
  const { t, language, setLanguage } = useTranslation();

  const [settings, setSettings] = useState<UserSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);

  // Load once we know who this is. Without a user we still render the
  // controls — theme and language are device-level and work signed out.
  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setLoading(false);
      return;
    }

    void loadSettings(user.id, defaults).then((result) => {
      if (cancelled) return;
      setSettings(result.settings);
      setSynced(result.synced);
      setLoading(false);
      // The provider owns the live theme; the stored preference only wins if
      // it differs from what this device is already showing.
      if (result.settings.preferences.theme !== theme) {
        setTheme(result.settings.preferences.theme);
      }
      if (result.settings.preferences.language !== language) {
        setLanguage(result.settings.preferences.language);
      }
    });

    return () => {
      cancelled = true;
    };
    // Deliberately keyed on the user only: re-running when the theme or
    // language changes would fight the very controls below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    },
    []
  );

  /** Persist, debounced — a run of toggles is one write, not five. */
  const persist = useCallback(
    (next: UserSettings) => {
      if (!user?.id) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);

      setSaving(true);
      saveTimer.current = window.setTimeout(() => {
        void saveSettings(user.id, next)
          .then((ok) => {
            setSynced(ok);
            setSaving(false);
          })
          .catch(() => {
            setSynced(false);
            setSaving(false);
            toast({
              title: t("settings.saveFailed"),
              variant: "destructive",
            });
          });
      }, 600);
    },
    [user?.id, t, toast]
  );

  const update = useCallback(
    (mutate: (draft: UserSettings) => UserSettings) => {
      setSettings((prev) => {
        const next = mutate(prev);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const setNotification = (key: string, value: boolean) =>
    update((s) => ({ ...s, notifications: { ...s.notifications, [key]: value } }));

  const setPrivacy = (key: string, value: boolean) =>
    update((s) => ({ ...s, privacy: { ...s.privacy, [key]: value } }));

  // Theme: apply first, store second. The select is bound to the provider, so
  // the UI reflects reality even before the write lands.
  const handleTheme = (value: string) => {
    const next = value as ThemePreference;
    setTheme(next);
    update((s) => ({ ...s, preferences: { ...s.preferences, theme: next } }));
  };

  const handleLanguage = (value: string) => {
    const next = value as LanguageCode;
    setLanguage(next);
    update((s) => ({ ...s, preferences: { ...s.preferences, language: next } }));
  };

  const handleTimezone = (value: string) =>
    update((s) => ({ ...s, preferences: { ...s.preferences, timezone: value } }));

  const handleExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      account: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
      settings,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `prakriva-${role}-settings.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = () =>
    toast({
      title: t("settings.delete"),
      description: "Account deletion is handled by support — write to us and we'll confirm within 48 hours.",
      variant: "destructive",
    });

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("settings.title")}</h1>
          <p className="text-muted-foreground">{t("settings.subtitle")}</p>
        </div>

        {/* Save state, stated honestly. */}
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t("action.saving")}
            </>
          ) : synced ? (
            <>
              <Check className="h-4 w-4 text-success" aria-hidden />
              {t("settings.saved")}
            </>
          ) : (
            <>
              <CloudOff className="h-4 w-4" aria-hidden />
              {t("settings.savedLocal")}
            </>
          )}
        </p>
      </div>

      {!synced && (
        <p className="rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          {t("settings.savedLocal.desc")}
        </p>
      )}

      <div className="grid gap-6">
        {/* Appearance first: it is the setting people come here to change. */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t("settings.preferences")}
            </CardTitle>
            <CardDescription>{t("settings.preferences.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="theme-select">{t("settings.theme")}</Label>
              <Select value={theme} onValueChange={handleTheme}>
                <SelectTrigger id="theme-select" className="sm:max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEME_OPTIONS.map(({ value, icon: Icon, key }) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" aria-hidden />
                        {t(key as Parameters<typeof t>[0])}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {theme === "system"
                  ? "Following your device — Prakriva switches when your system does."
                  : `Always ${theme}, on this device and everywhere you sign in.`}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language-select">{t("settings.language")}</Label>
              <Select value={language} onValueChange={handleLanguage}>
                <SelectTrigger id="language-select" className="sm:max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((option) => (
                    <SelectItem
                      key={option.code}
                      value={option.code}
                      disabled={!option.available}
                    >
                      {option.label}
                      {!option.available && ` — ${t("settings.language.unavailable")}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">{t("settings.language.partial")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone-select">{t("settings.timezone")}</Label>
              <Select value={settings.preferences.timezone} onValueChange={handleTimezone}>
                <SelectTrigger id="timezone-select" className="sm:max-w-sm">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t("settings.notifications")}
            </CardTitle>
            <CardDescription>{t("settings.notifications.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {notificationRows.map(([key, labelKey, descKey], i) => (
              <div key={key} className="space-y-4">
                {i > 0 && <Separator />}
                <ToggleRow
                  label={t(labelKey as Parameters<typeof t>[0])}
                  description={t(descKey as Parameters<typeof t>[0])}
                  checked={!!settings.notifications[key]}
                  onChange={(value) => setNotification(key, value)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t("settings.privacy")}
            </CardTitle>
            <CardDescription>{t("settings.privacy.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {privacyRows.map(([key, labelKey, descKey], i) => (
              <div key={key} className="space-y-4">
                {i > 0 && <Separator />}
                <ToggleRow
                  label={t(labelKey as Parameters<typeof t>[0])}
                  description={t(descKey as Parameters<typeof t>[0])}
                  checked={!!settings.privacy[key]}
                  onChange={(value) => setPrivacy(key, value)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              {t("settings.account")}
            </CardTitle>
            <CardDescription>{t("settings.account.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label>{t("settings.export")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.export.desc")}</p>
              </div>
              <Button onClick={handleExport} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                {t("settings.export")}
              </Button>
            </div>

            <Separator />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label>{t("settings.delete")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.delete.desc")}</p>
              </div>
              <Button onClick={handleDelete} variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                {t("settings.delete")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsScreen;
