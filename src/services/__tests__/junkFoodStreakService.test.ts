import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A minimal Supabase stub for the two chains this service uses:
 * `from(t).select(...).eq(...).order(...).limit(...)` and `from(t).upsert(row, opts)`.
 * The shared `createSupabaseMock` only covers the auth read chain.
 */
const state = vi.hoisted(() => ({
  selectResult: { data: [] as unknown[], error: null as unknown },
  upsertResult: { error: null as unknown },
  lastUpsert: null as unknown,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.order = () => builder;
      builder.limit = async () => state.selectResult;
      builder.upsert = async (row: unknown) => {
        state.lastUpsert = row;
        return state.upsertResult;
      };
      return builder;
    },
  },
}));

const { fetchJunkFoodLogs, logJunkFoodDay } = await import("../junkFoodStreakService");

beforeEach(() => {
  state.selectResult = { data: [], error: null };
  state.upsertResult = { error: null };
  state.lastUpsert = null;
});

describe("fetchJunkFoodLogs", () => {
  it("maps rows to camelCase entries", async () => {
    state.selectResult = {
      data: [
        { log_date: "2026-08-07", ate_junk_food: false },
        { log_date: "2026-08-08", ate_junk_food: true },
      ],
      error: null,
    };

    const entries = await fetchJunkFoodLogs("patient-1");

    expect(entries).toEqual([
      { date: "2026-08-07", ateJunkFood: false },
      { date: "2026-08-08", ateJunkFood: true },
    ]);
  });

  it("returns an empty list rather than throwing when the table is missing", async () => {
    state.selectResult = { data: null, error: { code: "42P01", message: "missing" } };

    await expect(fetchJunkFoodLogs("patient-1")).resolves.toEqual([]);
  });

  it("throws on a real error", async () => {
    state.selectResult = { data: null, error: { code: "500", message: "boom" } };

    await expect(fetchJunkFoodLogs("patient-1")).rejects.toThrow("boom");
  });
});

describe("logJunkFoodDay", () => {
  it("upserts on (patient_id, log_date) and reports success", async () => {
    const persisted = await logJunkFoodDay("patient-1", "2026-08-08", false);

    expect(persisted).toBe(true);
    expect(state.lastUpsert).toEqual({
      patient_id: "patient-1",
      log_date: "2026-08-08",
      ate_junk_food: false,
    });
  });

  it("returns false rather than throwing when the table is missing", async () => {
    state.upsertResult = { error: { code: "42P01", message: "missing" } };

    await expect(logJunkFoodDay("patient-1", "2026-08-08", true)).resolves.toBe(false);
  });

  it("throws on a real error", async () => {
    state.upsertResult = { error: { code: "500", message: "boom" } };

    await expect(logJunkFoodDay("patient-1", "2026-08-08", true)).rejects.toThrow("boom");
  });
});
