import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

/**
 * Renders the real tracker page against mocked data services.
 *
 * The page is behind an auth guard in the app, so this is the practical way to
 * check that the pieces line up end to end: conditions → recommended exercises
 * → video links, and the demo month → streaks and calendars.
 */

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "patient-1" } } }) },
    from: () => {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.maybeSingle = async () => ({
        // Reported conditions drive the exercise picks.
        data: { assessment_data: { currentConditions: ["Anemia"] } },
        error: null,
      });
      return builder;
    },
  },
}));

const loadLifestyleLogs = vi.fn(async () => ({ logs: [], synced: true }));
const saveLifestyleDay = vi.fn(async () => true);
const writeCachedLogs = vi.fn();
const clearCachedLogs = vi.fn();
const cacheLifestyleDay = vi.fn(() => []);

vi.mock("@/services/lifestyleLogService", () => ({
  loadLifestyleLogs: (...args: unknown[]) => loadLifestyleLogs(...(args as [])),
  saveLifestyleDay: (...args: unknown[]) => saveLifestyleDay(...(args as [])),
  writeCachedLogs: (...args: unknown[]) => writeCachedLogs(...(args as [])),
  clearCachedLogs: (...args: unknown[]) => clearCachedLogs(...(args as [])),
  cacheLifestyleDay: (...args: unknown[]) => cacheLifestyleDay(...(args as [])),
}));

vi.mock("@/services/mealAdherenceService", () => ({
  fetchMealTracking: async () => [],
}));

vi.mock("@/services/diseaseDetectionService", () => ({
  fetchScreenings: async () => [],
  isPregnantPatient: () => false,
}));

// Demo controls are gated; force them on for this test.
vi.mock("@/lib/demoMode", () => ({ isDemoModeAvailable: () => true }));

const LifestyleTracker = (await import("../LifestyleTracker")).default;

const renderPage = async () => {
  render(
    <MemoryRouter>
      <LifestyleTracker />
    </MemoryRouter>
  );
  // Wait out the initial load spinner.
  await screen.findByRole("heading", { name: "Tracker" });
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("the merged tracker page", () => {
  it("shows one page with every section, not four tabs", async () => {
    await renderPage();

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("Movement & Exercise")).toBeInTheDocument();
    expect(screen.getByText("Hydration")).toBeInTheDocument();
    expect(screen.getByText("Sleep")).toBeInTheDocument();
    expect(screen.getByText("Daily Nutrition & Diet Plan")).toBeInTheDocument();
    expect(screen.queryByText(/junk food/i)).not.toBeInTheDocument();
  });

  it("recommends exercises for the patient's reported condition", async () => {
    await renderPage();

    expect(screen.getByText("Why this for Anaemia")).toBeInTheDocument();
    expect(screen.getByText("Gentle walk")).toBeInTheDocument();
    expect(screen.getByText("Pranayama & breathing")).toBeInTheDocument();
    // Nothing breathless belongs in an anaemia plan.
    expect(screen.queryByText("Brisk walk")).not.toBeInTheDocument();
    expect(screen.getByText(/Avoid for now/)).toBeInTheDocument();
  });

  it("attaches a YouTube link to every recommended exercise", async () => {
    await renderPage();

    const links = screen.getAllByRole("link", { name: /watch how to do it/i });
    expect(links.length).toBeGreaterThan(0);

    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      expect(href.startsWith("https://www.youtube.com/results?search_query=")).toBe(true);
      expect(link).toHaveAttribute("target", "_blank");
      // Without noreferrer the opened tab can reach back via window.opener.
      expect(link.getAttribute("rel")).toContain("noopener");
    }
  });
});

describe("demo data", () => {
  it("starts empty, with a zero streak", async () => {
    await renderPage();
    expect(screen.getByText("0 days")).toBeInTheDocument();
  });

  it("fills the page with a month of data and a real streak when loaded", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("button", { name: /load 30 days of demo data/i }));

    // The streak the demo month is built to produce, via the real streak logic.
    await waitFor(() => expect(screen.getByText("4 days")).toBeInTheDocument());
    expect(screen.getByText("best: 6 days")).toBeInTheDocument();
    expect(screen.getByText(/Showing 30 days of demo data/)).toBeInTheDocument();

    // Weekly sleep average is populated rather than the "—" placeholder.
    const sleepCard = screen.getByText("Average Sleep").closest("div")?.parentElement;
    expect(within(sleepCard as HTMLElement).getByText(/\dh$/)).toBeInTheDocument();
  });

  it("never writes fabricated data to Supabase", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("button", { name: /load 30 days of demo data/i }));
    await screen.findByText(/Showing 30 days of demo data/);

    // Logging more water while in demo mode stays in the cache.
    await user.click(screen.getByRole("button", { name: /add glass/i }));

    await waitFor(() => expect(cacheLifestyleDay).toHaveBeenCalled());
    expect(saveLifestyleDay).not.toHaveBeenCalled();
  });

  it("clears back to real data on request", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("button", { name: /load 30 days of demo data/i }));
    await screen.findByText(/Showing 30 days of demo data/);

    await user.click(screen.getByRole("button", { name: /^clear$/i }));

    await waitFor(() =>
      expect(screen.queryByText(/Showing 30 days of demo data/)).not.toBeInTheDocument()
    );
    expect(clearCachedLogs).toHaveBeenCalledWith("patient-1");
    expect(screen.getByText("0 days")).toBeInTheDocument();
  });
});
