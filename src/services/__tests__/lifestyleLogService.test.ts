import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDayLog, type LifestyleDayLog } from "@/lib/lifestyleLog";
import { writeCache } from "@/lib/localCache";

/** The raw localStorage key `localCache` stores this patient's logs under. */
const rawKey = (patientId: string) => `prakriva:lifestyle-logs:${patientId}`;

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

const {
  fetchLifestyleLogs,
  loadLifestyleLogs,
  mergeLogs,
  readCachedLogs,
  saveLifestyleDay,
  writeCachedLogs,
} = await import("../lifestyleLogService");

const day = (date: string, overrides: Partial<LifestyleDayLog> = {}): LifestyleDayLog => ({
  ...emptyDayLog(date),
  ...overrides,
});

beforeEach(() => {
  state.selectResult = { data: [], error: null };
  state.upsertResult = { error: null };
  state.lastUpsert = null;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("the localStorage cache", () => {
  it("round-trips logs so a refresh doesn't lose the streak", () => {
    const logs = [day("2026-08-08", { activityMinutes: { "brisk-walk": 30 }, waterGlasses: 8 })];
    writeCachedLogs("patient-1", logs);

    // A fresh read is what a page reload does.
    expect(readCachedLogs("patient-1")).toEqual(logs);
  });

  it("keeps each patient's cache separate", () => {
    writeCachedLogs("patient-1", [day("2026-08-08", { waterGlasses: 8 })]);
    expect(readCachedLogs("patient-2")).toEqual([]);
  });

  it("returns an empty list rather than throwing on corrupted cache", () => {
    localStorage.setItem(rawKey("patient-1"), "{not json");
    expect(readCachedLogs("patient-1")).toEqual([]);
  });

  it("survives a cache entry that isn't an array at all", () => {
    writeCache("lifestyle-logs:patient-1", { nope: true });
    expect(readCachedLogs("patient-1")).toEqual([]);
  });

  it("drops entries that aren't usable day logs", () => {
    writeCache("lifestyle-logs:patient-1", [
      { nope: true },
      { date: "2026-08-08", waterGlasses: 5 },
    ]);
    expect(readCachedLogs("patient-1").map((l) => l.date)).toEqual(["2026-08-08"]);
  });

  it("normalises junk values instead of trusting the cache", () => {
    writeCache("lifestyle-logs:patient-1", [
      {
        date: "2026-08-08",
        sleepHours: "not a number",
        sleepQuality: "excellent",
        activityMinutes: { "brisk-walk": "30", bogus: -5 },
        waterGlasses: -3,
        waterGoal: 0,
      },
    ]);

    expect(readCachedLogs("patient-1")[0]).toEqual({
      date: "2026-08-08",
      sleepHours: null,
      sleepQuality: null,
      activityMinutes: { "brisk-walk": 30 },
      waterGlasses: 0,
      waterGoal: 8,
    });
  });
});

describe("fetchLifestyleLogs", () => {
  it("maps rows to day logs, oldest first", async () => {
    state.selectResult = {
      data: [
        {
          log_date: "2026-08-08",
          sleep_hours: 7.5,
          sleep_quality: "deep",
          activity_minutes: { "gentle-walk": 20 },
          water_glasses: 8,
          water_goal: 8,
        },
        {
          log_date: "2026-08-07",
          sleep_hours: null,
          sleep_quality: null,
          activity_minutes: null,
          water_glasses: null,
          water_goal: null,
        },
      ],
      error: null,
    };

    const logs = await fetchLifestyleLogs("patient-1");

    expect(logs.map((l) => l.date)).toEqual(["2026-08-07", "2026-08-08"]);
    expect(logs[0]).toEqual(day("2026-08-07"));
    expect(logs[1].activityMinutes).toEqual({ "gentle-walk": 20 });
  });

  it("returns an empty list rather than throwing when the table is missing", async () => {
    state.selectResult = { data: null, error: { code: "42P01", message: "missing" } };
    await expect(fetchLifestyleLogs("patient-1")).resolves.toEqual([]);
  });

  it("still throws on a real error", async () => {
    state.selectResult = { data: null, error: { code: "500", message: "boom" } };
    await expect(fetchLifestyleLogs("patient-1")).rejects.toThrow("boom");
  });
});

describe("mergeLogs", () => {
  it("lets the server win where both sides have the day", () => {
    const merged = mergeLogs(
      [day("2026-08-08", { waterGlasses: 2 })],
      [day("2026-08-08", { waterGlasses: 9 })]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].waterGlasses).toBe(9);
  });

  it("keeps days only the cache has", () => {
    const merged = mergeLogs([day("2026-08-07")], [day("2026-08-08")]);
    expect(merged.map((l) => l.date)).toEqual(["2026-08-07", "2026-08-08"]);
  });
});

describe("loadLifestyleLogs", () => {
  it("merges the cache with the server and writes the result back", async () => {
    writeCachedLogs("patient-1", [day("2026-08-06", { waterGlasses: 4 })]);
    state.selectResult = {
      data: [
        {
          log_date: "2026-08-08",
          sleep_hours: 7,
          sleep_quality: "deep",
          activity_minutes: {},
          water_glasses: 8,
          water_goal: 8,
        },
      ],
      error: null,
    };

    const { logs, synced } = await loadLifestyleLogs("patient-1");

    expect(synced).toBe(true);
    expect(logs.map((l) => l.date)).toEqual(["2026-08-06", "2026-08-08"]);
    expect(readCachedLogs("patient-1").map((l) => l.date)).toEqual([
      "2026-08-06",
      "2026-08-08",
    ]);
  });

  it("falls back to the cache and reports it when the server errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    writeCachedLogs("patient-1", [day("2026-08-08", { waterGlasses: 6 })]);
    state.selectResult = { data: null, error: { code: "500", message: "boom" } };

    const { logs, synced } = await loadLifestyleLogs("patient-1");

    expect(synced).toBe(false);
    expect(logs.map((l) => l.date)).toEqual(["2026-08-08"]);
  });
});

describe("saveLifestyleDay", () => {
  it("caches the day before it touches the network", async () => {
    const log = day("2026-08-08", { activityMinutes: { pranayama: 10 } });
    await saveLifestyleDay("patient-1", log);

    expect(readCachedLogs("patient-1")).toEqual([log]);
    expect(state.lastUpsert).toMatchObject({
      patient_id: "patient-1",
      log_date: "2026-08-08",
      activity_minutes: { pranayama: 10 },
    });
  });

  it("reports not-persisted, but still caches, when the table is missing", async () => {
    state.upsertResult = { error: { code: "42P01", message: "missing" } };

    await expect(
      saveLifestyleDay("patient-1", day("2026-08-08", { waterGlasses: 5 }))
    ).resolves.toBe(false);
    expect(readCachedLogs("patient-1")[0].waterGlasses).toBe(5);
  });

  it("reports not-persisted, but still caches, when the write fails outright", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.upsertResult = { error: { code: "500", message: "boom" } };

    await expect(
      saveLifestyleDay("patient-1", day("2026-08-08", { waterGlasses: 5 }))
    ).resolves.toBe(false);
    expect(readCachedLogs("patient-1")[0].waterGlasses).toBe(5);
  });

  it("corrects an existing day rather than duplicating it", async () => {
    await saveLifestyleDay("patient-1", day("2026-08-08", { waterGlasses: 3 }));
    await saveLifestyleDay("patient-1", day("2026-08-08", { waterGlasses: 7 }));

    const cached = readCachedLogs("patient-1");
    expect(cached).toHaveLength(1);
    expect(cached[0].waterGlasses).toBe(7);
  });
});
