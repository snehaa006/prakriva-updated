// The plan hub — everything about *managing* a diet plan, in one place.
//
// This merges four surfaces that used to be scattered: "My Plans", "Create
// Plan" and "Progress" (three tabs inside the old dashboard, wedged next to
// the daily meal checklist) and "My Kitchen" (a separate page filed under
// "More"). They belong together: you look at your plans, make a new one when
// none fit, check how the week went, and keep the kitchen list the plans are
// built from. The daily checklist — the thing you open every day — moved out
// to its own "Today" tab instead of competing with all of this.
//
// The Plans tab answers "which plan am I on?" by showing every plan with the
// current one opened in place, so choosing and reviewing are the same view
// rather than two.

import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
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
    trackingHistory,
  } = useDietPlan();
  const recipe = useRecipeViewer();

  // The tab lives in the URL so "My Kitchen" in the menu, and a link from
  // Today, can land on the right panel instead of always opening on Plans.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: HubTab = isHubTab(tabParam) ? tabParam : "plans";
  const setActiveTab = useCallback(
    (tab: HubTab) => {
      setSearchParams(tab === "plans" ? {} : { tab }, { replace: true });
    },
    [setSearchParams]
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
          Choose what you're following, build a new plan, see how the week went,
          and keep your kitchen list up to date.
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

      {/* ── MY PLANS ── */}
      {activeTab === "plans" && (
        <div className="space-y-3">
          {loadingPlans && plans.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center gap-3 py-16 text-footnote text-foreground-secondary">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Loading your plans…
              </CardContent>
            </Card>
          ) : plans.length === 0 ? (
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
            plans.map((plan) => {
              const isActive = activePlan?.id === plan.id;
              // The plan you are following opens in place, so picking a plan
              // and reading it are one view rather than two screens. The rows
              // come from the same live list Today renders — not a second
              // derivation of the stored plan — so a meal swapped on Today
              // shows here as the meal she actually has, and each row carries
              // the status she gave it.
              const preview = isActive ? todaysMeals : [];
              return (
                <Card
                  key={plan.id}
                  className={`transition-all duration-200 ease-ios ${
                    isActive ? "ring-1 ring-primary/40" : ""
                  }`}
                >
                  <CardContent className="py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-subhead font-semibold text-foreground">
                            {describePlanSource(plan)}
                          </h3>
                          {isActive && (
                            <Badge className="bg-accent-soft text-accent-soft-foreground">
                              Following
                            </Badge>
                          )}
                          {plan.source === "personalized-diet-chart" && (
                            <Badge variant="outline">Doctor assigned</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-footnote text-foreground-secondary">
                          {plan.totalMeals} meals · {plan.planDuration} · Created{" "}
                          {new Date(plan.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {!isActive && (
                        <Button
                          size="sm"
                          className="h-10 w-full sm:h-9 sm:w-auto"
                          onClick={() => {
                            activatePlan(plan);
                            toast.success("You're following this plan now.");
                          }}
                        >
                          Follow this plan
                        </Button>
                      )}
                    </div>

                    {isActive && (
                      <div className="mt-4 border-t border-border pt-4">
                        <div className="flex items-baseline justify-between">
                          <h4 className="text-caption1 font-medium uppercase tracking-wide text-foreground-tertiary">
                            Today from this plan
                          </h4>
                          <span className="text-caption1 tabular-nums text-foreground-secondary">
                            {todayStats.eaten} of {todayStats.total} logged
                          </span>
                        </div>

                        {preview.length === 0 ? (
                          <p className="mt-3 text-footnote text-foreground-secondary">
                            This plan has no meals scheduled for today.
                          </p>
                        ) : (
                          <ul className="mt-3 divide-y divide-border">
                            {preview.map((meal) => {
                              const SlotIcon = slotFor(meal.type).icon;
                              return (
                                <li
                                  key={meal.id}
                                  className="flex items-start justify-between gap-3 py-2.5"
                                >
                                  <div className="flex min-w-0 items-start gap-3">
                                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary">
                                      <SlotIcon className="h-3.5 w-3.5" />
                                    </span>
                                    <div className="min-w-0">
                                      <p className="truncate text-footnote font-medium text-foreground">
                                        {meal.name}
                                      </p>
                                      <p className="text-caption1 text-foreground-tertiary">
                                        {meal.time} ·{" "}
                                        {meal.type.charAt(0).toUpperCase() + meal.type.slice(1)}
                                        {meal.status !== "pending" && ` · ${meal.status}`}
                                      </p>
                                    </div>
                                  </div>
                                  {meal.recipeId && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 shrink-0 p-0 text-foreground-tertiary"
                                      onClick={() => recipe.open(meal.recipeId)}
                                      disabled={recipe.loading}
                                      title="View recipe"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        <p className="mt-3 text-caption1 text-foreground-tertiary">
                          Mark these eaten or skipped on the{" "}
                          <Link
                            to="/patient/today"
                            className="font-medium text-primary underline underline-offset-2"
                          >
                            Today
                          </Link>{" "}
                          tab.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
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

      {/* ── MY KITCHEN ── */}
      {activeTab === "kitchen" && <PantryPanel />}

      {recipe.element}
    </div>
  );
};

export default PlanHub;
