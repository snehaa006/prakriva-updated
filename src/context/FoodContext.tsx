import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import { readCache, writeCache, CACHE_KEYS, ONE_DAY_MS } from "@/lib/localCache";
import { usePersistentState } from "@/hooks/usePersistentState";
import { macrosOf, perServingMacros, type RecipeMacros } from "@/lib/recipeMacros";
import { searchRecipeById } from "@/services/foodoscopeApi";

export interface Food {
  id: string; // Unique ID for React keys
  Food_Item: string;
  Category: string;
  Calories: number;
  Protein: number;
  Carbs: number;
  Fat: number;
  Vegetarian: string;
  Vegan: string;
  Dosha_Vata: string;
  Dosha_Pitta: string;
  Dosha_Kapha: string;
  Food_Group: string;
}

interface FoodContextType {
  foods: Food[];
  selectedFoods: Food[];
  addToSelectedFoods: (food: Food) => void;
  removeFromSelectedFoods: (food: Food) => void;
  clearSelectedFoods: () => void;
  setSelectedFoods: React.Dispatch<React.SetStateAction<Food[]>>; // 👈 for drag & drop
}

const FoodContext = createContext<FoodContextType | undefined>(undefined);

/** The food database rarely changes, so a cached copy is good for a week. */
const FOOD_DB_TTL = 7 * ONE_DAY_MS;

export const FoodProvider = ({ children }: { children: ReactNode }) => {
  // Seed from cache so a refresh renders the food list immediately instead of
  // waiting on the JSON fetch (and still shows something when offline).
  const [foods, setFoods] = useState<Food[]>(
    () => readCache<Food[]>(CACHE_KEYS.foodDatabase, FOOD_DB_TTL) ?? []
  );

  // The palette a doctor is assembling is real work — it must not vanish on a
  // refresh or an accidental navigation.
  const [selectedFoods, setSelectedFoods] = usePersistentState<Food[]>(
    CACHE_KEYS.selectedFoods,
    []
  );

  // 🔹 Load foods from JSON file in public folder
  useEffect(() => {
    fetch("/foodDatabase.json")
      .then((res) => res.json())
      .then((data: Omit<Food, "id">[]) => {
        // Add unique IDs if your data doesn't have one
        const foodsWithId: Food[] = data.map((item, index) => ({
          ...item,
          id: `${item.Food_Item}-${index}`,
        }));
        setFoods(foodsWithId);
        writeCache(CACHE_KEYS.foodDatabase, foodsWithId);
      })
      .catch((err) => console.error("Error loading food database:", err));
  }, []);

  // The selection is saved in the browser and re-adding a recipe keeps the
  // first copy, so FoodOScope recipes saved earlier can hold whole-dish macros
  // (73 g fat beside 45 per-serving calories) or none at all (added from a list
  // that left them out: the palette read "g protein · g fat"). Correct each
  // once: scale complete ones to a serving in place, and fill incomplete ones
  // from the recipe's full record. Local foods (non-numeric ids) are left alone.
  const nutrientFixTried = useRef(new Set<string>());
  useEffect(() => {
    const isRecipe = (food: Food) => /^\d+$/.test(food.id);
    const incomplete = (food: Food) => [food.Protein, food.Carbs, food.Fat].filter((v) => !v).length >= 2;

    let scaledAny = false;
    const scaled = selectedFoods.map((food) => {
      if (!isRecipe(food) || incomplete(food)) return food;
      const serving = perServingMacros({
        calories: food.Calories, protein: food.Protein, carbs: food.Carbs, fat: food.Fat,
      });
      if (serving.protein === food.Protein && serving.carbs === food.Carbs && serving.fat === food.Fat) {
        return food;
      }
      scaledAny = true;
      return { ...food, Protein: serving.protein ?? 0, Carbs: serving.carbs ?? 0, Fat: serving.fat ?? 0 };
    });
    if (scaledAny) {
      setSelectedFoods(scaled);
      return;
    }

    const missing = selectedFoods.filter(
      (food) => isRecipe(food) && incomplete(food) && !nutrientFixTried.current.has(food.id)
    );
    if (missing.length === 0) return;
    missing.forEach((food) => nutrientFixTried.current.add(food.id));

    void Promise.all(
      missing.map((food) =>
        searchRecipeById(food.id)
          .then(({ recipe }) => [food.id, perServingMacros(macrosOf(recipe))] as const)
          .catch(() => null)
      )
    ).then((results) => {
      const found = new Map<string, RecipeMacros>(
        results.filter((entry): entry is readonly [string, RecipeMacros] => entry !== null)
      );
      if (found.size === 0) return;
      setSelectedFoods((prev) =>
        prev.map((food) => {
          const macros = found.get(food.id);
          return macros && macros.protein !== undefined && macros.carbs !== undefined && macros.fat !== undefined
            ? { ...food, Protein: macros.protein, Carbs: macros.carbs, Fat: macros.fat }
            : food;
        })
      );
    });
  }, [selectedFoods, setSelectedFoods]);

  // 🔹 Add to selectedFoods (no duplicates)
  const addToSelectedFoods = (food: Food) => {
    setSelectedFoods((prev) =>
      prev.some((f) => f.id === food.id) ? prev : [...prev, food]
    );
  };

  // 🔹 Remove from selectedFoods
  const removeFromSelectedFoods = (food: Food) => {
    setSelectedFoods((prev) => prev.filter((f) => f.id !== food.id));
  };

  const clearSelectedFoods = () => setSelectedFoods([]);

  return (
    <FoodContext.Provider
      value={{
        foods,
        selectedFoods,
        addToSelectedFoods,
        removeFromSelectedFoods,
        clearSelectedFoods,
        setSelectedFoods, // 👈 expose for drag & drop reorder
      }}
    >
      {children}
    </FoodContext.Provider>
  );
};

// ✅ Custom hook
export const useFoodContext = () => {
  const context = useContext(FoodContext);
  if (!context) {
    throw new Error("useFoodContext must be used within a FoodProvider");
  }
  return context;
};
