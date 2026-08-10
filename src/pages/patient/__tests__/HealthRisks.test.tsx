import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderPage } from "@/test/renderPage";
import {
  CONDITION_LABELS,
  type ConditionKey,
  type RiskLevel,
  type ScreeningResult,
  type StoredScreening,
} from "@/types/diseaseDetection";

/**
 * Renders the real Health Risks page against a mocked Supabase profile read
 * and a fixed screening history, to check that the Past Checks date-range
 * filter scopes both the trend chart and the list together.
 */

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "patient-1" } } }) },
    from: () => {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.maybeSingle = async () => ({
        data: {
          assessment_data: {
            lifeStage: "pregnancy",
            dueDate: "2026-10-01",
            heightCm: 160,
          },
        },
        error: null,
      });
      builder.update = () => builder;
      return builder;
    },
  },
}));

let fetchScreeningsResult: StoredScreening[] = [];

vi.mock("@/services/diseaseDetectionService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/diseaseDetectionService")>();
  return {
    ...actual,
    fetchScreenings: async () => fetchScreeningsResult,
    // The page loads itself through this one call (cached by react-query), so
    // it is what has to be stubbed — the real one would call the real
    // `fetchScreenings` internally, past the stub above.
    loadHealthCheck: async () => ({
      assessment: {
        lifeStage: "pregnancy",
        dueDate: "2026-10-01",
        heightCm: 160,
      },
      screenings: fetchScreeningsResult,
    }),
  };
});

const { emptyScreeningInput } = await import("@/services/diseaseDetectionService");
const HealthRisks = (await import("../HealthRisks")).default;

const CONDITIONS: ConditionKey[] = ["anaemia", "pregnancy_risk", "gdm", "thyroid"];

const makeResult = (score: number, overall: RiskLevel): ScreeningResult => ({
  generated_at: "2026-08-09T08:00:00Z",
  overall_risk_level: overall,
  highest_risk_condition: "anaemia",
  disclaimer: "Screening support only, not a diagnosis.",
  conditions: CONDITIONS.map((condition) => ({
    condition,
    label: CONDITION_LABELS[condition],
    score,
    risk_level: overall,
    reasons: [],
    recommendations: [],
    detector: "test-detector",
    details: {},
  })),
});

// Fixed reference point rather than fake timers, so day-boundary maths stays
// simple and userEvent's own internal timers are untouched.
const NOW = Date.now();
const daysAgoIso = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

const screening = (
  id: string,
  daysAgo: number,
  score: number,
  overall: RiskLevel
): StoredScreening => ({
  id,
  patientId: "patient-1",
  doctorId: null,
  submittedBy: "patient",
  createdAt: daysAgoIso(daysAgo),
  inputs: emptyScreeningInput(),
  result: makeResult(score, overall),
});

// Newest-first, matching what fetchScreenings returns for real.
const FIVE_CHECKS: StoredScreening[] = [
  screening("s-today", 0, 15, "low"),
  screening("s-5", 5, 25, "low"),
  screening("s-20", 20, 40, "moderate"),
  screening("s-40", 40, 55, "moderate"),
  screening("s-60", 60, 70, "high"),
];

const renderHistoryTab = async () => {
  renderPage(<HealthRisks />);
  await screen.findByRole("heading", { name: "Pregnancy Health Check" });
  await userEvent.click(screen.getByRole("tab", { name: /past checks/i }));
};

beforeEach(() => {
  fetchScreeningsResult = [];
});

describe("Past Checks — date-range filter and trend chart", () => {
  it("defaults to showing every check and a risk score trend", async () => {
    fetchScreeningsResult = FIVE_CHECKS;
    await renderHistoryTab();

    expect(await screen.findByText("All 5 checks")).toBeInTheDocument();
    expect(screen.getByText("Risk score trend")).toBeInTheDocument();
    for (const condition of CONDITIONS) {
      expect(screen.getByText(CONDITION_LABELS[condition])).toBeInTheDocument();
    }
  });

  it("narrows the list and chart together to the last 7 days", async () => {
    fetchScreeningsResult = FIVE_CHECKS;
    await renderHistoryTab();

    await userEvent.click(screen.getByRole("button", { name: "7 days" }));

    // Only the 0-day and 5-day-old checks fall inside a 7-day window.
    expect(await screen.findByText("2 of 5 checks")).toBeInTheDocument();
  });

  it("hides the trend chart (but keeps the list) when only one check is in range", async () => {
    fetchScreeningsResult = FIVE_CHECKS;
    await renderHistoryTab();

    await userEvent.click(screen.getByRole("button", { name: "Today" }));

    expect(await screen.findByText("1 of 5 checks")).toBeInTheDocument();
    expect(screen.queryByText("Risk score trend")).not.toBeInTheDocument();
  });

  it("shows an empty-range state with a way back to all checks", async () => {
    fetchScreeningsResult = [screening("s-old", 60, 70, "high")];
    await renderHistoryTab();

    await userEvent.click(screen.getByRole("button", { name: "7 days" }));

    expect(await screen.findByText(/Nothing found for the last 7 days/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show all" }));

    expect(await screen.findByText("All 1 check")).toBeInTheDocument();
  });

  it("shows a first-time empty state when there is no history at all", async () => {
    fetchScreeningsResult = [];
    await renderHistoryTab();

    expect(await screen.findByText("No checks yet")).toBeInTheDocument();
    expect(screen.getByText("You have not completed a health check yet.")).toBeInTheDocument();
  });
});
