import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { readCache, writeCache, CACHE_KEYS, ONE_DAY_MS } from "@/lib/localCache";
import { usePersistentState } from "@/hooks/usePersistentState";

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
