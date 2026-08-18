// The plan hub — your plans and the logging you do against them.
//
// This merges what used to be "My Plans", "Create Plan" and "Progress" (three
// tabs inside the old dashboard, wedged next to the daily checklist) with the
// Meal Logging page. Logging is the work here, so it gets the room: the plan
// list is a narrow rail on the left that answers "which plan am I on?" and
// then gets out of the way, and the rest of the width belongs to today's
// meals — tap one to read how it's prepared, mark it eaten, skipped or
// pending, and rate how it made you feel, all without leaving the row.
//
// What the old Meal Logging page lost in the move was only the parts that
// duplicated something else: a patient-ID search box (she is signed in), a
// second plan picker, and a recipe lookup backed by three hardcoded strings
// where the real recipe API was already a click away.

import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Calendar,
  Filter,
  TrendingUp,
  Refrigerator,
  ChefHat,
  Utensils,
  Clock,
  Activity,
  Heart,
  Zap,
  Loader2,
  Save,
  Sparkles,
  RefreshCw,
  XCircle,
  AlertCircle,
  Eye,
  Flame,
  Drumstick,
  Wheat,
  Droplets,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { useDietPlan } from "@/context/DietPlanContext";
import { useRecipeViewer } from "@/components/patient/RecipeViewer";
import { PantryPanel } from "@/components/patient/PantryPanel";
import { supabase } from "@/lib/supabase";
import { isPreviewMode } from "@/lib/previewMode";
import {
  DEFAULT_FILTERS,
  DIET_TYPES,
  REGIONS,
  dayKey,
  describePlanSource,
  recipeToMeal,
  slotFor,
  type DietPlanDoc,
  type MealStatus,
  type PlanFilters,
  type TrackedMeal,
} from "@/lib/dietPlan";
import {
  getRecipesByCalories,
  getRecipesByCuisine,
  getRecipesByDiet,
  getRecipesByIngredientsCategoriesTitle,
  type RecipeBasic,
} from "@/services/foodoscopeApi";

type HubTab = "plans" | "create" | "progress" | "kitchen";

const TABS: { id: HubTab; label: string; shortLabel: string; icon: typeof Calendar }[] = [
  { id: "plans", label: "My Plans", shortLabel: "Plans", icon: Calendar },
  { id: "create", label: "Create Plan", shortLabel: "Create", icon: Filter },
  { id: "progress", label: "Progress", shortLabel: "Progress", icon: TrendingUp },
  { id: "kitchen", label: "My Kitchen", shortLabel: "Kitchen", icon: Refrigerator },
];

const isHubTab = (v: string | null): v is HubTab =>
  TABS.some((t) => t.id === v);

const RATING_EMOJI = {
  digestion: ["😰", "😕", "😐", "😊", "😄"],
  mood: ["😢", "😟", "😐", "🙂", "😊"],
  energy: ["😴", "🥱", "😐", "⚡", "🚀"],
} as const;

/** One 1–5 slider with its emoji, as used for digestion, mood and energy. */
function FeelingSlider({
  label,
  icon: Icon,
  kind,
  value,
  onChange,
  low,
  high,
}: {
  label: string;
  icon: typeof Heart;
  kind: keyof typeof RATING_EMOJI;
  value: number;
  onChange: (v: number) => void;
  low: string;
  high: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-footnote font-medium text-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {label}
        </span>
        <span className="text-2xl">{RATING_EMOJI[kind][value - 1] ?? "😐"}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={1} max={5} step={1} />
      <div className="flex justify-between text-caption1 text-foreground-tertiary">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: MealStatus }) {
  if (status === "eaten") return <CheckCircle className="h-5 w-5 text-success" />;
  if (status === "skipped") return <XCircle className="h-5 w-5 text-foreground-tertiary" />;
  return <Clock className="h-5 w-5 text-warning" />;
}

/** The card tint that carries a meal's status without reading the icon. */
function statusTone(status: MealStatus): string {
  if (status === "eaten") return "bg-accent-soft/60 border-accent-soft";
  if (status === "skipped") return "bg-muted border-border";
  return "bg-warning/5 border-warning/20";
}

/** The macro strip shown under a meal name, in a plan preview or a draft. */
function Macros({ meal }: { meal: TrackedMeal }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption1 text-foreground-secondary">
      <span className="inline-flex items-center gap-1">
        <Flame className="h-3 w-3 text-foreground-tertiary" />
        {meal.calories} cal
      </span>
      <span className="inline-flex items-center gap-1">
        <Drumstick className="h-3 w-3 text-foreground-tertiary" />
        {meal.protein}g protein
      </span>
      <span className="inline-flex items-center gap-1">
        <Wheat className="h-3 w-3 text-foreground-tertiary" />
        {meal.carbs}g carbs
      </span>
      <span className="inline-flex items-center gap-1">
        <Droplets className="h-3 w-3 text-foreground-tertiary" />
        {meal.fat}g fat
      </span>
    </div>
  );
}

const PlanHub = () => {
  const { user } = useApp();
  const {
    plans,
    activePlan,
    loadingPlans,
    activatePlan,
    addPlan,
    todaysMeals,
    todayStats,
    updateMealStatus,
    trackingHistory,
  } = useDietPlan();
  const recipe = useRecipeViewer();

  // The tab lives in the URL so a link from Today can land on the right panel
  // instead of always opening on Plans.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: HubTab = isHubTab(tabParam) ? tabParam : "plans";
  const setActiveTab = useCallback(
    (tab: HubTab) => {
      setSearchParams(tab === "plans" ? {} : { tab }, { replace: true });
    },
    [setSearchParams]
  );

  // Meal logging: which meal is open, and the feedback being written about it.
  // The ratings reset per meal — carrying yesterday's slider positions into
  // the next meal would quietly submit numbers she never chose.
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [digestion, setDigestion] = useState(3);
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);

  const selectMeal = useCallback((mealId: string) => {
    setSelectedMealId((current) => (current === mealId ? null : mealId));
    setDigestion(3);
    setMood(3);
    setEnergy(3);
    setFeedbackNotes("");
  }, []);

  const saveFeedback = useCallback(
    async (meal: TrackedMeal) => {
      if (!user?.id) return;
      setSavingFeedback(true);
      try {
        const { error } = await supabase.from("meal_feedback").insert({
          patient_id: user.id,
          patient_name: user.name || "Patient",
          meal_id: meal.id,
          meal_name: meal.name,
          digestion_rating: digestion,
          mood_rating: mood,
          energy_rating: energy,
          notes: feedbackNotes,
          date: dayKey(),
        });
        if (error) throw error;
        toast.success("Feedback saved — thank you for sharing how you feel");
        setFeedbackNotes("");
      } catch (e) {
        console.error("Error saving feedback:", e);
        toast.error("Failed to save feedback. Please try again.");
      } finally {
        setSavingFeedback(false);
      }
    },
    [user?.id, user?.name, digestion, mood, energy, feedbackNotes]
  );

  // Create-plan state
  const [filters, setFilters] = useState<PlanFilters>(DEFAULT_FILTERS);
  const [generatedMeals, setGeneratedMeals] = useState<TrackedMeal[]>([]);
  const [generating, setGenerating] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  // Allergies drive the "exclude ingredients" pre-fill; read from the same row
  // Today reads her profile from.
  const [allergies, setAllergies] = useState<string[]>([]);
  useEffect(() => {
    if (!user?.id || isPreviewMode()) return;
    let cancelled = false;
    void supabase
      .from("patients")
      .select("allergies, assessment_data")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const assessment = (data?.assessment_data as Record<string, any>) || {};
        setAllergies(assessment.allergies || data?.allergies || []);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const generatePlan = useCallback(async () => {
    setGenerating(true);
    setGeneratedMeals([]);

    try {
      const wanted = filters.mealTypes.length > 0 ? filters.mealTypes : DEFAULT_FILTERS.mealTypes;
      const drafted: TrackedMeal[] = [];

      for (const mealType of wanted) {
        let recipes: RecipeBasic[] = [];

        // Strategy 1: the combined filter endpoint, which honours the
        // exclusions. Each fallback below widens the net rather than failing.
        try {
          const params: any = { limit: 10, page: Math.floor(Math.random() * 3) + 1 };
          if (filters.excludeIngredients) params.excludeIngredients = filters.excludeIngredients;
          if (mealType === "breakfast") params.title = "breakfast";
          else if (mealType === "lunch") params.title = "rice,curry,dal,lunch";
          else if (mealType === "dinner") params.title = "dinner,soup,stew";
          else params.title = "snack,salad,smoothie";
          recipes = await getRecipesByIngredientsCategoriesTitle(params);
        } catch {
          /* fall through */
        }

        if (recipes.length === 0 && filters.region) {
          try {
            const res = await getRecipesByCuisine(filters.region, Math.floor(Math.random() * 3) + 1, 10);
            recipes = res.data || [];
          } catch {
            /* fall through */
          }
        }

        if (recipes.length === 0 && filters.dietType) {
          try {
            const res = await getRecipesByDiet(filters.dietType, 10, Math.floor(Math.random() * 3) + 1);
            recipes = res.data || [];
          } catch {
            /* fall through */
          }
        }

        if (recipes.length === 0) {
          try {
            const res = await getRecipesByCalories(
              filters.minCalories,
              filters.maxCalories,
              10,
              Math.floor(Math.random() * 5) + 1
            );
            recipes = res.data || [];
          } catch {
            /* fall through */
          }
        }

        if (recipes.length === 0) continue;

        // Narrow client-side, but never down to nothing: each filter is only
        // applied when it still leaves something to choose from.
        let filtered = recipes;

        if (filters.dietType) {
          const byDiet = filtered.filter((r) => (r as any)[filters.dietType] === "1");
          if (byDiet.length > 0) filtered = byDiet;
        }

        const byCalories = filtered.filter((r) => {
          const cal = Number(r.Calories || r["Energy (kcal)"] || 0);
          return cal >= filters.minCalories * 0.5 && cal <= filters.maxCalories * 2;
        });
        if (byCalories.length > 0) filtered = byCalories;

        if (filters.minProtein > 0 || filters.maxProtein < 40) {
          const byProtein = filtered.filter((r) => {
            const p = Number(r["Protein (g)"] || 0);
            return p >= filters.minProtein && p <= filters.maxProtein;
          });
          if (byProtein.length > 0) filtered = byProtein;
        }

        if (filters.cookTime !== "any") {
          const maxMins = filters.cookTime === "quick" ? 30 : 60;
          const byTime = filtered.filter((r) => {
            const t = parseInt(r.cook_time || r.total_time?.toString() || "0");
            return t > 0 && t <= maxMins;
          });
          if (byTime.length > 0) filtered = byTime;
        }

        const pick = filtered[Math.floor(Math.random() * filtered.length)];
        drafted.push(recipeToMeal(pick, mealType as TrackedMeal["type"]));

        // The recipe API rate-limits; space the calls out.
        await new Promise((r) => setTimeout(r, 1500));
      }

      if (drafted.length === 0) {
        toast.error("No recipes found matching your filters. Try adjusting them.");
      } else {
        setGeneratedMeals(drafted);
        toast.success(`Found ${drafted.length} meals for your plan!`);
      }
    } catch (e) {
      console.error("Generate error:", e);
      toast.error("Error generating plan. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [filters]);

  const saveGeneratedPlan = useCallback(async () => {
    if (!user?.id || generatedMeals.length === 0) return;
    setSavingPlan(true);
    try {
      const slotFoods = (type: TrackedMeal["type"]) =>
        generatedMeals
          .filter((m) => m.type === type)
          .map((m) => ({
            Food_Item: m.name,
            Calories: String(m.calories),
            Protein: String(m.protein),
            Carbs: String(m.carbs),
            Fat: String(m.fat),
            Region: m.region,
            cook_time: m.cookTime,
            Recipe_id: m.recipeId,
          }));

      const planData = {
        patient_id: user.id,
        patient_name: user.name || "Patient",
        plan_duration: "Daily",
        plan_type: "self-created",
        source: "patient-self-service",
        active_filter: "Daily",
        total_meals: generatedMeals.length,
        filters: { ...filters },
        meals: {
          Daily: {
            Breakfast: slotFoods("breakfast"),
            Lunch: slotFoods("lunch"),
            Snack: slotFoods("snack"),
            Dinner: slotFoods("dinner"),
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

      // Saving activates it, so the Plans tab opens on the plan just made —
      // and Today is already following it without a reload.
      addPlan(newPlan);
      setGeneratedMeals([]);
      setActiveTab("plans");
      toast.success("Plan saved — you're following it from today.");
    } catch (e) {
      console.error("Save error:", e);
      toast.error("Failed to save plan");
    } finally {
      setSavingPlan(false);
    }
  }, [user?.id, user?.name, generatedMeals, filters, addPlan, setActiveTab]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-title2 text-foreground">Your plan</h1>
        <p className="mt-1 text-footnote text-foreground-secondary">
          Log today's meals and how they made you feel, switch between your
          plans, build a new one, see how the week went, and keep your kitchen
          list up to date.
        </p>
      </div>

      {/* Sub-tabs. Each carries a short label stacked under its icon on a
          phone — four bare icons gave no way to tell "Plans" from "Create". */}
      <div className="rounded-2xl border border-border bg-card p-1 shadow-xs">
        <div className="flex gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                variant={selected ? "default" : "ghost"}
                className={`h-auto flex-1 flex-col gap-1 px-1 py-2 sm:h-10 sm:flex-row sm:gap-2 sm:px-4 sm:py-2 ${
                  selected ? "" : "text-foreground-secondary"
                }`}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-caption2 sm:hidden">{tab.shortLabel}</span>
                <span className="hidden truncate sm:inline sm:text-sm">{tab.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* ── MY PLANS + MEAL LOGGING ──
          The plan list is a narrow rail, not a full-width tab of its own: it
          answers "which plan am I on?" in a glance and then gets out of the
          way. The space it used to take goes to logging, which is the thing
          you actually do here — pick a meal, read how it should be prepared,
          say whether you ate it, and rate how it felt. */}
      {activeTab === "plans" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
          {/* Plans rail */}
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-subhead font-semibold text-foreground">Your plans</h2>
              <span className="text-caption1 tabular-nums text-foreground-tertiary">
                {plans.length}
              </span>
            </div>

            {loadingPlans && plans.length === 0 ? (
              <Card>
                <CardContent className="flex items-center gap-2.5 py-6 text-caption1 text-foreground-secondary">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Loading…
                </CardContent>
              </Card>
            ) : plans.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-caption1 text-foreground-secondary">
                    No plans yet. Create one, or wait for your doctor to assign one.
                  </p>
                  <Button size="sm" onClick={() => setActiveTab("create")}>
                    <Filter className="mr-1.5 h-3.5 w-3.5" /> Create plan
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {plans.map((plan) => {
                  const isActive = activePlan?.id === plan.id;
                  return (
                    <button
                      key={plan.id}
                      onClick={() => {
                        if (isActive) return;
                        activatePlan(plan);
                        setSelectedMealId(null);
                        toast.success("You're following this plan now.");
                      }}
                      className={`w-full rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 ease-ios ${
                        isActive
                          ? "border-primary/40 bg-accent-soft/50 ring-1 ring-primary/25"
                          : "border-border bg-card hover:border-primary/25 hover:bg-accent-soft/25"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-footnote font-semibold text-foreground">
                          {describePlanSource(plan)}
                        </p>
                        {isActive && (
                          <Badge className="shrink-0 bg-primary text-caption2 text-primary-foreground">
                            Following
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-caption1 text-foreground-secondary">
                        {plan.totalMeals} meals · {plan.planDuration}
                      </p>
                      <p className="text-caption2 text-foreground-tertiary">
                        {new Date(plan.createdAt).toLocaleDateString()}
                        {plan.source === "personalized-diet-chart" && " · Doctor assigned"}
                      </p>
                    </button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setActiveTab("create")}
                >
                  <Filter className="mr-1.5 h-3.5 w-3.5" /> Create another plan
                </Button>
              </>
            )}
          </div>

          {/* Meal logging for the plan she is following */}
          <div className="space-y-4">
            {!activePlan ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
                    <ChefHat className="h-7 w-7 text-primary" />
                  </div>
                  <div className="max-w-sm space-y-1">
                    <h3 className="text-headline text-foreground">No plan selected</h3>
                    <p className="text-footnote text-foreground-secondary">
                      Pick a plan on the left and today's meals will show up here to log.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Today at a glance for this plan */}
                <Card>
                  <CardContent className="py-5">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
                      <div>
                        <div className="text-caption1 text-foreground-secondary">Today's meals</div>
                        <div className="mt-0.5 text-title2 tabular-nums text-foreground">
                          {todayStats.total}
                        </div>
                      </div>
                      <div>
                        <div className="text-caption1 text-foreground-secondary">Eaten</div>
                        <div className="mt-0.5 text-title2 tabular-nums text-primary">
                          {todayStats.eaten}
                        </div>
                      </div>
                      <div>
                        <div className="text-caption1 text-foreground-secondary">Still pending</div>
                        <div className="mt-0.5 text-title2 tabular-nums text-foreground">
                          {todayStats.pending}
                        </div>
                      </div>
                      <div>
                        <div className="text-caption1 text-foreground-secondary">Calories eaten</div>
                        <div className="mt-0.5 text-title2 tabular-nums text-foreground">
                          {todayStats.caloriesConsumed}
                        </div>
                      </div>
                    </div>
                    <Progress value={todayStats.completionPct} className="mt-4 h-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-headline">
                      <ChefHat className="h-5 w-5 text-primary" />
                      Today's meals
                    </CardTitle>
                    <CardDescription>
                      {todaysMeals.length > 0
                        ? "Tap a meal to see how it's prepared, log it, and rate how it felt."
                        : "This plan has no meals scheduled for today."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {todaysMeals.length === 0 ? (
                      <div className="flex flex-col items-center py-12 text-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-primary">
                          <Utensils className="h-6 w-6" />
                        </span>
                        <p className="mt-4 text-subhead font-medium text-foreground">
                          Nothing scheduled today
                        </p>
                        <p className="mt-1.5 max-w-xs text-footnote text-foreground-secondary">
                          Try another plan, or create one that covers today.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {todaysMeals.map((meal) => {
                          const SlotIcon = slotFor(meal.type).icon;
                          const isSelected = selectedMealId === meal.id;
                          return (
                            <div
                              key={meal.id}
                              className={`cursor-pointer rounded-xl border p-4 transition-colors duration-200 ease-ios ${statusTone(
                                meal.status
                              )} ${isSelected ? "ring-2 ring-primary" : ""}`}
                              onClick={() => selectMeal(meal.id)}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-primary">
                                    <SlotIcon className="h-4 w-4" />
                                  </span>
                                  <div className="min-w-0">
                                    <h3 className="truncate text-subhead font-medium text-foreground">
                                      {meal.name}
                                    </h3>
                                    <p className="text-footnote text-foreground-secondary">
                                      {meal.time} · {meal.calories} cal
                                    </p>
                                    {meal.doshaBalance && (
                                      <Badge variant="outline" className="mt-1.5 text-caption2">
                                        {meal.doshaBalance}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <span className="shrink-0">
                                  <StatusIcon status={meal.status} />
                                </span>
                              </div>

                              {/* Meal detail — preparation, benefits, the three
                                  status buttons, and the feedback form for
                                  this meal. All of it in place, so rating a
                                  meal never means finding it again in a
                                  second list. */}
                              {isSelected && (
                                <div
                                  className="mt-3.5 space-y-3 border-t border-border/60 pt-3.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Macros meal={meal} />

                                  {meal.quantity && (
                                    <p className="text-footnote text-foreground-secondary">
                                      <span className="font-medium text-foreground">Quantity:</span>{" "}
                                      {meal.quantity}
                                    </p>
                                  )}
                                  {meal.preparation && (
                                    <p className="text-footnote text-foreground-secondary">
                                      <span className="font-medium text-foreground">
                                        Preparation:
                                      </span>{" "}
                                      {meal.preparation}
                                    </p>
                                  )}
                                  {meal.benefits && (
                                    <p className="text-footnote text-foreground-secondary">
                                      <span className="font-medium text-foreground">Benefits:</span>{" "}
                                      {meal.benefits}
                                    </p>
                                  )}

                                  <div className="grid grid-cols-3 gap-2">
                                    <Button
                                      size="sm"
                                      variant={meal.status === "eaten" ? "default" : "outline"}
                                      className="h-10 gap-1.5"
                                      onClick={() => updateMealStatus(meal.id, "eaten")}
                                    >
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      Eaten
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={meal.status === "skipped" ? "secondary" : "outline"}
                                      className="h-10 gap-1.5"
                                      onClick={() => updateMealStatus(meal.id, "skipped")}
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                      Skip
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={meal.status === "pending" ? "secondary" : "outline"}
                                      className="h-10 gap-1.5"
                                      onClick={() => updateMealStatus(meal.id, "pending")}
                                    >
                                      <Clock className="h-3.5 w-3.5" />
                                      Pending
                                    </Button>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {meal.recipeId && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="gap-1.5 text-caption1 text-foreground-secondary"
                                        disabled={recipe.loading}
                                        onClick={() => recipe.open(meal.recipeId)}
                                      >
                                        <Eye className="h-3.5 w-3.5" /> Full recipe
                                      </Button>
                                    )}
                                  </div>

                                  {/* Post-meal feedback — available on any
                                      meal you've selected, the way it was on
                                      the old Meal Logging page. */}
                                  <div className="space-y-5 rounded-xl border border-border bg-background/60 p-4">
                                    <div>
                                      <p className="text-footnote font-medium text-foreground">
                                        How did it make you feel?
                                      </p>
                                      <p className="text-caption1 text-foreground-tertiary">
                                        Your doctor sees these ratings alongside the plan.
                                      </p>
                                    </div>

                                    <FeelingSlider
                                      label="Digestion"
                                      icon={Activity}
                                      kind="digestion"
                                      value={digestion}
                                      onChange={setDigestion}
                                      low="Poor"
                                      high="Excellent"
                                    />
                                    <FeelingSlider
                                      label="Mood"
                                      icon={Heart}
                                      kind="mood"
                                      value={mood}
                                      onChange={setMood}
                                      low="Low"
                                      high="High"
                                    />
                                    <FeelingSlider
                                      label="Energy"
                                      icon={Zap}
                                      kind="energy"
                                      value={energy}
                                      onChange={setEnergy}
                                      low="Tired"
                                      high="Energetic"
                                    />

                                    <Textarea
                                      rows={3}
                                      placeholder="Anything else about how this meal made you feel…"
                                      value={feedbackNotes}
                                      onChange={(e) => setFeedbackNotes(e.target.value)}
                                    />

                                    <Button
                                      className="w-full"
                                      disabled={savingFeedback}
                                      onClick={() => saveFeedback(meal)}
                                    >
                                      {savingFeedback ? (
                                        <>
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                                        </>
                                      ) : (
                                        "Save feedback"
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CREATE PLAN ── */}
      {activeTab === "create" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="h-fit lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-subhead font-semibold">
                <Filter className="h-4 w-4 text-primary" /> Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-caption1 font-medium text-foreground-secondary">
                  Cuisine / region
                </Label>
                <Select
                  value={filters.region}
                  onValueChange={(v) => setFilters((p) => ({ ...p, region: v === "any" ? "" : v }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Any region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any region</SelectItem>
                    {REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-caption1 font-medium text-foreground-secondary">
                  Diet type
                </Label>
                <Select
                  value={filters.dietType}
                  onValueChange={(v) =>
                    setFilters((p) => ({ ...p, dietType: v === "any" ? "" : v }))
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Any diet" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIET_TYPES.map((d) => (
                      <SelectItem key={d.value || "any"} value={d.value || "any"}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-caption1 font-medium text-foreground-secondary">
                  Calories per meal:{" "}
                  <span className="text-foreground">
                    {filters.minCalories}–{filters.maxCalories} kcal
                  </span>
                </Label>
                <div className="mt-3 px-1">
                  <Slider
                    value={[filters.minCalories, filters.maxCalories]}
                    onValueChange={([min, max]) =>
                      setFilters((p) => ({ ...p, minCalories: min, maxCalories: max }))
                    }
                    min={50}
                    max={1200}
                    step={50}
                  />
                </div>
              </div>

              <div>
                <Label className="text-caption1 font-medium text-foreground-secondary">
                  Protein per meal:{" "}
                  <span className="text-foreground">
                    {filters.minProtein}–{filters.maxProtein}g
                  </span>
                </Label>
                <div className="mt-3 px-1">
                  <Slider
                    value={[filters.minProtein, filters.maxProtein]}
                    onValueChange={([min, max]) =>
                      setFilters((p) => ({ ...p, minProtein: min, maxProtein: max }))
                    }
                    min={0}
                    max={80}
                    step={5}
                  />
                </div>
              </div>

              <div>
                <Label className="text-caption1 font-medium text-foreground-secondary">
                  Cook time
                </Label>
                <Select
                  value={filters.cookTime}
                  onValueChange={(v) => setFilters((p) => ({ ...p, cookTime: v }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="quick">Quick (&lt; 30 min)</SelectItem>
                    <SelectItem value="medium">Medium (30–60 min)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-caption1 font-medium text-foreground-secondary">
                  Exclude ingredients
                </Label>
                <Input
                  className="mt-1.5"
                  placeholder="e.g. peanut, shellfish"
                  value={filters.excludeIngredients}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, excludeIngredients: e.target.value }))
                  }
                />
                <p className="mt-1 text-caption2 text-foreground-tertiary">Comma-separated</p>
              </div>

              {allergies.length > 0 && !filters.excludeIngredients && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-caption1"
                  onClick={() =>
                    setFilters((p) => ({ ...p, excludeIngredients: allergies.join(",") }))
                  }
                >
                  <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
                  Auto-fill my allergies ({allergies.join(", ")})
                </Button>
              )}

              <Button className="w-full" onClick={generatePlan} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> Generate meal plan
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4 lg:col-span-2">
            {generating ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <div className="space-y-1">
                    <p className="text-footnote text-foreground">
                      Finding the best recipes for you…
                    </p>
                    <p className="text-caption1 text-foreground-tertiary">
                      This may take a few seconds
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : generatedMeals.length === 0 ? (
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
            ) : (
              <>
                {generatedMeals.map((meal, idx) => {
                  const SlotIcon = slotFor(meal.type).icon;
                  return (
                    <Card key={`${meal.id}_${idx}`}>
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
                              <h3 className="text-subhead font-semibold text-foreground">
                                {meal.name}
                              </h3>
                              <Macros meal={meal} />
                              {(meal.region || meal.cookTime) && (
                                <p className="mt-1 text-caption1 text-foreground-tertiary">
                                  {meal.region}
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
                            title="Remove from draft"
                            onClick={() =>
                              setGeneratedMeals((prev) => prev.filter((_, i) => i !== idx))
                            }
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
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" /> Save & follow this plan
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 sm:h-10"
                    onClick={() => setGeneratedMeals([])}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Reset
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── PROGRESS ── */}
      {activeTab === "progress" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-subhead font-semibold">Last 7 days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3.5">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - i);
                  const key = dayKey(d);
                  const data = trackingHistory[key];
                  const pct = data && data.total > 0 ? Math.round((data.eaten / data.total) * 100) : 0;
                  const dayLabel =
                    i === 0
                      ? "Today"
                      : i === 1
                        ? "Yesterday"
                        : d.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          });

                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-caption1 text-foreground-secondary">
                        {dayLabel}
                      </span>
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

          <div className="space-y-4">
            {/* Headline stat dominates; the rest are a supporting row */}
            <Card>
              <CardContent className="py-6">
                <p className="text-caption1 uppercase tracking-wide text-foreground-tertiary">
                  Today's completion
                </p>
                <span className="mt-1 block text-large-title text-primary">
                  {todayStats.completionPct}%
                </span>

                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 sm:gap-3">
                  <div className="min-w-0">
                    <div className="text-title3 text-foreground">{todayStats.caloriesConsumed}</div>
                    <p className="mt-0.5 truncate text-caption1 text-foreground-secondary">
                      Calories today
                    </p>
                  </div>
                  <div className="min-w-0">
                    <div className="text-title3 text-foreground">{todayStats.proteinConsumed}g</div>
                    <p className="mt-0.5 truncate text-caption1 text-foreground-secondary">
                      Protein today
                    </p>
                  </div>
                  <div className="min-w-0">
                    <div className="text-title3 text-foreground">{plans.length}</div>
                    <p className="mt-0.5 truncate text-caption1 text-foreground-secondary">
                      Total plans
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-subhead font-semibold">Weekly average</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const days = Object.values(trackingHistory).filter((d) => d.total > 0);
                  const avgPct =
                    days.length > 0
                      ? Math.round(
                          days.reduce((s, d) => s + (d.eaten / d.total) * 100, 0) / days.length
                        )
                      : 0;
                  const avgCal =
                    days.length > 0
                      ? Math.round(days.reduce((s, d) => s + d.calories, 0) / days.length)
                      : 0;
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

            {todayStats.total > 0 && todayStats.completionPct === 100 && (
              <Card className="bg-accent-soft/50">
                <CardContent className="flex items-center gap-3 py-4">
                  <CheckCircle className="h-5 w-5 shrink-0 text-primary" />
                  <p className="text-footnote text-accent-soft-foreground">
                    Every meal logged today. That's the whole plan followed.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── MY KITCHEN ──
          The foods she has at home and the ones she needs to buy. It sits
          here rather than in its own corner of the menu because it is the
          input to a plan: the doctor builds around what she can actually
          cook, and she updates it while looking at the plan that used it. */}
      {activeTab === "kitchen" && <PantryPanel />}

      {recipe.element}
    </div>
  );
};

export default PlanHub;
