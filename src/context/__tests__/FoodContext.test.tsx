import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/foodoscopeApi", () => ({ searchRecipeById: vi.fn() }));

import { searchRecipeById } from "@/services/foodoscopeApi";
import { FoodProvider, useFoodContext, type Food } from "@/context/FoodContext";

/**
 * The doctor's saved food selection. Recipes saved earlier hold whole-dish
 * macros or none at all; the store corrects each once, to one serving.
 */
const food = (overrides: Partial<Food>): Food => ({
  id: "2610",
  Food_Item: "Egyptian Lentil Soup",
  Category: "Middle Eastern",
  Calories: 196,
  Protein: 0,
  Carbs: 0,
  Fat: 0,
  Vegetarian: "Yes",
  Vegan: "No",
  Dosha_Vata: "Neutral",
  Dosha_Pitta: "Neutral",
  Dosha_Kapha: "Neutral",
  Food_Group: "African",
  ...overrides,
});

const wrapper = ({ children }: { children: ReactNode }) => <FoodProvider>{children}</FoodProvider>;

const select = (foods: Food[]) => {
  const { result } = renderHook(() => useFoodContext(), { wrapper });
  act(() => result.current.setSelectedFoods(foods));
  return result;
};

beforeEach(() => {
  localStorage.clear();
  // The provider loads the local food list on mount.
  vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => [] })));
  vi.mocked(searchRecipeById).mockReset();
});

describe("FoodProvider selection correction", () => {
  it("scales saved whole-dish macros to one serving, with no request", async () => {
    const result = select([food({ Protein: 49.554, Carbs: 146.7606, Fat: 5.6564 })]);
    await waitFor(() =>
      expect(result.current.selectedFoods[0]).toMatchObject({ Protein: 11.6, Carbs: 34.4, Fat: 1.3 })
    );
    expect(searchRecipeById).not.toHaveBeenCalled();
  });

  it("fills a recipe saved without macros from its full record, per serving", async () => {
    vi.mocked(searchRecipeById).mockResolvedValue({
      recipe: {
        Calories: "196.0",
        "Protein (g)": "49.554",
        "Carbohydrate, by difference (g)": "146.7606",
        "Total lipid (fat) (g)": "5.6564",
      } as never,
      ingredients: [],
    });
    const result = select([food({})]);
    await waitFor(() =>
      expect(result.current.selectedFoods[0]).toMatchObject({ Protein: 11.6, Carbs: 34.4, Fat: 1.3 })
    );
    expect(searchRecipeById).toHaveBeenCalledWith("2610");
  });

  it("leaves the app's own foods alone", async () => {
    const local = food({ id: "Rice-12", Food_Item: "Rice", Calories: 130, Protein: 2.7, Carbs: 28, Fat: 0.3 });
    const result = select([local]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.selectedFoods[0]).toEqual(local);
    expect(searchRecipeById).not.toHaveBeenCalled();
  });
});
