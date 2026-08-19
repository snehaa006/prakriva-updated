import { describe, expect, it } from "vitest";

import {
  buildFollowUps,
  buildLeadUps,
  buildProactiveCues,
  nextUnseenCue,
  relativeDay,
} from "@/lib/companionCues";
import type { PatientChatContext } from "@/services/chatAssistantService";

const emptyContext = (): PatientChatContext => ({
  profile: {},
  activePlan: null,
  pantry: { atHome: [], toBuy: [] },
  mealAdherence: { days: [] },
  mealFeedback: [],
  lifestyle: { days: [] },
  screenings: [],
});

const isoDaysAgo = (now: Date, days: number): string =>
  new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);

/** A fixed mid-afternoon clock, so time-of-day cues are deterministic. */
const afternoon = new Date("2026-02-10T15:30:00");
const morning = new Date("2026-02-10T08:00:00");

describe("buildProactiveCues", () => {
  it("has nothing to say without a context", () => {
    expect(buildProactiveCues(null, { now: afternoon })).toEqual([]);
  });

  it("always offers the daily read, even with an empty history", () => {
    const cues = buildProactiveCues(emptyContext(), { now: afternoon });
    expect(cues).toHaveLength(1);
    expect(cues[0].id).toBe("daily-2026-02-10");
    expect(cues[0].card?.options).toHaveLength(4);
  });

  it("leads with a health check from the last week and names its risk", () => {
    const ctx = emptyContext();
    ctx.screenings = [
      { date: isoDaysAgo(afternoon, 20), overallRisk: "Low", conditions: [] },
      {
        date: isoDaysAgo(afternoon, 1),
        overallRisk: "Moderate",
        conditions: [{ label: "PCOS", riskLevel: "High", score: 0.8 }],
      },
    ];

    const [first] = buildProactiveCues(ctx, { now: afternoon });
    expect(first.id).toBe(`report-${isoDaysAgo(afternoon, 1)}`);
    expect(first.teaser).toContain("yesterday");
    expect(first.message).toContain("moderate risk");
    expect(first.message).toContain("PCOS at high");
    // Four questions to pick from, not four answers to be marked on.
    expect(first.card?.options.map((o) => o.id)).toEqual([
      "walk-through",
      "eat",
      "worry",
      "trend",
    ]);
  });

  it("ignores a health check older than a week", () => {
    const ctx = emptyContext();
    ctx.screenings = [{ date: isoDaysAgo(afternoon, 9), overallRisk: "Low", conditions: [] }];
    expect(buildProactiveCues(ctx, { now: afternoon }).map((c) => c.id)).toEqual(["daily-2026-02-10"]);
  });

  it("asks how today's meals felt once some are logged and none rated", () => {
    const ctx = emptyContext();
    ctx.mealAdherence.days = [
      { date: "2026-02-10", eatenCount: 2, totalMeals: 4, caloriesConsumed: 900 },
    ];

    const cue = buildProactiveCues(ctx, { now: afternoon }).find((c) => c.id.startsWith("meal-feedback"));
    expect(cue?.teaser).toContain("2 of 4");
    expect(cue?.card?.options.map((o) => o.label)).toEqual([
      "Great",
      "Just okay",
      "Felt heavy",
      "I skipped it",
    ]);
  });

  it("drops the meal-feedback cue once she has already rated something today", () => {
    const ctx = emptyContext();
    ctx.mealAdherence.days = [
      { date: "2026-02-10", eatenCount: 2, totalMeals: 4, caloriesConsumed: 900 },
    ];
    ctx.mealFeedback = [
      { date: "2026-02-10", mealName: "Lunch", digestion: 4, mood: 4, energy: 3, notes: "" },
    ];

    expect(buildProactiveCues(ctx, { now: afternoon }).some((c) => c.id.startsWith("meal-feedback"))).toBe(
      false,
    );
  });

  it("only mentions water once the day is far enough along to mean something", () => {
    const ctx = emptyContext();
    ctx.lifestyle.days = [
      {
        date: "2026-02-10",
        sleepHours: 7,
        sleepQuality: "good",
        waterGlasses: 2,
        waterGoal: 8,
        activityMinutes: {},
      },
    ];

    expect(buildProactiveCues(ctx, { now: morning }).some((c) => c.id.startsWith("water"))).toBe(false);
    const cue = buildProactiveCues(ctx, { now: afternoon }).find((c) => c.id.startsWith("water"));
    expect(cue?.teaser).toContain("6 glasses short");
  });

  it("raises a short night the next morning, not at midnight", () => {
    const ctx = emptyContext();
    ctx.lifestyle.days = [
      {
        date: "2026-02-09",
        sleepHours: 4.5,
        sleepQuality: "poor",
        waterGlasses: 8,
        waterGoal: 8,
        activityMinutes: {},
      },
    ];

    expect(buildProactiveCues(ctx, { now: morning }).some((c) => c.id === "sleep-2026-02-09")).toBe(true);
    expect(buildProactiveCues(ctx, { now: afternoon }).some((c) => c.id === "sleep-2026-02-09")).toBe(false);
  });

  it("mentions the kitchen list only once it has enough on it to matter", () => {
    const ctx = emptyContext();
    ctx.pantry.toBuy = ["ghee", "moong dal"];
    expect(buildProactiveCues(ctx, { now: afternoon }).some((c) => c.id.startsWith("pantry"))).toBe(false);

    ctx.pantry.toBuy = ["ghee", "moong dal", "curry leaves", "jaggery"];
    const cue = buildProactiveCues(ctx, { now: afternoon }).find((c) => c.id.startsWith("pantry"));
    expect(cue?.message).toContain("ghee, moong dal, curry leaves");
  });
});

describe("nextUnseenCue", () => {
  it("skips what has already been raised", () => {
    const ctx = emptyContext();
    ctx.pantry.toBuy = ["a", "b", "c"];
    const cues = buildProactiveCues(ctx, { now: afternoon });

    expect(nextUnseenCue(cues, [])?.id).toBe(cues[0].id);
    expect(nextUnseenCue(cues, [cues[0].id])?.id).toBe(cues[1].id);
    expect(nextUnseenCue(cues, cues.map((c) => c.id))).toBeNull();
  });
});

describe("buildFollowUps", () => {
  it("follows on from what she just asked about", () => {
    const labels = buildFollowUps("why am I so tired lately?").map((s) => s.label);
    expect(labels).toContain("An evening routine");
  });

  it("stays generic when the topic isn't one it knows", () => {
    expect(buildFollowUps("tell me about Prakriva").map((s) => s.label)).toContain("Tell me more");
  });

  it("never offers more than four chips", () => {
    const ctx = emptyContext();
    ctx.activePlan = { durationLabel: "7 days", days: [] };
    expect(buildFollowUps("what should I cook for dinner?", ctx).length).toBeLessThanOrEqual(4);
  });
});

describe("buildLeadUps", () => {
  it("falls back to generic openers with no context", () => {
    expect(buildLeadUps(null)).toHaveLength(4);
  });

  it("opens with what she actually has", () => {
    const ctx = emptyContext();
    ctx.activePlan = { durationLabel: "7 days", days: [] };
    ctx.pantry.atHome = ["rice", "ghee"];
    const labels = buildLeadUps(ctx).map((s) => s.label);
    expect(labels[0]).toBe("What's on my plan today?");
    expect(labels).toContain("Cook from my pantry");
  });
});

describe("relativeDay", () => {
  it("says today, yesterday, then counts", () => {
    expect(relativeDay("2026-02-10", afternoon)).toBe("today");
    expect(relativeDay("2026-02-09", afternoon)).toBe("yesterday");
    expect(relativeDay("2026-02-07", afternoon)).toBe("3 days ago");
    expect(relativeDay("2026-01-20", afternoon)).toMatch(/^on /);
  });
});
