import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DietPlanRow } from "../chatAssistantService";

vi.mock("@/services/foodoscopeApi", () => ({
  getIngredientsByFlavor: vi.fn(),
  getRecipesByIngredientsCategoriesTitle: vi.fn(),
}));

const { getIngredientsByFlavor, getRecipesByIngredientsCategoriesTitle } = await import(
  "../foodoscopeApi"
);
const { condenseActivePlan, looksLikeRecipeRequest, maybeFetchRecipeCandidates } = await import(
  "../chatAssistantService"
);

const baseRow: DietPlanRow = {
  plan_duration: "7 days",
  active_filter: "Daily",
  meals: {},
  primary_dosha: null,
  status: "active",
  created_at: "2026-08-08T00:00:00Z",
};

describe("condenseActivePlan", () => {
  it("returns null when there is no plan", () => {
    expect(condenseActivePlan(undefined)).toBeNull();
  });

  it("returns null when meals is present but empty", () => {
    expect(condenseActivePlan({ ...baseRow, meals: {} })).toBeNull();
  });

  it("condenses the Daily template into a single 'Typical day'", () => {
    const plan = condenseActivePlan({
      ...baseRow,
      meals: {
        Daily: {
          Breakfast: [{ Food_Item: "Gujarati Shrikhand", Calories: "752.0", time: "7:30 AM", label: "Breakfast" }],
          Lunch: [{ Food_Item: "Lemon Posset", Calories: "730.0", time: "12:30 PM", label: "Lunch" }],
          Dinner: [],
        },
      },
    });
    expect(plan).toEqual({
      durationLabel: "7 days",
      days: [
        {
          day: "Typical day",
          meals: [
            { label: "Breakfast", food: "Gujarati Shrikhand", calories: 752, time: "7:30 AM" },
            { label: "Lunch", food: "Lemon Posset", calories: 730, time: "12:30 PM" },
          ],
        },
      ],
    });
  });

  it("falls back to Weekly when Daily is empty, dropping days with no meals", () => {
    const plan = condenseActivePlan({
      ...baseRow,
      meals: {
        Daily: { Breakfast: [], Lunch: [], Dinner: [] },
        Weekly: {
          Monday: { Breakfast: [{ Food_Item: "Kheer", Calories: "513" }], Dinner: [] },
          Tuesday: { Breakfast: [], Lunch: [], Dinner: [] },
        },
      },
    });
    expect(plan?.days).toEqual([{ day: "Monday", meals: [{ label: "Breakfast", food: "Kheer", calories: 513, time: undefined }] }]);
  });

  it("skips entries with no Food_Item and non-object entries, without crashing", () => {
    const plan = condenseActivePlan({
      ...baseRow,
      meals: {
        Daily: {
          Breakfast: [
            "not an object",
            { Calories: "300" }, // no Food_Item
            { Food_Item: "Oats", Calories: "300" },
          ],
        },
      },
    });
    expect(plan?.days[0].meals).toEqual([
      { label: "Breakfast", food: "Oats", calories: 300, time: undefined },
    ]);
  });

  it("tolerates a mixed-shape entry array (real diet_plans.meals data is inconsistently shaped)", () => {
    // Observed in production data: some entries carry a completely different
    // schema (id/Fat/Carbs/Dosha_* fields, numeric Calories) alongside the
    // usual Recipe_id/time/label shape, within the very same array.
    const plan = condenseActivePlan({
      ...baseRow,
      meals: {
        Daily: {
          Breakfast: [
            {
              id: "100006",
              Fat: 55.3621,
              Carbs: 26.0535,
              Food_Item: 'Creole "style" Chicken & Sausage Jambalaya',
              Calories: 446.7,
              Dosha_Vata: "Neutral",
            },
            { Fat: "25.1", time: "7:30 AM", label: "Breakfast", Food_Item: "Gujarati Shrikhand", Calories: "752.0" },
          ],
        },
      },
    });
    expect(plan?.days[0].meals).toEqual([
      { label: "Breakfast", food: 'Creole "style" Chicken & Sausage Jambalaya', calories: 447, time: undefined },
      { label: "Breakfast", food: "Gujarati Shrikhand", calories: 752, time: "7:30 AM" },
    ]);
  });
});

describe("looksLikeRecipeRequest", () => {
  it.each([
    "Can you suggest a recipe?",
    "I'm craving something sweet",
    "what should I eat for dinner",
    "I'm hungry, any snack ideas?",
  ])("recognises %s as a recipe/food request", (message) => {
    expect(looksLikeRecipeRequest(message)).toBe(true);
  });

  it.each(["How am I doing this week?", "Tell me about my dosha", "Am I improving?"])(
    "does not treat %s as a recipe request",
    (message) => {
      expect(looksLikeRecipeRequest(message)).toBe(false);
    }
  );
});

const recipe = (overrides: Partial<Record<string, unknown>> = {}) => ({
  _id: "1",
  Recipe_id: "100",
  Recipe_title: "Kheer",
  Calories: "300",
  cook_time: "25",
  prep_time: "5",
  servings: "2",
  total_time: "30",
  Region: "Indian Subcontinent",
  Sub_region: "",
  Continent: "Asia",
  Source: "",
  "Carbohydrate, by difference (g)": "40",
  "Energy (kcal)": "300",
  "Protein (g)": "8",
  "Total lipid (fat) (g)": "9",
  Utensils: "",
  Processes: "",
  vegan: "0",
  pescetarian: "0",
  ovo_vegetarian: "1",
  lacto_vegetarian: "1",
  ovo_lacto_vegetarian: "1",
  ...overrides,
});

describe("maybeFetchRecipeCandidates", () => {
  beforeEach(() => {
    vi.mocked(getIngredientsByFlavor).mockReset();
    vi.mocked(getRecipesByIngredientsCategoriesTitle).mockReset();
  });

  it("skips the lookup entirely for a non-food message", async () => {
    const candidates = await maybeFetchRecipeCandidates("How am I doing this week?", ["rice", "milk"]);
    expect(candidates).toEqual([]);
    expect(getRecipesByIngredientsCategoriesTitle).not.toHaveBeenCalled();
  });

  it("skips the lookup when the pantry is empty", async () => {
    const candidates = await maybeFetchRecipeCandidates("suggest a recipe", []);
    expect(candidates).toEqual([]);
    expect(getRecipesByIngredientsCategoriesTitle).not.toHaveBeenCalled();
  });

  it("grounds a plain recipe request in pantry ingredients", async () => {
    vi.mocked(getRecipesByIngredientsCategoriesTitle).mockResolvedValue([recipe()]);

    const candidates = await maybeFetchRecipeCandidates("suggest a recipe", ["rice", "milk"]);

    expect(getRecipesByIngredientsCategoriesTitle).toHaveBeenCalledWith(
      expect.objectContaining({ includeIngredients: "rice,milk" })
    );
    expect(candidates).toEqual([
      { title: "Kheer", calories: 300, protein: 8, carbs: 40, fat: 9, cookTime: "25", region: "Indian Subcontinent", recipeId: "100" },
    ]);
  });

  it("narrows to the pantry/flavour overlap when a flavour word is present", async () => {
    vi.mocked(getIngredientsByFlavor).mockResolvedValue({
      data: [{ _id: "f1", IngID: "1", ingredient: "jaggery", frequency: "10", generic_name: "", FlavorDB_Category: "", Dietrx_Category: "", flavordb_id: "", Diet_rx_link: "" }],
      pagination: { total: 1, page: 1, pages: 1, limit: 40 },
    });
    vi.mocked(getRecipesByIngredientsCategoriesTitle).mockResolvedValue([recipe()]);

    await maybeFetchRecipeCandidates("I'm craving something sweet", ["rice", "jaggery", "milk"]);

    expect(getRecipesByIngredientsCategoriesTitle).toHaveBeenCalledWith(
      expect.objectContaining({ includeIngredients: "jaggery" })
    );
  });

  it("falls back to plain pantry matching when the flavour lookup fails", async () => {
    vi.mocked(getIngredientsByFlavor).mockRejectedValue(new Error("boom"));
    vi.mocked(getRecipesByIngredientsCategoriesTitle).mockResolvedValue([recipe()]);

    const candidates = await maybeFetchRecipeCandidates("craving something sweet please", ["rice", "milk"]);

    expect(candidates).toHaveLength(1);
    expect(getRecipesByIngredientsCategoriesTitle).toHaveBeenCalledWith(
      expect.objectContaining({ includeIngredients: "rice,milk" })
    );
  });

  it("filters to her dietary preference when it narrows the results", async () => {
    vi.mocked(getRecipesByIngredientsCategoriesTitle).mockResolvedValue([
      recipe({ Recipe_title: "Veg dish", ovo_lacto_vegetarian: "1" }),
      recipe({ Recipe_title: "Meat dish", ovo_lacto_vegetarian: "0" }),
    ]);

    const candidates = await maybeFetchRecipeCandidates("suggest a recipe", ["rice"], "vegetarian");

    expect(candidates.map((c) => c.title)).toEqual(["Veg dish"]);
  });

  it("returns an empty list rather than throwing when FoodOScope errors out", async () => {
    vi.mocked(getRecipesByIngredientsCategoriesTitle).mockRejectedValue(new Error("network down"));

    const candidates = await maybeFetchRecipeCandidates("suggest a recipe", ["rice"]);

    expect(candidates).toEqual([]);
  });
});
