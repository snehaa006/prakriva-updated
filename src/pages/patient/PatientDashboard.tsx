import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  CheckCircle,
  XCircle,
  Clock,
  Utensils,
  Sun,
  Moon,
  Coffee,
  RefreshCw,
  ChefHat,
  Filter,
  ArrowRightLeft,
  TrendingUp,
  Flame,
  Drumstick,
  Wheat,
  Droplets,
  Calendar,
  Loader2,
  Save,
  Sparkles,
  Eye,
  AlertCircle,
  Heart,
  Baby,
  Flower2,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getRecipesByCalories,
  getRecipesByDiet,
  getRecipesByProtein,
  getRecipesByCuisine,
  getRecipesByIngredientsCategoriesTitle,
  getInstructionsByRecipeId,
  searchRecipeById,
  type RecipeBasic,
} from "@/services/foodoscopeApi";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface TrackedMeal {
  id: string;
  name: string;
  type: "breakfast" | "lunch" | "snack" | "dinner";
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  status: "eaten" | "skipped" | "pending";
  recipeId?: string;
  region?: string;
  cookTime?: string;
  dayLabel?: string;
}

interface DietPlanDoc {
  id: string;
  patientName: string;
  planDuration: string;
  planType: string;
  meals: any;
  days?: any[];
  createdAt: any;
  totalMeals: number;
  activeFilter?: string;
  source?: string;
}

interface PatientProfile {
  name: string;
  lifeStage: string;
  pregnancyTrimester?: string;
  dietaryPreferences?: string;
  allergies?: string[];
  healthGoals?: string[];
  currentConditions?: string[];
  isBreastfeeding?: string;
  menopauseStage?: string;
}

interface Filters {
  region: string;
  dietType: string;
  minCalories: number;
  maxCalories: number;
  minProtein: number;
  maxProtein: number;
  cookTime: string;
  excludeIngredients: string;
  mealTypes: string[];
}

interface RecipeViewData {
  recipe: RecipeBasic;
  instructions: string;
}

type TabId = "today" | "plan" | "create" | "progress";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const REGIONS = [
  "Indian", "South Indian", "Italian", "Chinese", "Mexican",
  "Middle Eastern", "Japanese", "Thai", "French", "Mediterranean",
  "American", "Korean", "Vietnamese", "Greek", "Spanish",
];

const DIET_TYPES = [
  { value: "", label: "Any" },
  { value: "ovo_lacto_vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescetarian", label: "Pescatarian" },
  { value: "lacto_vegetarian", label: "Lacto-Vegetarian" },
];

const MEAL_SLOTS = [
  { type: "breakfast" as const, label: "Breakfast", time: "8:00 AM", icon: Sun },
  { type: "lunch" as const, label: "Lunch", time: "12:30 PM", icon: Utensils },
  { type: "snack" as const, label: "Snack", time: "4:00 PM", icon: Coffee },
  { type: "dinner" as const, label: "Dinner", time: "7:30 PM", icon: Moon },
];

const LIFE_STAGE_INFO: Record<string, { label: string; icon: any; color: string; tips: string[] }> = {
  pregnancy: {
    label: "Pregnancy",
    icon: Baby,
    color: "bg-pink-100 text-pink-700 border-pink-200",
    tips: [
      "Aim for 300-450 extra calories/day",
      "Include iron-rich foods like spinach and lentils",
      "Folate from dark leafy greens is essential",
      "Stay hydrated with 8-10 glasses of water",
    ],
  },
  postpartum: {
    label: "Postpartum",
    icon: Heart,
    color: "bg-purple-100 text-purple-700 border-purple-200",
    tips: [
      "Focus on nutrient-dense recovery foods",
      "Include galactagogues if breastfeeding",
      "Iron-rich foods aid recovery",
      "Hydration is crucial for milk production",
    ],
  },
  menopause: {
    label: "Menopause",
    icon: Flower2,
    color: "bg-amber-100 text-amber-700 border-amber-200",
    tips: [
      "Calcium (1200mg/day) prevents bone loss",
      "Phytoestrogens in soy may help with symptoms",
      "Limit sodium for blood pressure management",
      "Magnesium-rich foods improve sleep quality",
    ],
  },
  not_applicable: {
    label: "General Wellness",
    icon: Sparkles,
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    tips: [
      "Balanced diet with all food groups",
      "5+ servings of fruits and vegetables daily",
      "Stay hydrated with 2+ liters of water",
      "Whole grains for sustained energy",
    ],
  },
};

const TRACKING_STORAGE_KEY = "nourish_meal_tracking";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function ensureMacros(r: RecipeBasic) {
  const cal = Number(r.Calories || r["Energy (kcal)"] || 0);
  const p = Number(r["Protein (g)"] || 0);
  const c = Number(r["Carbohydrate, by difference (g)"] || 0);
  const f = Number(r["Total lipid (fat) (g)"] || 0);
  if (!p && !c && !f && cal > 0) {
    return {
      ...r,
      "Protein (g)": String(Math.round((cal * 0.2) / 4)),
      "Carbohydrate, by difference (g)": String(Math.round((cal * 0.5) / 4)),
      "Total lipid (fat) (g)": String(Math.round((cal * 0.3) / 9)),
    };
  }
  return r;
}

function recipeToMeal(recipe: RecipeBasic, type: TrackedMeal["type"], slot: typeof MEAL_SLOTS[number]): TrackedMeal {
  const r = ensureMacros(recipe);
  return {
    id: `${type}_${r.Recipe_id}_${Date.now()}`,
    name: r.Recipe_title,
    type,
    time: slot.time,
    calories: Math.round(Number(r.Calories || r["Energy (kcal)"] || 0)),
    protein: Math.round(Number(r["Protein (g)"] || 0)),
    carbs: Math.round(Number(r["Carbohydrate, by difference (g)"] || 0)),
    fat: Math.round(Number(r["Total lipid (fat) (g)"] || 0)),
    status: "pending",
    recipeId: r.Recipe_id,
    region: r.Region || "",
    cookTime: r.cook_time || r.total_time?.toString() || "",
  };
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

const PatientDashboard = () => {
  const navigate = useNavigate();
  const { user } = useApp();

  // Patient profile
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Diet plans
  const [activePlan, setActivePlan] = useState<DietPlanDoc | null>(null);
  const [allPlans, setAllPlans] = useState<DietPlanDoc[]>([]);

  // Today's meal tracking
  const [todaysMeals, setTodaysMeals] = useState<TrackedMeal[]>([]);

  // Tabs
  const [activeTab, setActiveTab] = useState<TabId>("today");

  // Create plan filters
  const [filters, setFilters] = useState<Filters>({
    region: "",
    dietType: "",
    minCalories: 200,
    maxCalories: 600,
    minProtein: 5,
    maxProtein: 40,
    cookTime: "any",
    excludeIngredients: "",
    mealTypes: ["breakfast", "lunch", "snack", "dinner"],
  });
  const [generatedMeals, setGeneratedMeals] = useState<TrackedMeal[]>([]);
  const [generating, setGenerating] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  // Swap
  const [swappingMealId, setSwappingMealId] = useState<string | null>(null);
  const [swapOptions, setSwapOptions] = useState<RecipeBasic[]>([]);
  const [loadingSwap, setLoadingSwap] = useState(false);

  // Recipe detail view
  const [viewingRecipe, setViewingRecipe] = useState<RecipeViewData | null>(null);
  const [loadingRecipe, setLoadingRecipe] = useState(false);

  // Progress tracking data from localStorage
  const [trackingHistory, setTrackingHistory] = useState<Record<string, { eaten: number; total: number; calories: number }>>({});

  // ── Load patient profile ──
  useEffect(() => {
    if (!user?.id) return;
    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const snap = await getDoc(doc(db, "patients", user.id));
        if (snap.exists()) {
          const d = snap.data();
          const assessment = d.assessmentData || {};
          setProfile({
            name: d.name || user.name || "Patient",
            lifeStage: assessment.lifeStage || d.lifeStage || "not_applicable",
            pregnancyTrimester: assessment.pregnancyTrimester,
            dietaryPreferences: assessment.dietaryPreferences,
            allergies: assessment.allergies || d.allergies || [],
            healthGoals: assessment.healthGoals || [],
            currentConditions: assessment.currentConditions || [],
            isBreastfeeding: assessment.isBreastfeeding,
            menopauseStage: assessment.menopauseStage,
          });
        }
      } catch (e) {
        console.error("Error loading profile:", e);
      } finally {
        setLoadingProfile(false);
      }
    };
    loadProfile();
  }, [user?.id]);

  // ── Load diet plans ──
  useEffect(() => {
    if (!user?.id) return;
    const loadPlans = async () => {
      try {
        const q = query(
          collection(db, "patients", user.id, "dietPlans"),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const plans: DietPlanDoc[] = [];
        snap.forEach((d) => {
          plans.push({ id: d.id, ...d.data() } as DietPlanDoc);
        });
        setAllPlans(plans);
        if (plans.length > 0) {
          setActivePlan(plans[0]);
        }
      } catch (e) {
        console.error("Error loading diet plans:", e);
      }
    };
    loadPlans();
  }, [user?.id]);

  // ── Convert active plan to today's meals ──
  useEffect(() => {
    if (!activePlan) {
      setTodaysMeals([]);
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const savedTracking = localStorage.getItem(`${TRACKING_STORAGE_KEY}_${today}`);
    let savedStatuses: Record<string, string> = {};
    try {
      if (savedTracking) savedStatuses = JSON.parse(savedTracking);
    } catch { /* ignore */ }

    const meals: TrackedMeal[] = [];
    let counter = 1;

    // Format 1: PersonalizedDietChart days[] format
    if (activePlan.days && Array.isArray(activePlan.days)) {
      const todayIndex = new Date().getDay(); // 0=Sun
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      // Find today's day or first day
      const todayDay = activePlan.days.find((d: any) =>
        d.dayLabel?.toLowerCase().includes(dayNames[todayIndex].toLowerCase())
      ) || activePlan.days[0];

      if (todayDay?.meals) {
        for (const meal of todayDay.meals) {
          const mealType = meal.mealType === "breakfast" ? "breakfast"
            : meal.mealType === "lunch" ? "lunch"
            : meal.mealType === "dinner" ? "dinner"
            : "snack";
          const id = `plan_${counter}`;
          meals.push({
            id,
            name: meal.recipeName || "Unnamed Recipe",
            type: mealType as TrackedMeal["type"],
            time: meal.time || MEAL_SLOTS.find(s => s.type === mealType)?.time || "12:00 PM",
            calories: Math.round(meal.calories || meal.actualCalories || 0),
            protein: Math.round(meal.protein || 0),
            carbs: Math.round(meal.carbs || 0),
            fat: Math.round(meal.fat || 0),
            status: (savedStatuses[id] as TrackedMeal["status"]) || "pending",
            recipeId: meal.recipeId || "",
            region: meal.region || "",
            cookTime: meal.cookTime || "",
            dayLabel: todayDay.dayLabel,
          });
          counter++;
        }
      }
    }
    // Format 2: RecipeBuilder Daily/Weekly format
    else if (activePlan.meals) {
      const planMeals = activePlan.meals;
      const dailyMeals = planMeals.Daily || {};
      for (const [slotName, foods] of Object.entries(dailyMeals)) {
        if (!Array.isArray(foods)) continue;
        const mealType = slotName.toLowerCase().includes("breakfast") ? "breakfast"
          : slotName.toLowerCase().includes("lunch") ? "lunch"
          : slotName.toLowerCase().includes("dinner") ? "dinner"
          : "snack";
        for (const food of foods as any[]) {
          const id = `plan_${counter}`;
          meals.push({
            id,
            name: food.Food_Item || "Unknown",
            type: mealType as TrackedMeal["type"],
            time: MEAL_SLOTS.find(s => s.type === mealType)?.time || "12:00 PM",
            calories: Math.round(Number(food.Calories || 0)),
            protein: Math.round(Number(food.Protein || 0)),
            carbs: Math.round(Number(food.Carbs || 0)),
            fat: Math.round(Number(food.Fat || 0)),
            status: (savedStatuses[id] as TrackedMeal["status"]) || "pending",
            recipeId: food.Recipe_id || "",
            region: food.Region || "",
            cookTime: food.cook_time || "",
          });
          counter++;
        }
      }
    }

    setTodaysMeals(meals);
  }, [activePlan]);

  // ── Load tracking history ──
  useEffect(() => {
    const history: Record<string, { eaten: number; total: number; calories: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const saved = localStorage.getItem(`${TRACKING_STORAGE_KEY}_${key}`);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          const entries = Object.entries(data);
          const eaten = entries.filter(([, v]) => v === "eaten").length;
          history[key] = {
            eaten,
            total: entries.length,
            calories: Number(localStorage.getItem(`${TRACKING_STORAGE_KEY}_cal_${key}`) || 0),
          };
        } catch { /* ignore */ }
      }
    }
    setTrackingHistory(history);
  }, [todaysMeals]);

  // ── Update meal status ──
  const updateMealStatus = useCallback((mealId: string, status: TrackedMeal["status"]) => {
    setTodaysMeals(prev => {
      const updated = prev.map(m => m.id === mealId ? { ...m, status } : m);

      // Persist to localStorage
      const today = new Date().toISOString().split("T")[0];
      const statuses: Record<string, string> = {};
      let caloriesConsumed = 0;
      for (const m of updated) {
        statuses[m.id] = m.status;
        if (m.status === "eaten") caloriesConsumed += m.calories;
      }
      localStorage.setItem(`${TRACKING_STORAGE_KEY}_${today}`, JSON.stringify(statuses));
      localStorage.setItem(`${TRACKING_STORAGE_KEY}_cal_${today}`, String(caloriesConsumed));

      // Also persist to Firebase (fire-and-forget)
      if (user?.id) {
        const trackingRef = doc(db, "patients", user.id, "mealTracking", today);
        setDoc(trackingRef, {
          date: today,
          statuses,
          caloriesConsumed,
          totalMeals: updated.length,
          eatenCount: updated.filter(m => m.status === "eaten").length,
          skippedCount: updated.filter(m => m.status === "skipped").length,
          updatedAt: Timestamp.now(),
        }, { merge: true }).catch(console.error);
      }

      return updated;
    });
    toast.success(`Meal marked as ${status}`);
  }, [user?.id]);

  // ── Generate diet plan from filters ──
  const generatePlan = useCallback(async () => {
    setGenerating(true);
    setGeneratedMeals([]);

    try {
      const mealsToGenerate = filters.mealTypes.length > 0 ? filters.mealTypes : ["breakfast", "lunch", "snack", "dinner"];
      const allMeals: TrackedMeal[] = [];

      for (const mealType of mealsToGenerate) {
        const slot = MEAL_SLOTS.find(s => s.type === mealType) || MEAL_SLOTS[0];

        let recipes: RecipeBasic[] = [];

        // Strategy 1: Use combined filter endpoint
        try {
          const params: any = {
            limit: 10,
            page: Math.floor(Math.random() * 3) + 1,
          };
          if (filters.excludeIngredients) params.excludeIngredients = filters.excludeIngredients;
          if (mealType === "breakfast") params.title = "breakfast";
          else if (mealType === "lunch") params.title = "rice,curry,dal,lunch";
          else if (mealType === "dinner") params.title = "dinner,soup,stew";
          else params.title = "snack,salad,smoothie";

          recipes = await getRecipesByIngredientsCategoriesTitle(params);
        } catch { /* fallback below */ }

        // Strategy 2: By cuisine
        if ((!recipes || recipes.length === 0) && filters.region) {
          try {
            const res = await getRecipesByCuisine(filters.region, Math.floor(Math.random() * 3) + 1, 10);
            recipes = res.data || [];
          } catch { /* fallback */ }
        }

        // Strategy 3: By diet
        if ((!recipes || recipes.length === 0) && filters.dietType) {
          try {
            const res = await getRecipesByDiet(filters.dietType, 10, Math.floor(Math.random() * 3) + 1);
            recipes = res.data || [];
          } catch { /* fallback */ }
        }

        // Strategy 4: By calories
        if (!recipes || recipes.length === 0) {
          try {
            const res = await getRecipesByCalories(filters.minCalories, filters.maxCalories, 10, Math.floor(Math.random() * 5) + 1);
            recipes = res.data || [];
          } catch { /* fallback */ }
        }

        if (recipes && recipes.length > 0) {
          // Filter client-side
          let filtered = recipes;

          // Diet filter
          if (filters.dietType) {
            const dietFiltered = filtered.filter(r => (r as any)[filters.dietType] === "1");
            if (dietFiltered.length > 0) filtered = dietFiltered;
          }

          // Calorie filter
          filtered = filtered.filter(r => {
            const cal = Number(r.Calories || r["Energy (kcal)"] || 0);
            return cal >= filters.minCalories * 0.5 && cal <= filters.maxCalories * 2;
          });
          if (filtered.length === 0) filtered = recipes;

          // Protein filter
          if (filters.minProtein > 0 || filters.maxProtein < 40) {
            const pFiltered = filtered.filter(r => {
              const p = Number(r["Protein (g)"] || 0);
              return p >= filters.minProtein && p <= filters.maxProtein;
            });
            if (pFiltered.length > 0) filtered = pFiltered;
          }

          // Cook time filter
          if (filters.cookTime !== "any") {
            const maxMins = filters.cookTime === "quick" ? 30 : 60;
            const tFiltered = filtered.filter(r => {
              const t = parseInt(r.cook_time || r.total_time?.toString() || "0");
              return t > 0 && t <= maxMins;
            });
            if (tFiltered.length > 0) filtered = tFiltered;
          }

          // Pick 1-2 random
          const count = mealType === "snack" ? 1 : 1;
          for (let i = 0; i < count && filtered.length > 0; i++) {
            const idx = Math.floor(Math.random() * filtered.length);
            allMeals.push(recipeToMeal(filtered[idx], mealType as TrackedMeal["type"], slot));
            filtered.splice(idx, 1);
          }
        }

        // Small delay between API calls
        await new Promise(r => setTimeout(r, 1500));
      }

      if (allMeals.length === 0) {
        toast.error("No recipes found matching your filters. Try adjusting them.");
      } else {
        setGeneratedMeals(allMeals);
        toast.success(`Found ${allMeals.length} meals for your plan!`);
      }
    } catch (e) {
      console.error("Generate error:", e);
      toast.error("Error generating plan. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [filters]);

  // ── Save generated plan to Firebase ──
  const saveGeneratedPlan = useCallback(async () => {
    if (!user?.id || generatedMeals.length === 0) return;
    setSavingPlan(true);
    try {
      const planData = {
        patientName: profile?.name || user.name || "Patient",
        planDuration: "Daily",
        planType: "self-created",
        source: "patient-self-service",
        activeFilter: "Daily",
        totalMeals: generatedMeals.length,
        createdAt: Timestamp.now(),
        filters: { ...filters },
        meals: {
          Daily: {
            Breakfast: generatedMeals.filter(m => m.type === "breakfast").map(m => ({
              Food_Item: m.name, Calories: String(m.calories), Protein: String(m.protein),
              Carbs: String(m.carbs), Fat: String(m.fat), Region: m.region,
              cook_time: m.cookTime, Recipe_id: m.recipeId,
            })),
            Lunch: generatedMeals.filter(m => m.type === "lunch").map(m => ({
              Food_Item: m.name, Calories: String(m.calories), Protein: String(m.protein),
              Carbs: String(m.carbs), Fat: String(m.fat), Region: m.region,
              cook_time: m.cookTime, Recipe_id: m.recipeId,
            })),
            Snack: generatedMeals.filter(m => m.type === "snack").map(m => ({
              Food_Item: m.name, Calories: String(m.calories), Protein: String(m.protein),
              Carbs: String(m.carbs), Fat: String(m.fat), Region: m.region,
              cook_time: m.cookTime, Recipe_id: m.recipeId,
            })),
            Dinner: generatedMeals.filter(m => m.type === "dinner").map(m => ({
              Food_Item: m.name, Calories: String(m.calories), Protein: String(m.protein),
              Carbs: String(m.carbs), Fat: String(m.fat), Region: m.region,
              cook_time: m.cookTime, Recipe_id: m.recipeId,
            })),
          },
        },
      };

      const ref = await addDoc(collection(db, "patients", user.id, "dietPlans"), planData);
      const newPlan = { id: ref.id, ...planData } as unknown as DietPlanDoc;
      setAllPlans(prev => [newPlan, ...prev]);
      setActivePlan(newPlan);
      setActiveTab("today");
      toast.success("Diet plan saved! Tracking it now.");
    } catch (e) {
      console.error("Save error:", e);
      toast.error("Failed to save plan");
    } finally {
      setSavingPlan(false);
    }
  }, [user?.id, generatedMeals, profile, filters]);

  // ── Swap meal ──
  const handleSwap = useCallback(async (meal: TrackedMeal) => {
    setSwappingMealId(meal.id);
    setSwapOptions([]);
    setLoadingSwap(true);
    try {
      const params: any = { limit: 6, page: Math.floor(Math.random() * 5) + 1 };
      if (meal.type === "breakfast") params.title = "breakfast";
      else if (meal.type === "lunch") params.title = "lunch,rice,curry";
      else if (meal.type === "dinner") params.title = "dinner,soup";
      else params.title = "snack,salad";

      if (filters.excludeIngredients) params.excludeIngredients = filters.excludeIngredients;

      let recipes = await getRecipesByIngredientsCategoriesTitle(params);
      // Filter out current meal
      recipes = (recipes || []).filter(r => r.Recipe_id !== meal.recipeId);
      setSwapOptions(recipes.slice(0, 5));

      if (recipes.length === 0) {
        toast.info("No alternative recipes found. Try adjusting filters.");
      }
    } catch {
      toast.error("Could not load swap options");
    } finally {
      setLoadingSwap(false);
    }
  }, [filters.excludeIngredients]);

  const confirmSwap = useCallback((meal: TrackedMeal, replacement: RecipeBasic) => {
    const slot = MEAL_SLOTS.find(s => s.type === meal.type) || MEAL_SLOTS[0];
    const newMeal = recipeToMeal(replacement, meal.type, slot);
    newMeal.id = meal.id; // Keep same ID for tracking continuity
    newMeal.status = "pending";

    setTodaysMeals(prev => prev.map(m => m.id === meal.id ? newMeal : m));
    setSwappingMealId(null);
    setSwapOptions([]);
    toast.success(`Swapped to "${replacement.Recipe_title}"`);
  }, []);

  // ── View recipe details ──
  const handleViewRecipe = useCallback(async (recipeId: string) => {
    if (!recipeId) return;
    setLoadingRecipe(true);
    try {
      const [recipeRes, instructionRes] = await Promise.all([
        searchRecipeById(recipeId).catch(() => null),
        getInstructionsByRecipeId(recipeId).catch(() => null),
      ]);
      const recipe = recipeRes?.recipe || null;
      const instructions = instructionRes?.steps?.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n") || "Instructions not available.";
      if (recipe) {
        setViewingRecipe({ recipe, instructions });
      } else {
        toast.error("Recipe details not available");
      }
    } catch {
      toast.error("Could not load recipe details");
    } finally {
      setLoadingRecipe(false);
    }
  }, []);

  // ── Computed stats ──
  const todayStats = {
    total: todaysMeals.length,
    eaten: todaysMeals.filter(m => m.status === "eaten").length,
    skipped: todaysMeals.filter(m => m.status === "skipped").length,
    pending: todaysMeals.filter(m => m.status === "pending").length,
    totalCalories: todaysMeals.reduce((s, m) => s + m.calories, 0),
    caloriesConsumed: todaysMeals.filter(m => m.status === "eaten").reduce((s, m) => s + m.calories, 0),
    proteinConsumed: todaysMeals.filter(m => m.status === "eaten").reduce((s, m) => s + m.protein, 0),
    completionPct: todaysMeals.length > 0 ? Math.round((todaysMeals.filter(m => m.status === "eaten").length / todaysMeals.length) * 100) : 0,
  };

  const lifeStage = profile?.lifeStage || "not_applicable";
  const stageInfo = LIFE_STAGE_INFO[lifeStage] || LIFE_STAGE_INFO.not_applicable;
  const StageIcon = stageInfo.icon;

  // ── Loading state ──
  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold text-lg">
            {(profile?.name || "P").charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {getGreeting()}, {(profile?.name || "there").split(" ")[0]}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`gap-1 ${stageInfo.color}`}>
                <StageIcon className="w-3 h-3" />
                {stageInfo.label}
                {lifeStage === "pregnancy" && profile?.pregnancyTrimester && ` · T${profile.pregnancyTrimester}`}
              </Badge>
              {profile?.allergies && profile.allergies.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {profile.allergies.length} allergies
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        {todaysMeals.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="text-center px-3">
              <div className="text-lg font-bold text-emerald-600">{todayStats.completionPct}%</div>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
            <div className="text-center px-3 border-l">
              <div className="text-lg font-bold">{todayStats.caloriesConsumed}</div>
              <p className="text-xs text-muted-foreground">Cal eaten</p>
            </div>
            <div className="text-center px-3 border-l">
              <div className="text-lg font-bold">{todayStats.eaten}/{todayStats.total}</div>
              <p className="text-xs text-muted-foreground">Meals</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-lg p-1 shadow-sm border">
        <div className="flex gap-1">
          {([
            { id: "today" as TabId, label: "Today", icon: Sun },
            { id: "plan" as TabId, label: "My Plans", icon: Calendar },
            { id: "create" as TabId, label: "Create Plan", icon: Filter },
            { id: "progress" as TabId, label: "Progress", icon: TrendingUp },
          ]).map(tab => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                className={`flex-1 gap-2 ${activeTab === tab.id ? "bg-emerald-600 text-white hover:bg-emerald-700" : "text-slate-600"}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* ── TODAY TAB ── */}
      {activeTab === "today" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Meal checklist */}
          <div className="lg:col-span-2 space-y-4">
            {todaysMeals.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ChefHat className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">No diet plan active</h3>
                  <p className="text-muted-foreground mb-4">
                    {allPlans.length > 0
                      ? "Select a plan from 'My Plans' or create a new one."
                      : "Create your first diet plan using simple filters."}
                  </p>
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setActiveTab("create")}>
                    <Filter className="w-4 h-4 mr-2" />
                    Create Diet Plan
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Progress bar */}
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Today's Progress</span>
                      <span className="text-sm font-bold text-emerald-600">{todayStats.completionPct}%</span>
                    </div>
                    <Progress value={todayStats.completionPct} className="h-3" />
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>{todayStats.eaten} eaten</span>
                      <span>{todayStats.skipped} skipped</span>
                      <span>{todayStats.pending} pending</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Meal cards */}
                {todaysMeals.map((meal) => {
                  const SlotIcon = MEAL_SLOTS.find(s => s.type === meal.type)?.icon || Utensils;
                  const statusColors = {
                    eaten: "border-l-emerald-500 bg-emerald-50/50",
                    skipped: "border-l-red-400 bg-red-50/30",
                    pending: "border-l-amber-400 bg-amber-50/30",
                  };
                  return (
                    <Card key={meal.id} className={`border-l-4 ${statusColors[meal.status]} transition-all`}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="mt-1 p-2 rounded-lg bg-white shadow-sm border">
                              <SlotIcon className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold truncate">{meal.name}</h3>
                                {meal.status === "eaten" && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                                {meal.status === "skipped" && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {meal.time} · {meal.type.charAt(0).toUpperCase() + meal.type.slice(1)}
                                {meal.dayLabel && ` · ${meal.dayLabel}`}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-xs">
                                <span className="flex items-center gap-1">
                                  <Flame className="w-3 h-3 text-orange-500" />
                                  {meal.calories} cal
                                </span>
                                <span className="flex items-center gap-1">
                                  <Drumstick className="w-3 h-3 text-red-500" />
                                  {meal.protein}g protein
                                </span>
                                <span className="flex items-center gap-1">
                                  <Wheat className="w-3 h-3 text-amber-600" />
                                  {meal.carbs}g carbs
                                </span>
                                <span className="flex items-center gap-1">
                                  <Droplets className="w-3 h-3 text-blue-500" />
                                  {meal.fat}g fat
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              variant={meal.status === "eaten" ? "default" : "outline"}
                              className={`h-7 text-xs ${meal.status === "eaten" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                              onClick={() => updateMealStatus(meal.id, meal.status === "eaten" ? "pending" : "eaten")}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {meal.status === "eaten" ? "Eaten" : "Mark Eaten"}
                            </Button>
                            <Button
                              size="sm"
                              variant={meal.status === "skipped" ? "destructive" : "ghost"}
                              className="h-7 text-xs"
                              onClick={() => updateMealStatus(meal.id, meal.status === "skipped" ? "pending" : "skipped")}
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              {meal.status === "skipped" ? "Skipped" : "Skip"}
                            </Button>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs px-2"
                                onClick={() => handleSwap(meal)}
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                              </Button>
                              {meal.recipeId && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs px-2"
                                  onClick={() => handleViewRecipe(meal.recipeId!)}
                                  disabled={loadingRecipe}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Swap options */}
                        {swappingMealId === meal.id && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs font-medium mb-2">Swap with:</p>
                            {loadingSwap ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Loading alternatives...
                              </div>
                            ) : swapOptions.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-1">No alternatives found.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {swapOptions.map(opt => (
                                  <button
                                    key={opt.Recipe_id}
                                    onClick={() => confirmSwap(meal, opt)}
                                    className="w-full text-left p-2 rounded-lg border hover:bg-emerald-50 hover:border-emerald-200 transition-colors text-xs flex items-center justify-between"
                                  >
                                    <div>
                                      <span className="font-medium">{opt.Recipe_title}</span>
                                      <span className="text-muted-foreground ml-2">
                                        {Math.round(Number(opt.Calories || 0))} cal · {opt.Region || "Global"}
                                      </span>
                                    </div>
                                    <ArrowRightLeft className="w-3 h-3 text-emerald-500" />
                                  </button>
                                ))}
                              </div>
                            )}
                            <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => { setSwappingMealId(null); setSwapOptions([]); }}>
                              Cancel
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Nutrition summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Nutrition Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span className="text-sm">Calories</span>
                  </div>
                  <span className="text-sm font-bold">{todayStats.caloriesConsumed} / {todayStats.totalCalories}</span>
                </div>
                <Progress value={todayStats.totalCalories > 0 ? (todayStats.caloriesConsumed / todayStats.totalCalories) * 100 : 0} className="h-2" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Drumstick className="w-4 h-4 text-red-500" />
                    <span className="text-sm">Protein</span>
                  </div>
                  <span className="text-sm font-bold">{todayStats.proteinConsumed}g</span>
                </div>
              </CardContent>
            </Card>

            {/* Health tips based on life stage */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <StageIcon className="w-4 h-4" />
                  Tips for {stageInfo.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {stageInfo.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Reminders */}
            {todaysMeals.filter(m => m.status === "pending").length > 0 && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700">
                    <Clock className="w-4 h-4" />
                    Upcoming Meals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {todaysMeals.filter(m => m.status === "pending").slice(0, 3).map(meal => (
                    <div key={meal.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate mr-2">{meal.name}</span>
                      <Badge variant="outline" className="text-xs shrink-0">{meal.time}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Quick actions */}
            <Card>
              <CardContent className="py-4 space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2 text-sm" onClick={() => navigate("/patient/meal-logging")}>
                  <ChefHat className="w-4 h-4" /> Meal Logging & Feedback
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2 text-sm" onClick={() => navigate("/patient/consult-doctor")}>
                  <User className="w-4 h-4" /> Consult Doctor
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2 text-sm" onClick={() => navigate("/patient/lifestyle-tracker")}>
                  <Heart className="w-4 h-4" /> Lifestyle Tracker
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── MY PLANS TAB ── */}
      {activeTab === "plan" && (
        <div className="space-y-4">
          {allPlans.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-2">No diet plans yet</h3>
                <p className="text-muted-foreground mb-4">Create one using filters or wait for your doctor to assign one.</p>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setActiveTab("create")}>
                  <Filter className="w-4 h-4 mr-2" /> Create Plan
                </Button>
              </CardContent>
            </Card>
          ) : (
            allPlans.map(plan => {
              const isActive = activePlan?.id === plan.id;
              const createdDate = plan.createdAt?.toDate?.() || new Date(plan.createdAt);
              return (
                <Card key={plan.id} className={`transition-all ${isActive ? "border-emerald-300 ring-1 ring-emerald-200" : ""}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            {plan.source === "patient-self-service" ? "Self-Created Plan" : plan.source === "personalized-diet-chart" ? "Doctor's Plan" : plan.planType || "Diet Plan"}
                          </h3>
                          {isActive && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Active</Badge>}
                          {plan.source === "personalized-diet-chart" && (
                            <Badge variant="outline" className="text-xs">Doctor Assigned</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {plan.totalMeals} meals · {plan.planDuration} · Created {createdDate.toLocaleDateString()}
                        </p>
                        {plan.patientName && (
                          <p className="text-xs text-muted-foreground">For: {plan.patientName}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!isActive && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => {
                              setActivePlan(plan);
                              setActiveTab("today");
                              toast.success("Plan activated!");
                            }}
                          >
                            Activate
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── CREATE PLAN TAB ── */}
      {activeTab === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Filters */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="w-4 h-4" /> Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Region */}
              <div>
                <Label className="text-xs font-medium">Cuisine / Region</Label>
                <Select value={filters.region} onValueChange={v => setFilters(p => ({ ...p, region: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Any region" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Region</SelectItem>
                    {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Diet type */}
              <div>
                <Label className="text-xs font-medium">Diet Type</Label>
                <Select value={filters.dietType} onValueChange={v => setFilters(p => ({ ...p, dietType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Any diet" /></SelectTrigger>
                  <SelectContent>
                    {DIET_TYPES.map(d => <SelectItem key={d.value || "any"} value={d.value || "any"}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Calories */}
              <div>
                <Label className="text-xs font-medium">Calories per meal: {filters.minCalories} - {filters.maxCalories} kcal</Label>
                <div className="mt-2 px-1">
                  <Slider
                    value={[filters.minCalories, filters.maxCalories]}
                    onValueChange={([min, max]) => setFilters(p => ({ ...p, minCalories: min, maxCalories: max }))}
                    min={50}
                    max={1200}
                    step={50}
                  />
                </div>
              </div>

              {/* Protein */}
              <div>
                <Label className="text-xs font-medium">Protein per meal: {filters.minProtein} - {filters.maxProtein}g</Label>
                <div className="mt-2 px-1">
                  <Slider
                    value={[filters.minProtein, filters.maxProtein]}
                    onValueChange={([min, max]) => setFilters(p => ({ ...p, minProtein: min, maxProtein: max }))}
                    min={0}
                    max={80}
                    step={5}
                  />
                </div>
              </div>

              {/* Cook time */}
              <div>
                <Label className="text-xs font-medium">Cook Time</Label>
                <Select value={filters.cookTime} onValueChange={v => setFilters(p => ({ ...p, cookTime: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="quick">Quick (&lt; 30 min)</SelectItem>
                    <SelectItem value="medium">Medium (30-60 min)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Exclude ingredients */}
              <div>
                <Label className="text-xs font-medium">Exclude Ingredients</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. peanut, shellfish"
                  value={filters.excludeIngredients}
                  onChange={e => setFilters(p => ({ ...p, excludeIngredients: e.target.value }))}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Comma-separated</p>
              </div>

              {/* Pre-fill from profile allergies */}
              {profile?.allergies && profile.allergies.length > 0 && !filters.excludeIngredients && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setFilters(p => ({ ...p, excludeIngredients: profile!.allergies!.join(",") }))}
                >
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Auto-fill my allergies ({profile.allergies.join(", ")})
                </Button>
              )}

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={generatePlan}
                disabled={generating}
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate Meal Plan</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Generated meals */}
          <div className="lg:col-span-2 space-y-4">
            {generatedMeals.length === 0 && !generating ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                  <h3 className="font-medium mb-1">Set your filters and generate</h3>
                  <p className="text-sm text-muted-foreground">
                    We'll find recipes from 118,000+ options matching your preferences.
                  </p>
                </CardContent>
              </Card>
            ) : generating ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-600" />
                  <p className="text-muted-foreground">Finding the best recipes for you...</p>
                  <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {generatedMeals.map((meal, idx) => {
                  const SlotIcon = MEAL_SLOTS.find(s => s.type === meal.type)?.icon || Utensils;
                  return (
                    <Card key={idx}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                              <SlotIcon className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                              <Badge variant="outline" className="text-xs mb-1">
                                {meal.type.charAt(0).toUpperCase() + meal.type.slice(1)} · {meal.time}
                              </Badge>
                              <h3 className="font-semibold">{meal.name}</h3>
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                                <span><Flame className="w-3 h-3 inline mr-0.5 text-orange-500" />{meal.calories} cal</span>
                                <span><Drumstick className="w-3 h-3 inline mr-0.5 text-red-500" />{meal.protein}g protein</span>
                                <span><Wheat className="w-3 h-3 inline mr-0.5 text-amber-600" />{meal.carbs}g carbs</span>
                                <span><Droplets className="w-3 h-3 inline mr-0.5 text-blue-500" />{meal.fat}g fat</span>
                              </div>
                              {meal.region && <p className="text-xs text-muted-foreground mt-1">Region: {meal.region}</p>}
                              {meal.cookTime && <p className="text-xs text-muted-foreground">Cook: {meal.cookTime} min</p>}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => {
                              const newMeals = [...generatedMeals];
                              newMeals.splice(idx, 1);
                              setGeneratedMeals(newMeals);
                            }}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={saveGeneratedPlan}
                    disabled={savingPlan || generatedMeals.length === 0}
                  >
                    {savingPlan ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> Save & Activate Plan</>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => { setGeneratedMeals([]); }}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Reset
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── PROGRESS TAB ── */}
      {activeTab === "progress" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Weekly overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - i);
                  const key = d.toISOString().split("T")[0];
                  const data = trackingHistory[key];
                  const pct = data ? Math.round((data.eaten / data.total) * 100) : 0;
                  const dayLabel = i === 0 ? "Today" : i === 1 ? "Yesterday" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-24 shrink-0">{dayLabel}</span>
                      <div className="flex-1">
                        <Progress value={pct} className="h-2.5" />
                      </div>
                      <span className="text-xs font-medium w-10 text-right">
                        {data ? `${pct}%` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="space-y-4">
            <Card>
              <CardContent className="py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-emerald-50 rounded-lg">
                    <div className="text-2xl font-bold text-emerald-600">{todayStats.completionPct}%</div>
                    <p className="text-xs text-muted-foreground mt-1">Today's Completion</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{todayStats.caloriesConsumed}</div>
                    <p className="text-xs text-muted-foreground mt-1">Calories Today</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{todayStats.proteinConsumed}g</div>
                    <p className="text-xs text-muted-foreground mt-1">Protein Today</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-lg">
                    <div className="text-2xl font-bold text-amber-600">{allPlans.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Total Plans</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Weekly avg */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Weekly Average</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const days = Object.values(trackingHistory);
                  const avgPct = days.length > 0 ? Math.round(days.reduce((s, d) => s + (d.eaten / d.total) * 100, 0) / days.length) : 0;
                  const avgCal = days.length > 0 ? Math.round(days.reduce((s, d) => s + d.calories, 0) / days.length) : 0;
                  return (
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Avg Completion</span>
                          <span className="font-bold">{avgPct}%</span>
                        </div>
                        <Progress value={avgPct} className="h-2" />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Avg Calories/day</span>
                        <span className="font-bold">{avgCal} kcal</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Days tracked</span>
                        <span className="font-bold">{days.length} / 7</span>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Recipe Detail Modal ── */}
      {viewingRecipe && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingRecipe(null)}>
          <Card className="max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{viewingRecipe.recipe.Recipe_title}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setViewingRecipe(null)}>
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-slate-50 rounded">
                  <span className="text-muted-foreground">Calories: </span>
                  <span className="font-medium">{viewingRecipe.recipe.Calories || viewingRecipe.recipe["Energy (kcal)"] || "N/A"}</span>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <span className="text-muted-foreground">Protein: </span>
                  <span className="font-medium">{viewingRecipe.recipe["Protein (g)"] || "N/A"}g</span>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <span className="text-muted-foreground">Region: </span>
                  <span className="font-medium">{viewingRecipe.recipe.Region || "Global"}</span>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <span className="text-muted-foreground">Cook Time: </span>
                  <span className="font-medium">{viewingRecipe.recipe.cook_time || viewingRecipe.recipe.total_time || "N/A"} min</span>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">Instructions</h4>
                <div className="text-sm text-muted-foreground whitespace-pre-line bg-slate-50 p-3 rounded">
                  {viewingRecipe.instructions}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading recipe overlay */}
      {loadingRecipe && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 shadow-lg flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            <span>Loading recipe details...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDashboard;
