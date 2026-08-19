import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_THEME, applyTheme, initTheme, readTheme, setTheme } from "@/lib/theme";

const stubPrefersDark = (matches: boolean) => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  vi.unstubAllGlobals();
});

describe("readTheme", () => {
  it("defaults to light", () => {
    expect(DEFAULT_THEME).toBe("light");
    expect(readTheme()).toBe("light");
  });

  it("keeps the app light on a machine set to dark mode, until someone asks", () => {
    // The regression this guards: defaulting to "system" turned Prakriva dark
    // for every user whose laptop is in dark mode, which nobody asked for.
    stubPrefersDark(true);
    initTheme();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("reads back a stored choice", () => {
    setTheme("dark");
    expect(readTheme()).toBe("dark");
  });

  it("ignores a junk stored value", () => {
    localStorage.setItem("prakriva:theme", JSON.stringify({ value: "neon", storedAt: Date.now() }));
    expect(readTheme()).toBe("light");
  });
});

describe("applyTheme", () => {
  it("adds and removes the dark class", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("follows the operating system only when asked to", () => {
    stubPrefersDark(true);
    applyTheme("system");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    stubPrefersDark(false);
    applyTheme("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

describe("setTheme", () => {
  it("persists the choice and applies it", () => {
    setTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    // A fresh load picks it back up.
    expect(readTheme()).toBe("dark");
    initTheme();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
