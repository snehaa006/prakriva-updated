import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A minimal Supabase stub for the two chains this service uses:
 * `from(t).insert(row)` and `from(t).select(...).eq(...).order(...).limit(...)`.
 * The shared `createSupabaseMock` only covers the auth read chain.
 */
const state = vi.hoisted(() => ({
  insertResult: { error: null as unknown },
  selectResult: { data: [] as unknown[], error: null as unknown },
  lastInsert: null as unknown,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.order = () => builder;
      builder.limit = async () => state.selectResult;
      builder.insert = async (row: unknown) => {
        state.lastInsert = row;
        return state.insertResult;
      };
      return builder;
    },
  },
}));

const {
  ageFromDob,
  buildScreeningInputFromAssessment,
  emptyScreeningInput,
  fetchScreenings,
  isPregnantPatient,
  saveScreening,
  screenPatient,
} = await import("@/services/diseaseDetectionService");

beforeEach(() => {
  state.insertResult = { error: null };
  state.selectResult = { data: [], error: null };
  state.lastInsert = null;
  vi.unstubAllGlobals();
});

const screeningResult = () => ({
  generated_at: "2026-01-01T00:00:00Z",
  conditions: [],
  overall_risk_level: "low" as const,
  highest_risk_condition: null,
  disclaimer: "Screening support only.",
});

describe("isPregnantPatient", () => {
  it("matches the questionnaire's pregnancy life stage", () => {
    expect(isPregnantPatient({ lifeStage: "pregnancy" })).toBe(true);
  });

  it("rejects other life stages and missing data", () => {
    expect(isPregnantPatient({ lifeStage: "menopause" })).toBe(false);
    expect(isPregnantPatient(null)).toBe(false);
  });
});

describe("ageFromDob", () => {
  it("returns null for missing or unparseable dates", () => {
    expect(ageFromDob(undefined)).toBeNull();
    expect(ageFromDob("not-a-date")).toBeNull();
  });

  it("counts whole years elapsed", () => {
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    expect(ageFromDob("1996-06-02")).toBe(29);
    expect(ageFromDob("1996-05-31")).toBe(30);
    vi.useRealTimers();
  });
});

describe("buildScreeningInputFromAssessment", () => {
  it("returns neutral defaults when there is no assessment", () => {
    expect(buildScreeningInputFromAssessment(null)).toEqual(emptyScreeningInput());
  });

  it("maps trimester, conditions and history onto the screening fields", () => {
    const input = buildScreeningInputFromAssessment({
      dob: "1994-03-10",
      pregnancyTrimester: "third",
      currentConditions: ["PCOS", "Anaemia"],
      familyHistory: ["Diabetes"],
      digestionIssues: ["Constipation"],
      physicalActivity: "sedentary",
      stressLevels: 5,
      energyLevels: 1,
    });

    expect(input.trimester).toBe("third");
    expect(input.pcos).toBe(true);
    expect(input.anaemia_history).toBe(true);
    expect(input.family_history).toBe(true);
    expect(input.constipation).toBe(true);
    expect(input.sedentary_lifestyle).toBe(true);
    expect(input.stress_level).toBe(3);
    expect(input.symptoms).toContain("fatigue");
  });

  it("leaves labs unset so 'not measured' never reads as normal", () => {
    const input = buildScreeningInputFromAssessment({ dob: "1994-03-10" });

    expect(input.hemoglobin).toBeNull();
    expect(input.tsh).toBeNull();
    expect(input.urine_nitrite).toBe("unknown");
  });

  it("falls back to the default age when the dob is unusable", () => {
    expect(buildScreeningInputFromAssessment({ dob: "" }).age).toBe(
      emptyScreeningInput().age
    );
  });
});

describe("screenPatient", () => {
  it("posts the form and unwraps the API envelope", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: screeningResult() }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await screenPatient(emptyScreeningInput());

    expect(result.overall_risk_level).toBe("low");
    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(options.body as string)).not.toHaveProperty("conditions");
  });

  it("passes a condition subset through when given one", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: screeningResult() }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await screenPatient(emptyScreeningInput(), ["anaemia", "gdm"]);

    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(options.body as string).conditions).toEqual(["anaemia", "gdm"]);
  });

  it("throws with the API error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ success: false, error: "Invalid screening input" }),
      }))
    );

    await expect(screenPatient(emptyScreeningInput())).rejects.toThrow(
      "Invalid screening input"
    );
  });
});

describe("saveScreening", () => {
  it("returns true and stores the denormalised risk level", async () => {
    const saved = await saveScreening(
      "patient-1",
      "doctor-1",
      emptyScreeningInput(),
      screeningResult()
    );

    expect(saved).toBe(true);
    expect(state.lastInsert).toMatchObject({
      patient_id: "patient-1",
      doctor_id: "doctor-1",
      overall_risk_level: "low",
    });
  });

  it("returns false rather than throwing when the table is missing", async () => {
    state.insertResult = { error: { code: "42P01", message: "relation missing" } };

    await expect(
      saveScreening("p", "d", emptyScreeningInput(), screeningResult())
    ).resolves.toBe(false);
  });

  it("propagates other database errors", async () => {
    state.insertResult = { error: { code: "42501", message: "permission denied" } };

    await expect(
      saveScreening("p", "d", emptyScreeningInput(), screeningResult())
    ).rejects.toThrow("permission denied");
  });
});

describe("fetchScreenings", () => {
  it("maps rows onto the stored screening shape", async () => {
    state.selectResult = {
      data: [
        {
          id: "s1",
          patient_id: "patient-1",
          doctor_id: "doctor-1",
          created_at: "2026-01-02T10:00:00Z",
          inputs: emptyScreeningInput(),
          result: screeningResult(),
        },
      ],
      error: null,
    };

    const history = await fetchScreenings("patient-1");

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ id: "s1", patientId: "patient-1" });
  });

  it("returns an empty history when the table is missing", async () => {
    state.selectResult = { data: [], error: { code: "PGRST205", message: "missing" } };

    await expect(fetchScreenings("patient-1")).resolves.toEqual([]);
  });
});
