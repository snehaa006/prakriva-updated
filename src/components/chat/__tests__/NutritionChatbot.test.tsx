import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NutritionChatbot from "@/components/chat/NutritionChatbot";
import { AnalysisUnavailableError, askChat, isAnalysisEnabled } from "@/services/analysisService";
import { fetchPatientChatContext } from "@/services/chatAssistantService";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "patient-1" } } }) },
  },
}));

vi.mock("@/services/analysisService", async () => {
  const actual = await vi.importActual<typeof import("@/services/analysisService")>(
    "@/services/analysisService"
  );
  return {
    ...actual,
    askChat: vi.fn(),
    isAnalysisEnabled: vi.fn(),
  };
});

vi.mock("@/services/chatAssistantService", async () => {
  const actual = await vi.importActual<typeof import("@/services/chatAssistantService")>(
    "@/services/chatAssistantService"
  );
  return {
    ...actual,
    fetchPatientChatContext: vi.fn(),
    maybeFetchRecipeCandidates: vi.fn().mockResolvedValue([]),
  };
});

const todayIso = new Date().toISOString().slice(0, 10);

const emptyContext = {
  profile: {},
  activePlan: null,
  pantry: { atHome: [], toBuy: [] },
  mealAdherence: { days: [] },
  mealFeedback: [],
  lifestyle: { days: [] },
  screenings: [],
};

const openChat = async (user: ReturnType<typeof userEvent.setup>) => {
  render(<NutritionChatbot />);
  await user.click(screen.getByRole("button", { name: /open wellness companion/i }));
};

const send = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
  await user.type(screen.getByPlaceholderText(/ask me anything/i), text);
  await user.keyboard("{Enter}");
};

describe("NutritionChatbot", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(isAnalysisEnabled).mockResolvedValue(true);
    vi.mocked(fetchPatientChatContext).mockResolvedValue(emptyContext);
    vi.mocked(askChat).mockReset();
  });

  it("answers a message sent before the status check has resolved", async () => {
    // The status check used to gate sending, so the very first message of a
    // session was answered with "isn't available" on a healthy deployment.
    let resolveStatus: (enabled: boolean) => void = () => {};
    vi.mocked(isAnalysisEnabled).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveStatus = resolve;
      })
    );
    vi.mocked(askChat).mockResolvedValue("Here's an idea.");

    const user = userEvent.setup();
    await openChat(user);
    await send(user, "hello");

    await waitFor(() => expect(screen.getByText("Here's an idea.")).toBeInTheDocument());
    expect(screen.queryByText(/isn't available right now/i)).not.toBeInTheDocument();
    resolveStatus(true);
  });

  it("never opens the history it sends with a model turn", async () => {
    // The transcript starts with the assistant's welcome message; Gemini
    // requires a conversation to begin with a user turn.
    vi.mocked(askChat).mockResolvedValue("Reply one.");

    const user = userEvent.setup();
    await openChat(user);
    await send(user, "hi");
    await waitFor(() => expect(screen.getByText("Reply one.")).toBeInTheDocument());

    vi.mocked(askChat).mockResolvedValue("Reply two.");
    await send(user, "and again");
    await waitFor(() => expect(screen.getByText("Reply two.")).toBeInTheDocument());

    const history = vi.mocked(askChat).mock.calls[1][1];
    expect(history[0]).toEqual({ role: "user", text: "hi" });
    expect(history).toEqual([
      { role: "user", text: "hi" },
      { role: "model", text: "Reply one." },
    ]);
  });

  it("keeps failure notices out of the history it replays", async () => {
    vi.mocked(askChat).mockRejectedValueOnce(new Error("boom"));

    const user = userEvent.setup();
    await openChat(user);
    await send(user, "hi");
    await waitFor(() => expect(screen.getByText(/couldn't reach your assistant/i)).toBeInTheDocument());

    vi.mocked(askChat).mockResolvedValue("Recovered.");
    await send(user, "try again");
    await waitFor(() => expect(screen.getByText("Recovered.")).toBeInTheDocument());

    expect(vi.mocked(askChat).mock.calls[1][1]).toEqual([{ role: "user", text: "hi" }]);
  });

  it("shows why a call failed rather than only that it did", async () => {
    vi.mocked(askChat).mockRejectedValue(
      new AnalysisUnavailableError("Gemini returned HTTP 429 (RESOURCE_EXHAUSTED)")
    );

    const user = userEvent.setup();
    await openChat(user);
    await send(user, "hi");

    await waitFor(() =>
      expect(screen.getByText(/RESOURCE_EXHAUSTED/)).toBeInTheDocument()
    );
    expect(screen.getByText(/isn't available right now/i)).toBeInTheDocument();
  });
  it("opens with the most useful thing it has to raise, as a card", async () => {
    // The companion doesn't wait to be asked: a health check that landed today
    // is offered the moment the panel opens, with four ways into it.
    vi.mocked(fetchPatientChatContext).mockResolvedValue({
      ...emptyContext,
      screenings: [{ date: todayIso, overallRisk: "Moderate", conditions: [] }],
    });

    const user = userEvent.setup();
    await openChat(user);

    await waitFor(() =>
      expect(screen.getByText(/where should we start\?/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /walk me through it/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /am i improving\?/i })).toBeInTheDocument();
  });

  it("asks the assistant the question behind the option she picked", async () => {
    vi.mocked(fetchPatientChatContext).mockResolvedValue({
      ...emptyContext,
      screenings: [{ date: todayIso, overallRisk: "Low", conditions: [] }],
    });
    vi.mocked(askChat).mockResolvedValue("Here's what it says.");

    const user = userEvent.setup();
    await openChat(user);

    await waitFor(() => screen.getByRole("button", { name: /walk me through it/i }));
    await user.click(screen.getByRole("button", { name: /walk me through it/i }));

    // A choice is acknowledged, never marked right or wrong — this is a
    // wellness chat, not a quiz.
    expect(screen.getByText(/one finding at a time/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() =>
      expect(vi.mocked(askChat).mock.calls[0][0]).toBe(
        "Walk me through my latest health check in plain language.",
      ),
    );
  });

  it("follows an answer with chips about what was just asked", async () => {
    vi.mocked(askChat).mockResolvedValue("Try a warm khichdi.");

    const user = userEvent.setup();
    await openChat(user);
    await send(user, "what should I cook for dinner?");
    await waitFor(() => expect(screen.getByText("Try a warm khichdi.")).toBeInTheDocument());

    const chip = await screen.findByRole("button", { name: /something lighter/i });
    vi.mocked(askChat).mockResolvedValue("Then try a light soup.");
    await user.click(chip);

    await waitFor(() =>
      expect(vi.mocked(askChat).mock.calls[1][0]).toBe("Could you suggest a lighter version of that?"),
    );
  });

  it("renders the Markdown the model writes instead of showing its asterisks", async () => {
    vi.mocked(askChat).mockResolvedValue("Favour **warm** food.\n\n- Ginger tea\n- Warm water");

    const user = userEvent.setup();
    await openChat(user);
    await send(user, "hi");

    await waitFor(() => expect(screen.getByText("warm")).toBeInTheDocument());
    expect(screen.getByText("warm").tagName).toBe("STRONG");
    expect(screen.queryByText(/\*\*warm\*\*/)).not.toBeInTheDocument();
    expect(screen.getByText("Ginger tea")).toBeInTheDocument();
  });
});