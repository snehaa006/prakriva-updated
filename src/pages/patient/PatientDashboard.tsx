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
import { useCachedPageData } from "@/hooks/useCachedPageData";
import { supabase } from "@/lib/supabase";
import { isPreviewMode } from "@/lib/previewMode";
import {
  PREVIEW_ALL_PLANS,
  PREVIEW_DIET_PLAN_DOC,
  PREVIEW_PROFILE,
  PREVIEW_TODAY_MEALS,
} from "@/lib/previewMockData";
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
  createdAt: string;
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
    color: "bg-accent-soft text-accent-soft-foreground border-transparent",
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
    color: "bg-vata/10 text-vata border-transparent",
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
    color: "bg-pitta/10 text-pitta border-transparent",
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
    color: "bg-accent-soft text-accent-soft-foreground border-transparent",
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

/** The dashboard's slice of the patient's record. */
const fetchDashboardProfile = async (
  patientId: string,
  fallbackName?: string
): Promise<PatientProfile | null> => {
  if (isPreviewMode()) return PREVIEW_PROFILE;

  const { data, error } = await supabase
    .from("patients")
    .select("name, allergies, assessment_data")
    .eq("id", patientId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const assessment = (data.assessment_data as Record<string, any>) || {};
  return {
    name: data.name || fallbackName || "Patient",
    lifeStage: assessment.lifeStage || "not_applicable",
    pregnancyTrimester: assessment.pregnancyTrimester,
    dietaryPreferences: assessment.dietaryPreferences,
    allergies: assessment.allergies || data.allergies || [],
    healthGoals: assessment.healthGoals || [],
    currentConditions: assessment.currentConditions || [],
    isBreastfeeding: assessment.isBreastfeeding,
    menopauseStage: assessment.menopauseStage,
  };
};

const PatientDashboard = () => {
  const navigate = useNavigate();
  const { user, healthTracks } = useApp();

  // Patient profile
  const [profile, setProfile] = useState<PatientProfile | null>(null);

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
  //
  // Cached: the dashboard is the tab everything else returns to, so it should
  // paint from the last load rather than spinning on every visit.
  const { data: loadedProfile, error: profileError, isFirstLoad: loadingProfile } =
    useCachedPageData(
      ["patient-dashboard-profile", user?.id ?? null],
      () => fetchDashboardProfile(user!.id, user?.name),
      { enabled: !!user?.id }
    );

  useEffect(() => {
    if (profileError) console.error("Error loading profile:", profileError);
  }, [profileError]);

  useEffect(() => {
    if (loadedProfile) setProfile(loadedProfile);
  }, [loadedProfile]);

  // ── Load diet plans ──
  useEffect(() => {
    if (!user?.id) return;

    // Preview: skip Supabase entirely — "preview-patient" has no real rows,
    // so a doctor-assigned plan is faked here so the Today/My Plans tabs are
    // populated instead of showing the empty states.
    if (isPreviewMode()) {
      setAllPlans(PREVIEW_ALL_PLANS as unknown as DietPlanDoc[]);
      setActivePlan(PREVIEW_DIET_PLAN_DOC as unknown as DietPlanDoc);
      return;
    }

    const loadPlans = async () => {
      try {
        const { data, error } = await supabase
          .from("diet_plans")
          .select("*")
          .eq("patient_id", user.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const plans: DietPlanDoc[] = (data ?? []).map((row: any) => ({
          id: row.id,
          patientName: row.patient_name,
          planDuration: row.plan_duration,
          planType: row.plan_type,
          meals: row.meals,
          days: row.meals?.days,
          createdAt: row.created_at,
          totalMeals: row.total_meals,
          activeFilter: row.active_filter,
          source: row.source,
        }));
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

    // Format 1: days[] format from Recipe Builder's Personalized Generator
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

    // localStorage is per-browser, so a reload on another device (or after the
    // cache is cleared) would show every meal as pending even though the
    // choices were saved. meal_tracking is the durable record — pull today's
    // row and apply any saved statuses on top. Keyed by the same plan_N ids.
    if (user?.id) {
      void supabase
        .from("meal_tracking")
        .select("statuses")
        .eq("patient_id", user.id)
        .eq("date", today)
        .maybeSingle()
        .then(({ data }) => {
          const saved = (data?.statuses as Record<string, string>) || {};
          if (Object.keys(saved).length === 0) return;
          setTodaysMeals((prev) =>
            prev.map((m) =>
              saved[m.id] ? { ...m, status: saved[m.id] as TrackedMeal["status"] } : m
            )
          );
        });
    }
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

      // Also persist to Supabase (fire-and-forget). The unique index on
      // (patient_id, date) gives us the same one-row-per-day behaviour the
      // Firestore document id of {date} did.
      if (user?.id) {
        void supabase
          .from("meal_tracking")
          .upsert({
            patient_id: user.id,
            date: today,
            statuses,
            calories_consumed: caloriesConsumed,
            total_meals: updated.length,
            eaten_count: updated.filter(m => m.status === "eaten").length,
            skipped_count: updated.filter(m => m.status === "skipped").length,
          }, { onConflict: "patient_id,date" })
          .then(({ error }) => { if (error) console.error(error); });
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

  // ── Save generated plan to Supabase ──
  const saveGeneratedPlan = useCallback(async () => {
    if (!user?.id || generatedMeals.length === 0) return;
    setSavingPlan(true);
    try {
      const planData = {
        patient_id: user.id,
        patient_name: profile?.name || user.name || "Patient",
        plan_duration: "Daily",
        plan_type: "self-created",
        source: "patient-self-service",
        active_filter: "Daily",
        total_meals: generatedMeals.length,
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

      const { data: inserted, error } = await supabase
        .from("diet_plans")
        .insert(planData)
        .select("id, created_at")
        .single();
      if (error) throw error;

      const newPlan: DietPlanDoc = {
        id: inserted.id,
        patientName: planData.patient_name,
        planDuration: planData.plan_duration,
        planType: planData.plan_type,
        meals: planData.meals,
        createdAt: inserted.created_at,
        totalMeals: planData.total_meals,
        activeFilter: planData.active_filter,
        source: planData.source,
      };
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
      <div className="flex h-[60vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-footnote text-foreground-secondary">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col justify-between gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
            {(profile?.name || "P").charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-title2 text-foreground">
              {getGreeting()}, {(profile?.name || "there").split(" ")[0]}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge className={`gap-1 ${stageInfo.color}`}>
                <StageIcon className="h-3 w-3" />
                {stageInfo.label}
                {lifeStage === "pregnancy" && profile?.pregnancyTrimester && ` · T${profile.pregnancyTrimester}`}
              </Badge>
              {profile?.allergies && profile.allergies.length > 0 && (
                <Badge variant="outline" className="text-caption1">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  {profile.allergies.length} allergies
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        {todaysMeals.length > 0 && (
          <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-5">
            <div className="text-center">
              <div className="text-title3 text-primary">{todayStats.completionPct}%</div>
              <p className="text-caption1 text-foreground-secondary">Today</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="text-title3 text-foreground">{todayStats.caloriesConsumed}</div>
              <p className="text-caption1 text-foreground-secondary">Cal eaten</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="text-title3 text-foreground">
                {todayStats.eaten}/{todayStats.total}
              </div>
              <p className="text-caption1 text-foreground-secondary">Meals</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="rounded-2xl border border-border bg-card p-1 shadow-xs">
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
                className={`h-11 flex-1 gap-2 px-1.5 sm:h-10 sm:px-4 ${activeTab === tab.id ? "" : "text-foreground-secondary"}`}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden truncate text-caption1 sm:inline sm:text-sm">{tab.label}</span>
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
                <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
                    <ChefHat className="h-7 w-7 text-primary" />
                  </div>
                  <div className="max-w-sm space-y-1.5">
                    <h3 className="text-headline text-foreground">No diet plan active yet</h3>
                    <p className="text-footnote text-foreground-secondary">
                      {allPlans.length > 0
                        ? "Choose a plan from “My Plans”, or put together a new one."
                        : "Let's put together your first diet plan — it only takes a couple of filters."}
                    </p>
                  </div>
                  <Button onClick={() => setActiveTab("create")}>
                    <Filter className="mr-2 h-4 w-4" />
                    Create diet plan
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Today's progress — the number that dominates this tab */}
                <Card>
                  <CardContent className="py-6">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-caption1 uppercase tracking-wide text-foreground-tertiary">Today's progress</p>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-large-title text-primary">{todayStats.completionPct}%</span>
                          <span className="text-footnote text-foreground-secondary">
                            {todayStats.eaten} of {todayStats.total} meals logged
                          </span>
                        </div>
                      </div>
                    </div>
                    <Progress value={todayStats.completionPct} className="mt-4 h-2.5" />
                    <div className="mt-3 flex gap-5 text-caption1 text-foreground-secondary">
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" /> {todayStats.eaten} eaten
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-warning" /> {todayStats.skipped} skipped
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground-tertiary/50" /> {todayStats.pending} pending
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Meal cards */}
                {todaysMeals.map((meal) => {
                  const SlotIcon = MEAL_SLOTS.find(s => s.type === meal.type)?.icon || Utensils;
                  const isEaten = meal.status === "eaten";
                  const isSkipped = meal.status === "skipped";
                  return (
                    <Card
                      key={meal.id}
                      className={`transition-all duration-200 ease-ios ${
                        isEaten ? "bg-accent-soft/40" : isSkipped ? "bg-muted/40" : ""
                      }`}
                    >
                      <CardContent className="py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div className="flex flex-1 min-w-0 items-start gap-3.5">
                            <div
                              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                                isEaten ? "bg-primary text-primary-foreground" : "bg-accent-soft text-primary"
                              }`}
                            >
                              <SlotIcon className="h-4.5 w-4.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="truncate text-subhead font-semibold text-foreground">{meal.name}</h3>
                                {isEaten && <CheckCircle className="h-4 w-4 shrink-0 text-success" />}
                                {isSkipped && <XCircle className="h-4 w-4 shrink-0 text-foreground-tertiary" />}
                              </div>
                              <p className="mt-0.5 text-caption1 text-foreground-secondary">
                                {meal.time} · {meal.type.charAt(0).toUpperCase() + meal.type.slice(1)}
                                {meal.dayLabel && ` · ${meal.dayLabel}`}
                              </p>
                              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption1 text-foreground-secondary">
                                <span className="flex items-center gap-1">
                                  <Flame className="h-3 w-3 text-pitta" />
                                  {meal.calories} cal
                                </span>
                                <span className="flex items-center gap-1">
                                  <Drumstick className="h-3 w-3 text-primary" />
                                  {meal.protein}g protein
                                </span>
                                <span className="flex items-center gap-1">
                                  <Wheat className="h-3 w-3 text-kapha" />
                                  {meal.carbs}g carbs
                                </span>
                                <span className="flex items-center gap-1">
                                  <Droplets className="h-3 w-3 text-vata" />
                                  {meal.fat}g fat
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex shrink-0 flex-row items-center justify-between gap-1.5 sm:flex-col sm:items-end">
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant={isEaten ? "default" : "outline"}
                                className="h-10 gap-1.5 text-caption1 sm:h-8"
                                onClick={() => updateMealStatus(meal.id, isEaten ? "pending" : "eaten")}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                {isEaten ? "Eaten" : "Mark eaten"}
                              </Button>
                              <Button
                                size="sm"
                                variant={isSkipped ? "secondary" : "ghost"}
                                className="h-10 gap-1.5 text-caption1 text-foreground-secondary sm:h-8"
                                onClick={() => updateMealStatus(meal.id, isSkipped ? "pending" : "skipped")}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                {isSkipped ? "Skipped" : "Skip"}
                              </Button>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-10 w-10 px-2 text-foreground-tertiary sm:h-7 sm:w-auto"
                                onClick={() => handleSwap(meal)}
                                title="Swap meal"
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                              </Button>
                              {meal.recipeId && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-10 w-10 px-2 text-foreground-tertiary sm:h-7 sm:w-auto"
                                  onClick={() => handleViewRecipe(meal.recipeId!)}
                                  disabled={loadingRecipe}
                                  title="View recipe"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Swap options */}
                        {swappingMealId === meal.id && (
                          <div className="mt-4 border-t border-border pt-4">
                            <p className="mb-2 text-caption1 font-medium text-foreground-secondary">Swap with</p>
                            {loadingSwap ? (
                              <div className="flex items-center gap-2 py-2 text-caption1 text-foreground-secondary">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Finding alternatives…
                              </div>
                            ) : swapOptions.length === 0 ? (
                              <p className="py-1 text-caption1 text-foreground-secondary">
                                Couldn't find alternatives — try again in a moment.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {swapOptions.map(opt => (
                                  <button
                                    key={opt.Recipe_id}
                                    onClick={() => confirmSwap(meal, opt)}
                                    className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5 text-left text-caption1 transition-colors hover:border-primary/30 hover:bg-accent-soft"
                                  >
                                    <div className="min-w-0">
                                      <span className="font-medium text-foreground">{opt.Recipe_title}</span>
                                      <span className="ml-2 text-foreground-secondary">
                                        {Math.round(Number(opt.Calories || 0))} cal · {opt.Region || "Global"}
                                      </span>
                                    </div>
                                    <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-primary" />
                                  </button>
                                ))}
                              </div>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-2 text-caption1 text-foreground-secondary"
                              onClick={() => { setSwappingMealId(null); setSwapOptions([]); }}
                            >
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
                <CardTitle className="text-subhead font-semibold">Nutrition summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-foreground-secondary">
                      <Flame className="h-4 w-4 text-pitta" />
                      <span className="text-footnote">Calories</span>
                    </div>
                    <span className="text-footnote font-semibold text-foreground">
                      {todayStats.caloriesConsumed} / {todayStats.totalCalories}
                    </span>
                  </div>
                  <Progress
                    value={todayStats.totalCalories > 0 ? (todayStats.caloriesConsumed / todayStats.totalCalories) * 100 : 0}
                    className="mt-2 h-2"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground-secondary">
                    <Drumstick className="h-4 w-4 text-primary" />
                    <span className="text-footnote">Protein</span>
                  </div>
                  <span className="text-footnote font-semibold text-foreground">{todayStats.proteinConsumed}g</span>
                </div>
              </CardContent>
            </Card>

            {/* Health tips based on life stage */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-subhead font-semibold">
                  <StageIcon className="h-4 w-4 text-primary" />
                  Tips for {stageInfo.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {stageInfo.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-footnote text-foreground-secondary">
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Reminders */}
            {todaysMeals.filter(m => m.status === "pending").length > 0 && (
              <Card className="bg-accent-soft/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-subhead font-semibold text-accent-soft-foreground">
                    <Clock className="h-4 w-4" />
                    Upcoming meals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {todaysMeals.filter(m => m.status === "pending").slice(0, 3).map(meal => (
                    <div key={meal.id} className="flex items-center justify-between text-footnote">
                      <span className="mr-2 truncate font-medium text-foreground">{meal.name}</span>
                      <Badge variant="outline" className="shrink-0">{meal.time}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Quick actions */}
            <Card>
              <CardContent className="space-y-1.5 py-4">
                <Button variant="ghost" className="w-full justify-start gap-2.5 text-footnote text-foreground-secondary" onClick={() => navigate("/patient/meal-logging")}>
                  <ChefHat className="h-4 w-4" /> Meal logging & feedback
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2.5 text-footnote text-foreground-secondary" onClick={() => navigate("/patient/consult-doctor")}>
                  <User className="h-4 w-4" /> Consult doctor
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2.5 text-footnote text-foreground-secondary" onClick={() => navigate("/patient/lifestyle-tracker")}>
                  <Heart className="h-4 w-4" /> Tracker
                </Button>
                {/* PCOD/PCOS patients have no maternal health check; their
                    cycle and skin logs are what their diet plan is built
                    from, so they belong in reach from the dashboard. */}
                {healthTracks?.includes("pcos") && (
                  <>
                    <Button variant="ghost" className="w-full justify-start gap-2.5 text-footnote text-foreground-secondary" onClick={() => navigate("/patient/period-tracker")}>
                      <Calendar className="h-4 w-4" /> Period & weight tracker
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-2.5 text-footnote text-foreground-secondary" onClick={() => navigate("/patient/skin-tracker")}>
                      <Sparkles className="h-4 w-4" /> Skin & acne
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── MY PLANS TAB ── */}
      {activeTab === "plan" && (
        <div className="space-y-3">
          {allPlans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
                  <Calendar className="h-7 w-7 text-primary" />
                </div>
                <div className="max-w-sm space-y-1.5">
                  <h3 className="text-headline text-foreground">No diet plans yet</h3>
                  <p className="text-footnote text-foreground-secondary">
                    Create one using filters, or check back once your doctor assigns one.
                  </p>
                </div>
                <Button onClick={() => setActiveTab("create")}>
                  <Filter className="mr-2 h-4 w-4" /> Create plan
                </Button>
              </CardContent>
            </Card>
          ) : (
            allPlans.map(plan => {
              const isActive = activePlan?.id === plan.id;
              const createdDate = new Date(plan.createdAt);
              return (
                <Card
                  key={plan.id}
                  className={`transition-all duration-200 ease-ios ${isActive ? "ring-1 ring-primary/40" : ""}`}
                >
                  <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-subhead font-semibold text-foreground">
                          {plan.source === "patient-self-service" ? "Self-created plan" : plan.source === "personalized-diet-chart" ? "Doctor's plan" : plan.planType || "Diet plan"}
                        </h3>
                        {isActive && (
                          <Badge className="bg-accent-soft text-accent-soft-foreground">Active</Badge>
                        )}
                        {plan.source === "personalized-diet-chart" && (
                          <Badge variant="outline">Doctor assigned</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-footnote text-foreground-secondary">
                        {plan.totalMeals} meals · {plan.planDuration} · Created {createdDate.toLocaleDateString()}
                      </p>
                      {plan.patientName && (
                        <p className="text-caption1 text-foreground-tertiary">For {plan.patientName}</p>
                      )}
                    </div>
                    {!isActive && (
                      <Button
                        size="sm"
                        className="h-10 w-full sm:h-9 sm:w-auto"
                        onClick={() => {
                          setActivePlan(plan);
                          setActiveTab("today");
                          toast.success("Plan activated");
                        }}
                      >
                        Activate
                      </Button>
                    )}
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
          <Card className="lg:col-span-1 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-subhead font-semibold">
                <Filter className="h-4 w-4 text-primary" /> Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Region */}
              <div>
                <Label className="text-caption1 font-medium text-foreground-secondary">Cuisine / region</Label>
                <Select value={filters.region} onValueChange={v => setFilters(p => ({ ...p, region: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Any region" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any region</SelectItem>
                    {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Diet type */}
              <div>
                <Label className="text-caption1 font-medium text-foreground-secondary">Diet type</Label>
                <Select value={filters.dietType} onValueChange={v => setFilters(p => ({ ...p, dietType: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Any diet" /></SelectTrigger>
                  <SelectContent>
                    {DIET_TYPES.map(d => <SelectItem key={d.value || "any"} value={d.value || "any"}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Calories */}
              <div>
                <Label className="text-caption1 font-medium text-foreground-secondary">
                  Calories per meal: <span className="text-foreground">{filters.minCalories}–{filters.maxCalories} kcal</span>
                </Label>
                <div className="mt-3 px-1">
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
                <Label className="text-caption1 font-medium text-foreground-secondary">
                  Protein per meal: <span className="text-foreground">{filters.minProtein}–{filters.maxProtein}g</span>
                </Label>
                <div className="mt-3 px-1">
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
                <Label className="text-caption1 font-medium text-foreground-secondary">Cook time</Label>
                <Select value={filters.cookTime} onValueChange={v => setFilters(p => ({ ...p, cookTime: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="quick">Quick (&lt; 30 min)</SelectItem>
                    <SelectItem value="medium">Medium (30–60 min)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Exclude ingredients */}
              <div>
                <Label className="text-caption1 font-medium text-foreground-secondary">Exclude ingredients</Label>
                <Input
                  className="mt-1.5"
                  placeholder="e.g. peanut, shellfish"
                  value={filters.excludeIngredients}
                  onChange={e => setFilters(p => ({ ...p, excludeIngredients: e.target.value }))}
                />
                <p className="mt-1 text-caption2 text-foreground-tertiary">Comma-separated</p>
              </div>

              {/* Pre-fill from profile allergies */}
              {profile?.allergies && profile.allergies.length > 0 && !filters.excludeIngredients && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-caption1"
                  onClick={() => setFilters(p => ({ ...p, excludeIngredients: profile!.allergies!.join(",") }))}
                >
                  <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
                  Auto-fill my allergies ({profile.allergies.join(", ")})
                </Button>
              )}

              <Button className="w-full" onClick={generatePlan} disabled={generating}>
                {generating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Generate meal plan</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Generated meals */}
          <div className="lg:col-span-2 space-y-4">
            {generatedMeals.length === 0 && !generating ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
                    <Sparkles className="h-7 w-7 text-primary" />
                  </div>
                  <div className="max-w-sm space-y-1">
                    <h3 className="text-headline text-foreground">Set your filters and generate</h3>
                    <p className="text-footnote text-foreground-secondary">
                      We'll find recipes from 118,000+ options matching your preferences.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : generating ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <div className="space-y-1">
                    <p className="text-footnote text-foreground">Finding the best recipes for you…</p>
                    <p className="text-caption1 text-foreground-tertiary">This may take a few seconds</p>
                  </div>
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
                          <div className="flex items-start gap-3.5">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                              <SlotIcon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <Badge variant="outline" className="mb-1">
                                {meal.type.charAt(0).toUpperCase() + meal.type.slice(1)} · {meal.time}
                              </Badge>
                              <h3 className="text-subhead font-semibold text-foreground">{meal.name}</h3>
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption1 text-foreground-secondary">
                                <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3 text-pitta" />{meal.calories} cal</span>
                                <span className="inline-flex items-center gap-1"><Drumstick className="h-3 w-3 text-primary" />{meal.protein}g protein</span>
                                <span className="inline-flex items-center gap-1"><Wheat className="h-3 w-3 text-kapha" />{meal.carbs}g carbs</span>
                                <span className="inline-flex items-center gap-1"><Droplets className="h-3 w-3 text-vata" />{meal.fat}g fat</span>
                              </div>
                              {(meal.region || meal.cookTime) && (
                                <p className="mt-1 text-caption1 text-foreground-tertiary">
                                  {meal.region && `${meal.region}`}
                                  {meal.region && meal.cookTime && " · "}
                                  {meal.cookTime && `${meal.cookTime} min`}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-10 w-10 shrink-0 p-0 text-foreground-tertiary sm:h-8 sm:w-8"
                            onClick={() => {
                              const newMeals = [...generatedMeals];
                              newMeals.splice(idx, 1);
                              setGeneratedMeals(newMeals);
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="h-11 flex-1 sm:h-10"
                    onClick={saveGeneratedPlan}
                    disabled={savingPlan || generatedMeals.length === 0}
                  >
                    {savingPlan ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                    ) : (
                      <><Save className="mr-2 h-4 w-4" /> Save & activate plan</>
                    )}
                  </Button>
                  <Button variant="outline" className="h-11 sm:h-10" onClick={() => { setGeneratedMeals([]); }}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Reset
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
              <CardTitle className="text-subhead font-semibold">Last 7 days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3.5">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - i);
                  const key = d.toISOString().split("T")[0];
                  const data = trackingHistory[key];
                  const pct = data ? Math.round((data.eaten / data.total) * 100) : 0;
                  const dayLabel = i === 0 ? "Today" : i === 1 ? "Yesterday" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-caption1 text-foreground-secondary">{dayLabel}</span>
                      <div className="flex-1">
                        <Progress value={pct} className="h-2" />
                      </div>
                      <span className="w-10 shrink-0 text-right text-caption1 font-medium text-foreground">
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
            {/* Headline stat dominates; the rest are a supporting row */}
            <Card>
              <CardContent className="py-6">
                <p className="text-caption1 uppercase tracking-wide text-foreground-tertiary">Today's completion</p>
                <span className="mt-1 block text-large-title text-primary">{todayStats.completionPct}%</span>

                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 sm:gap-3">
                  <div className="min-w-0">
                    <div className="text-title3 text-foreground">{todayStats.caloriesConsumed}</div>
                    <p className="mt-0.5 truncate text-caption1 text-foreground-secondary">Calories today</p>
                  </div>
                  <div className="min-w-0">
                    <div className="text-title3 text-foreground">{todayStats.proteinConsumed}g</div>
                    <p className="mt-0.5 truncate text-caption1 text-foreground-secondary">Protein today</p>
                  </div>
                  <div className="min-w-0">
                    <div className="text-title3 text-foreground">{allPlans.length}</div>
                    <p className="mt-0.5 truncate text-caption1 text-foreground-secondary">Total plans</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Weekly avg */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-subhead font-semibold">Weekly average</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const days = Object.values(trackingHistory);
                  const avgPct = days.length > 0 ? Math.round(days.reduce((s, d) => s + (d.eaten / d.total) * 100, 0) / days.length) : 0;
                  const avgCal = days.length > 0 ? Math.round(days.reduce((s, d) => s + d.calories, 0) / days.length) : 0;
                  return (
                    <div className="space-y-4">
                      <div>
                        <div className="mb-1.5 flex justify-between text-footnote text-foreground-secondary">
                          <span>Avg completion</span>
                          <span className="font-semibold text-foreground">{avgPct}%</span>
                        </div>
                        <Progress value={avgPct} className="h-2" />
                      </div>
                      <div className="flex justify-between text-footnote text-foreground-secondary">
                        <span>Avg calories / day</span>
                        <span className="font-semibold text-foreground">{avgCal} kcal</span>
                      </div>
                      <div className="flex justify-between text-footnote text-foreground-secondary">
                        <span>Days tracked</span>
                        <span className="font-semibold text-foreground">{days.length} / 7</span>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200"
          onClick={() => setViewingRecipe(null)}
        >
          <Card
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-title3">{viewingRecipe.recipe.Recipe_title}</CardTitle>
                <Button variant="ghost" size="sm" className="h-10 w-10 shrink-0 p-0 text-foreground-tertiary sm:h-8 sm:w-8" onClick={() => setViewingRecipe(null)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-accent-soft px-3 py-2.5">
                  <span className="block text-caption1 text-foreground-secondary">Calories</span>
                  <span className="text-subhead font-semibold text-foreground">{viewingRecipe.recipe.Calories || viewingRecipe.recipe["Energy (kcal)"] || "N/A"}</span>
                </div>
                <div className="rounded-xl bg-accent-soft px-3 py-2.5">
                  <span className="block text-caption1 text-foreground-secondary">Protein</span>
                  <span className="text-subhead font-semibold text-foreground">{viewingRecipe.recipe["Protein (g)"] || "N/A"}g</span>
                </div>
                <div className="rounded-xl bg-accent-soft px-3 py-2.5">
                  <span className="block text-caption1 text-foreground-secondary">Region</span>
                  <span className="text-subhead font-semibold text-foreground">{viewingRecipe.recipe.Region || "Global"}</span>
                </div>
                <div className="rounded-xl bg-accent-soft px-3 py-2.5">
                  <span className="block text-caption1 text-foreground-secondary">Cook time</span>
                  <span className="text-subhead font-semibold text-foreground">{viewingRecipe.recipe.cook_time || viewingRecipe.recipe.total_time || "N/A"} min</span>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-footnote font-semibold text-foreground">Instructions</h4>
                <div className="whitespace-pre-line rounded-xl bg-muted/50 p-3.5 text-footnote text-foreground-secondary">
                  {viewingRecipe.instructions}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading recipe overlay */}
      {loadingRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-footnote text-foreground">Loading recipe details…</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDashboard;
