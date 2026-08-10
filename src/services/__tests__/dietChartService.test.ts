import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Generation is a chain of calls to services that can be slow, asleep or gone:
 * the Flask backend for the AI path, then FoodOScope for the fallback. Neither
 * gives up on its own, so what is under test here is mostly the giving up —
 * that a hung backend, an empty recipe database and a doctor pressing Cancel
 * each end the run in bounded time with something the UI can report.
 */

const recipeApi = vi.hoisted(() => ({
  byIngredients: vi.fn(),
  byDiet: vi.fn(),
  byCalories: vi.fn(),
}));

vi.mock("@/services/foodoscopeApi", () => ({
  getRecipesByIngredientsCategoriesTitle: recipeApi.byIngredients,
  getRecipesByDiet: recipeApi.byDiet,
  getRecipesByCalories: recipeApi.byCalories,
  getRecipesByRegionAndDiet: vi.fn(),
  searchRecipeById: vi.fn(),
  getInstructionsByRecipeId: vi.fn(),
  getIngredientsByFlavor: vi.fn(),
}));

const {
  DietChartGenerationError,
  GenerationCancelled,
  aiTimeoutMs,
  countChartMeals,
  generateDietChart,
} = await import("@/services/dietChartService");

type Profile = Parameters<typeof generateDietChart>[0];

/** A complete-enough assessment: body frame and skin type drive the dosha. */
const profile = (): Profile => ({
  name: "Test Patient",
  gender: "female",
  dob: "1994-03-02",
  lifeStage: "not_applicable",
  allergies: [],
  dietaryPreferences: "vegetarian",
  currentConditions: [],
  healthGoals: [],
  bodyFrame: "medium",
  skinType: "oily",
  hairType: "fine",
  appetitePattern: "strong",
  personalityTraits: [],
  weatherPreference: "cool",
  digestionIssues: [],
  energyLevels: 3,
  stressLevels: 3,
  physicalActivity: "active",
  sleepDuration: "7",
});

const recipe = (title: string, calories: number) => ({
  _id: title,
  Recipe_id: title,
  Recipe_title: title,
  Calories: String(calories),
  "Protein (g)": "20",
  "Carbohydrate, by difference (g)": "50",
  "Total lipid (fat) (g)": "12",
});

/** The envelope the Flask endpoint answers with. */
const aiResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const aiDay = (dayNumber: number, dayLabel: string) => ({
  dayNumber,
  dayLabel,
  meals: [
    {
      mealType: "breakfast",
      label: "Breakfast",
      time: "7:30 AM",
      recipe: recipe("Poha", 400),
      targetCalories: 500,
      actualCalories: 400,
    },
  ],
  totalCalories: 400,
  totalProtein: 20,
  totalCarbs: 50,
  totalFat: 12,
});

beforeEach(() => {
  vi.useFakeTimers();
  recipeApi.byIngredients.mockReset();
  recipeApi.byDiet.mockReset();
  recipeApi.byCalories.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("aiTimeoutMs", () => {
  it("scales with the plan length and stays bounded", () => {
    expect(aiTimeoutMs(3)).toBeLessThan(aiTimeoutMs(7));
    expect(aiTimeoutMs(14)).toBeLessThanOrEqual(120_000);
  });
});

describe("generateDietChart", () => {
  it("returns the AI plan when the backend answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        aiResponse({ success: true, data: { days: [aiDay(1, "Monday"), aiDay(2, "Tuesday")] } })
      )
    );

    const result = await generateDietChart(profile(), 2);
    expect(result.source).toBe("gemini");
    expect(countChartMeals(result)).toBe(2);
    expect(recipeApi.byIngredients).not.toHaveBeenCalled();
  });

  it("gives up on a backend that never answers instead of waiting forever", async () => {
    // A request that is accepted and then simply never completes — a sleeping
    // free-tier instance, or one rotating through exhausted Gemini keys. This
    // is what used to leave the Generate button spinning indefinitely.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(init.signal?.reason ?? new Error("aborted"))
            );
          })
      )
    );
    // No recipes either, so the run has to end in a reported failure.
    recipeApi.byIngredients.mockResolvedValue([]);
    recipeApi.byDiet.mockResolvedValue({ data: [] });
    recipeApi.byCalories.mockResolvedValue({ data: [] });

    const promise = generateDietChart(profile(), 7);
    const assertion = expect(promise).rejects.toBeInstanceOf(DietChartGenerationError);

    await vi.advanceTimersByTimeAsync(300_000);
    await assertion;
  });

  it("falls back to the recipe database when the backend is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    recipeApi.byIngredients.mockResolvedValue([recipe("Khichdi", 420)]);

    const promise = generateDietChart(profile(), 3);
    await vi.advanceTimersByTimeAsync(300_000);
    const chart = await promise;

    expect(chart.source).toBe("foodoscope");
    expect(chart.days).toHaveLength(3);
    // Every slot gets a meal: the pools share their recipes rather than
    // leaving holes in the board.
    expect(countChartMeals(chart)).toBe(3 * 5);
  });

  it("reports a failure rather than handing back an empty board", async () => {
    // The backend answering "success" with nothing in it used to produce a
    // green toast over an empty planner.
    vi.stubGlobal("fetch", vi.fn(async () => aiResponse({ success: true, data: { days: [] } })));
    recipeApi.byIngredients.mockResolvedValue([]);
    recipeApi.byDiet.mockResolvedValue({ data: [] });
    recipeApi.byCalories.mockResolvedValue({ data: [] });

    const promise = generateDietChart(profile(), 3);
    const assertion = expect(promise).rejects.toMatchObject({
      name: "DietChartGenerationError",
      reasons: expect.arrayContaining([expect.stringContaining("no usable meals")]),
    });

    await vi.advanceTimersByTimeAsync(300_000);
    await assertion;
  });

  it("stops as soon as the doctor cancels", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(init.signal?.reason ?? new Error("aborted"))
            );
          })
      )
    );
    recipeApi.byIngredients.mockResolvedValue([recipe("Khichdi", 420)]);

    const controller = new AbortController();
    const promise = generateDietChart(profile(), 7, {}, controller.signal);
    const assertion = expect(promise).rejects.toBeInstanceOf(GenerationCancelled);

    await vi.advanceTimersByTimeAsync(1_000);
    controller.abort();
    await vi.advanceTimersByTimeAsync(1_000);

    await assertion;
    // Cancelling means cancelling — it must not roll on into the fallback.
    expect(recipeApi.byIngredients).not.toHaveBeenCalled();
  });
});
