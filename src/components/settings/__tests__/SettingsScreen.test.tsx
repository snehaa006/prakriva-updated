// The theme control is the one setting whose effect is visible immediately,
// and it was silently broken for a long time (the dropdown existed, nothing
// consumed it). These tests pin the behaviour that matters: choosing a theme
// changes the document, and the choice is persisted.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsScreen from "../SettingsScreen";
import { ThemeProvider } from "@/context/ThemeContext";
import { I18nProvider } from "@/context/I18nContext";
import { PATIENT_DEFAULTS } from "@/services/userSettingsService";

const loadSettings = vi.fn();
const saveSettings = vi.fn();

vi.mock("@/services/userSettingsService", async () => {
  const actual = await vi.importActual<typeof import("@/services/userSettingsService")>(
    "@/services/userSettingsService"
  );
  return {
    ...actual,
    loadSettings: (...args: unknown[]) => loadSettings(...args),
    saveSettings: (...args: unknown[]) => saveSettings(...args),
  };
});

vi.mock("@/context/AppContext", () => ({
  useApp: () => ({ user: { id: "user-1", name: "Asha", email: "a@b.c", role: "patient" } }),
}));

const NOTIFICATION_ROWS: [string, string, string][] = [
  ["mealReminders", "settings.notif.meal", "settings.notif.meal.desc"],
];
const PRIVACY_ROWS: [string, string, string][] = [
  ["allowAnalytics", "settings.privacy.analytics", "settings.privacy.analytics.desc"],
];

const renderScreen = () =>
  render(
    <ThemeProvider>
      <I18nProvider>
        <SettingsScreen
          role="patient"
          defaults={PATIENT_DEFAULTS}
          notificationRows={NOTIFICATION_ROWS}
          privacyRows={PRIVACY_ROWS}
        />
      </I18nProvider>
    </ThemeProvider>
  );

/** Pick an option from the themed Radix select. */
const chooseTheme = async (user: ReturnType<typeof userEvent.setup>, option: RegExp) => {
  await user.click(await screen.findByLabelText("Theme"));
  await user.click(await screen.findByRole("option", { name: option }));
};

describe("SettingsScreen theme control", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    loadSettings.mockReset();
    saveSettings.mockReset();
    loadSettings.mockResolvedValue({ settings: PATIENT_DEFAULTS, synced: true });
    saveSettings.mockResolvedValue(true);
  });

  it("puts the document in dark mode when Dark is chosen", async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseTheme(user, /dark/i);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("returns to light mode when Light is chosen", async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseTheme(user, /dark/i);
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await chooseTheme(user, /light/i);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("follows the operating system when System is chosen", async () => {
    // jsdom's stub reports light; make the OS say dark for this test only.
    const matchMedia = vi
      .spyOn(window, "matchMedia")
      .mockImplementation(
        (query: string) =>
          ({
            matches: query.includes("dark"),
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as unknown as MediaQueryList
      );

    const user = userEvent.setup();
    renderScreen();

    await chooseTheme(user, /light/i);
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await chooseTheme(user, /system/i);
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    matchMedia.mockRestore();
  });

  it("persists the chosen theme", async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseTheme(user, /dark/i);

    await waitFor(
      () => {
        expect(saveSettings).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    const [, saved] = saveSettings.mock.calls.at(-1) as [string, typeof PATIENT_DEFAULTS];
    expect(saved.preferences.theme).toBe("dark");
    // Survives a reload without waiting on the server.
    expect(localStorage.getItem("prakriva:theme")).toContain("dark");
  });

  it("applies the stored preference on load", async () => {
    loadSettings.mockResolvedValue({
      settings: {
        ...PATIENT_DEFAULTS,
        preferences: { ...PATIENT_DEFAULTS.preferences, theme: "dark" as const },
      },
      synced: true,
    });

    renderScreen();

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  it("says so when the settings could only be saved on this device", async () => {
    loadSettings.mockResolvedValue({ settings: PATIENT_DEFAULTS, synced: false });

    renderScreen();

    expect(await screen.findByText(/saved on this device/i)).toBeInTheDocument();
  });
});
