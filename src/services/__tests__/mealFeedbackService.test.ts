import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Supabase stub for the one chain mealFeedbackService uses:
 * `from(t).select().eq().order().order().limit()`.
 */
const state = vi.hoisted(() => ({
  selectResult: { data: [] as unknown[], error: null as unknown },
  lastFilter: null as unknown,
  lastLimit: null as unknown,
  fromCalls: [] as string[],
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      state.fromCalls.push(table);
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = (column: string, value: unknown) => {
        state.lastFilter = { column, value };
        return builder;
      };
      builder.order = () => builder;
      builder.limit = async (n: number) => {
        state.lastLimit = n;
        return state.selectResult;
      };
      return builder;
    },
  },
}));

const { fetchMealFeedback, summarizeMealFeedback } = await import(
  "../mealFeedbackService"
);

const row = {
  id: "fb-1",
  patient_id: "patient-1",
  patient_name: "Priya Sharma",
  meal_id: "meal-1",
  meal_name: "Moong dal khichdi",
  digestion_rating: 4,
  mood_rating: 3,
  energy_rating: 5,
  notes: "Felt light afterwards",
  date: "2026-02-10",
  created_at: "2026-02-10T12:00:00Z",
};

beforeEach(() => {
  state.selectResult = { data: [], error: null };
  state.lastFilter = null;
  state.lastLimit = null;
  state.fromCalls = [];
});

describe("fetchMealFeedback", () => {
  it("maps rows onto the doctor-facing shape", async () => {
    state.selectResult = { data: [row], error: null };

    const entries = await fetchMealFeedback("patient-1");

    expect(state.fromCalls).toEqual(["meal_feedback"]);
    expect(state.lastFilter).toEqual({ column: "patient_id", value: "patient-1" });
    expect(entries).toEqual([
      {
        id: "fb-1",
        patientId: "patient-1",
        patientName: "Priya Sharma",
        mealId: "meal-1",
        mealName: "Moong dal khichdi",
        digestion: 4,
        mood: 3,
        energy: 5,
        notes: "Felt light afterwards",
        date: "2026-02-10",
        createdAt: "2026-02-10T12:00:00Z",
      },
    ]);
  });

  it("fills in the gaps a sparse row leaves", async () => {
    state.selectResult = {
      data: [{ ...row, patient_name: null, meal_id: null, meal_name: null, notes: null }],
      error: null,
    };

    const [entry] = await fetchMealFeedback("patient-1");

    expect(entry.patientName).toBe("");
    expect(entry.mealId).toBe("");
    expect(entry.mealName).toBe("a meal");
    expect(entry.notes).toBe("");
  });

  it("passes the requested limit through", async () => {
    await fetchMealFeedback("patient-1", 5);
    expect(state.lastLimit).toBe(5);
  });

  it("short-circuits without a patient rather than querying", async () => {
    await expect(fetchMealFeedback("")).resolves.toEqual([]);
    expect(state.fromCalls).toEqual([]);
  });

  it("surfaces a Supabase error", async () => {
    state.selectResult = { data: null as unknown as unknown[], error: { message: "denied" } };
    await expect(fetchMealFeedback("patient-1")).rejects.toThrow("denied");
  });
});

describe("summarizeMealFeedback", () => {
  it("averages only the ratings that were actually given", async () => {
    state.selectResult = {
      data: [
        row,
        { ...row, id: "fb-2", digestion_rating: 2, mood_rating: null, energy_rating: 3, notes: "" },
      ],
      error: null,
    };

    const summary = summarizeMealFeedback(await fetchMealFeedback("patient-1"));

    expect(summary.count).toBe(2);
    expect(summary.digestion).toBe(3);
    expect(summary.mood).toBe(3);
    expect(summary.energy).toBe(4);
    expect(summary.noteCount).toBe(1);
    expect(summary.latestDate).toBe("2026-02-10");
  });

  it("reports nulls rather than NaN for an empty set", () => {
    expect(summarizeMealFeedback([])).toEqual({
      count: 0,
      digestion: null,
      mood: null,
      energy: null,
      noteCount: 0,
      latestDate: null,
    });
  });
});
