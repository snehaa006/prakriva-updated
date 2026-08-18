// "Today" — the one screen a patient opens every day.
//
// This used to be a tab inside the dashboard, sitting next to plan management
// and plan creation, which are things she does once a week at most. It is now
// its own destination, and it has absorbed the Meal Logging page: that page
// re-loaded the same plan behind a patient-ID search box, re-listed the same
// meals and re-implemented the same eaten/skipped buttons, so the only thing
// on it that Today did not already do was the post-meal feedback — which is
// now attached to the meal row it is about, instead of a form on another page
// that made you re-find the meal in a second list.

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  XCircle,
  Clock,
  ChefHat,
  Filter,
  ArrowRightLeft,
  Flame,
  Drumstick,
  Wheat,
  Droplets,
  Calendar,
  Loader2,
  Sparkles,
  Eye,
  AlertCircle,
  Heart,
  Activity,
  Zap,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Reveal } from "@/components/ui/reveal";
import { ShopSuggestions } from "@/components/shop/ShopSuggestions";
import { Plate } from "@/components/illustrations/LineArt";
import { LIFE_STAGE_ART } from "@/components/illustrations/lifeStageArt";
import { describeLifeStage, lifeStageInfo } from "@/lib/lifeStage";
import { useApp } from "@/context/AppContext";
import { useDietPlan } from "@/context/DietPlanContext";
import { useCountUp } from "@/hooks/useCountUp";
import { useCachedPageData } from "@/hooks/useCachedPageData";
import { useRecipeViewer } from "@/components/patient/RecipeViewer";
import { supabase } from "@/lib/supabase";
import { isPreviewMode } from "@/lib/previewMode";
import { PREVIEW_PROFILE } from "@/lib/previewMockData";
import {
  dayKey,
  recipeToMeal,
  slotFor,
  type TrackedMeal,
} from "@/lib/dietPlan";
import {
  getRecipesByIngredientsCategoriesTitle,
  type RecipeBasic,
} from "@/services/foodoscopeApi";

interface PatientProfile {
  name: string;
  lifeStage: string;
  pregnancyTrimester?: string;
  allergies?: string[];
}

const fetchTodayProfile = async (
  patientId: string,
  fallbackName?: string
): Promise<PatientProfile | null> => {
  if (isPreviewMode()) return PREVIEW_PROFILE as PatientProfile;

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
    allergies: assessment.allergies || data.allergies || [],
  };
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** One figure in the header strip, counted up from its previous value. */
function HeaderStat({
  value,
  label,
  accent = false,
}: {
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      {/* Tabular figures: without them a counting number changes width every
          frame and the whole strip jitters as it settles. */}
      <div className={`text-title3 tabular-nums ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
      <p className="text-caption1 text-foreground-secondary">{label}</p>
    </div>
  );
}

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
        <span className="text-xl">{RATING_EMOJI[kind][value - 1] ?? "😐"}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={1} max={5} step={1} />
      <div className="flex justify-between text-caption2 text-foreground-tertiary">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

const Today = () => {
  const navigate = useNavigate();
  const { user, healthTracks } = useApp();
  const {
    plans,
    activePlan,
    todaysMeals,
    todayStats,
    updateMealStatus,
    replaceMeal,
  } = useDietPlan();

  const recipe = useRecipeViewer();

  // Swap
  const [swappingMealId, setSwappingMealId] = useState<string | null>(null);
  const [swapOptions, setSwapOptions] = useState<RecipeBasic[]>([]);
  const [loadingSwap, setLoadingSwap] = useState(false);

  // Post-meal feedback, expanded under the meal it is about.
  const [feedbackMealId, setFeedbackMealId] = useState<string | null>(null);
  const [digestion, setDigestion] = useState(3);
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [notes, setNotes] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);

  const { data: profile, isFirstLoad: loadingProfile } = useCachedPageData(
    ["patient-today-profile", user?.id ?? null],
    () => fetchTodayProfile(user!.id, user?.name),
    { enabled: !!user?.id }
  );

  const openFeedback = useCallback((mealId: string) => {
    setFeedbackMealId((current) => (current === mealId ? null : mealId));
    setDigestion(3);
    setMood(3);
    setEnergy(3);
    setNotes("");
  }, []);

  const saveFeedback = useCallback(
    async (meal: TrackedMeal) => {
      if (!user?.id) return;
      setSavingFeedback(true);
      try {
        const { error } = await supabase.from("meal_feedback").insert({
          patient_id: user.id,
          patient_name: profile?.name || user.name || "Patient",
          meal_id: meal.id,
          meal_name: meal.name,
          digestion_rating: digestion,
          mood_rating: mood,
          energy_rating: energy,
          notes,
          date: dayKey(),
        });
        if (error) throw error;
        toast.success("Feedback saved — thank you for sharing how you feel");
        setFeedbackMealId(null);
      } catch (e) {
        console.error("Error saving feedback:", e);
        toast.error("Failed to save feedback. Please try again.");
      } finally {
        setSavingFeedback(false);
      }
    },
    [user?.id, user?.name, profile?.name, digestion, mood, energy, notes]
  );

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

      const found = await getRecipesByIngredientsCategoriesTitle(params);
      const options = (found ?? []).filter((r) => r.Recipe_id !== meal.recipeId);
      setSwapOptions(options.slice(0, 5));
      if (options.length === 0) toast.info("No alternative recipes found right now.");
    } catch {
      toast.error("Could not load swap options");
    } finally {
      setLoadingSwap(false);
    }
  }, []);

  const confirmSwap = useCallback(
    (meal: TrackedMeal, replacement: RecipeBasic) => {
      replaceMeal(meal.id, recipeToMeal(replacement, meal.type));
      setSwappingMealId(null);
      setSwapOptions([]);
      toast.success(`Swapped to "${replacement.Recipe_title}"`);
    },
    [replaceMeal]
  );

  const lifeStage = profile?.lifeStage || "not_applicable";
  const stageInfo = lifeStageInfo(lifeStage);
  const StageArt = LIFE_STAGE_ART[stageInfo.art];

  // Declared above the loading early-return so hook order never changes.
  const completionCount = useCountUp(todayStats.completionPct);
  const caloriesCount = useCountUp(todayStats.caloriesConsumed);
  const eatenCount = useCountUp(todayStats.eaten);

  if (loadingProfile) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-footnote text-foreground-secondary">Loading your day…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ──
          The avatar is the mark for her life stage — the one piece of her
          record that changes what this whole page recommends. */}
      <Reveal className="flex flex-col justify-between gap-5 rounded-xl border border-border bg-card p-5 shadow-xs sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary">
            <StageArt delay={200} className="h-9 w-9" />
          </span>
          <div>
            <h1 className="text-title2 text-foreground">
              {getGreeting()}, {(profile?.name || "there").split(" ")[0]}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge className={`gap-1 ${stageInfo.badgeClass}`}>
                {describeLifeStage(lifeStage, profile?.pregnancyTrimester)}
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

        {todaysMeals.length > 0 && (
          <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-5">
            <HeaderStat value={`${completionCount}%`} label="Today" accent />
            <div className="h-8 w-px bg-border" />
            <HeaderStat value={caloriesCount} label="Cal eaten" />
            <div className="h-8 w-px bg-border" />
            <HeaderStat value={`${eatenCount}/${todayStats.total}`} label="Meals" />
          </div>
        )}
      </Reveal>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {todaysMeals.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <Plate className="h-20 w-20 text-primary/70" />
                <div className="max-w-sm space-y-1.5">
                  <h3 className="text-headline text-foreground">No diet plan active yet</h3>
                  <p className="text-footnote text-foreground-secondary">
                    {plans.length > 0
                      ? "Pick one of your plans to follow, or put together a new one."
                      : "Let's put together your first diet plan — it only takes a couple of filters."}
                  </p>
                </div>
                <Button onClick={() => navigate(plans.length > 0 ? "/patient/plans" : "/patient/plans?tab=create")}>
                  <Filter className="mr-2 h-4 w-4" />
                  {plans.length > 0 ? "Choose a plan" : "Create diet plan"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Today's progress — the number that dominates this page */}
              <Card>
                <CardContent className="py-6">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-caption1 uppercase tracking-wide text-foreground-tertiary">
                        Today's progress
                      </p>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-large-title text-primary">
                          {todayStats.completionPct}%
                        </span>
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
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground-tertiary/50" />{" "}
                      {todayStats.pending} pending
                    </span>
                  </div>
                  {activePlan && (
                    <p className="mt-3 border-t border-border pt-3 text-caption1 text-foreground-tertiary">
                      Following{" "}
                      <button
                        className="font-medium text-primary underline underline-offset-2"
                        onClick={() => navigate("/patient/plans")}
                      >
                        {activePlan.source === "personalized-diet-chart"
                          ? "your doctor's plan"
                          : "your plan"}
                      </button>{" "}
                      · {activePlan.planDuration}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Today's meals — one list, divided, rather than five identical
                  floating cards. */}
              <Card className="divide-y divide-border overflow-hidden">
                <div className="flex items-baseline justify-between px-6 pb-3 pt-5">
                  <h2 className="text-subhead font-semibold text-foreground">Today's meals</h2>
                  <span className="text-caption1 tabular-nums text-foreground-secondary">
                    {todayStats.eaten} of {todayStats.total} logged
                  </span>
                </div>
                {todaysMeals.map((meal, mealIndex) => {
                  const SlotIcon = slotFor(meal.type).icon;
                  const isEaten = meal.status === "eaten";
                  const isSkipped = meal.status === "skipped";
                  const showFeedback = feedbackMealId === meal.id;
                  return (
                    <Reveal
                      key={meal.id}
                      /* Only the first few rows stagger — by row six the wait
                         is longer than the animation is worth. */
                      index={Math.min(mealIndex, 5)}
                      delay={120}
                      className={`transition-colors duration-200 ease-ios ${
                        isEaten ? "bg-accent-soft/40" : isSkipped ? "bg-muted/40" : ""
                      }`}
                    >
                      <div className="px-6 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div className="flex min-w-0 flex-1 items-start gap-3.5">
                            <div
                              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                                isEaten ? "bg-primary text-primary-foreground" : "bg-accent-soft text-primary"
                              }`}
                            >
                              <SlotIcon className="h-4.5 w-4.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="truncate text-subhead font-semibold text-foreground">
                                  {meal.name}
                                </h3>
                                {isEaten && <CheckCircle className="h-4 w-4 shrink-0 text-success" />}
                                {isSkipped && <XCircle className="h-4 w-4 shrink-0 text-foreground-tertiary" />}
                              </div>
                              <p className="mt-0.5 text-caption1 text-foreground-secondary">
                                {meal.time} · {meal.type.charAt(0).toUpperCase() + meal.type.slice(1)}
                                {meal.dayLabel && ` · ${meal.dayLabel}`}
                              </p>
                              {/* Macro icons stay in one quiet tone: the label
                                  next to each already names the macro, and the
                                  saturated version borrowed the dosha colours,
                                  which mean vata/pitta/kapha and nothing else. */}
                              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption1 text-foreground-secondary">
                                <span className="flex items-center gap-1">
                                  <Flame className="h-3 w-3 text-foreground-tertiary" />
                                  {meal.calories} cal
                                </span>
                                <span className="flex items-center gap-1">
                                  <Drumstick className="h-3 w-3 text-foreground-tertiary" />
                                  {meal.protein}g protein
                                </span>
                                <span className="flex items-center gap-1">
                                  <Wheat className="h-3 w-3 text-foreground-tertiary" />
                                  {meal.carbs}g carbs
                                </span>
                                <span className="flex items-center gap-1">
                                  <Droplets className="h-3 w-3 text-foreground-tertiary" />
                                  {meal.fat}g fat
                                </span>
                              </div>

                              {/* Ayurvedic detail from a doctor-authored plan.
                                  The old Meal Logging page hid this behind a
                                  tap; it is short enough to simply show. */}
                              {(meal.quantity || meal.preparation || meal.doshaBalance) && (
                                <div className="mt-2 space-y-0.5 text-caption1 text-foreground-tertiary">
                                  {meal.doshaBalance && (
                                    <Badge variant="outline" className="mr-1 text-caption2">
                                      {meal.doshaBalance}
                                    </Badge>
                                  )}
                                  {meal.quantity && <p>Quantity: {meal.quantity}</p>}
                                  {meal.preparation && <p>{meal.preparation}</p>}
                                </div>
                              )}
                            </div>
                          </div>

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
                              {/* Feedback is offered once the meal has actually
                                  been eaten — there is nothing to rate about a
                                  meal she has not had yet. */}
                              {isEaten && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className={`h-10 gap-1 px-2 text-caption1 sm:h-7 ${
                                    showFeedback ? "text-primary" : "text-foreground-tertiary"
                                  }`}
                                  onClick={() => openFeedback(meal.id)}
                                  title="How did it feel?"
                                >
                                  <Heart className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">How did it feel?</span>
                                </Button>
                              )}
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
                                  onClick={() => recipe.open(meal.recipeId)}
                                  disabled={recipe.loading}
                                  title="View recipe"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Post-meal feedback, in place */}
                        {showFeedback && (
                          <div className="mt-4 space-y-5 rounded-xl border border-border bg-background/60 p-4">
                            <p className="text-caption1 font-medium text-foreground-secondary">
                              How did “{meal.name}” make you feel?
                            </p>
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
                              rows={2}
                              placeholder="Anything else about how this meal made you feel…"
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1"
                                disabled={savingFeedback}
                                onClick={() => saveFeedback(meal)}
                              >
                                {savingFeedback ? (
                                  <>
                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Saving…
                                  </>
                                ) : (
                                  "Save feedback"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-foreground-secondary"
                                onClick={() => setFeedbackMealId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Swap options */}
                        {swappingMealId === meal.id && (
                          <div className="mt-4 border-t border-border pt-4">
                            <p className="mb-2 text-caption1 font-medium text-foreground-secondary">
                              Swap with
                            </p>
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
                                {swapOptions.map((opt) => (
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
                              onClick={() => {
                                setSwappingMealId(null);
                                setSwapOptions([]);
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    </Reveal>
                  );
                })}
              </Card>
            </>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-subhead font-semibold">Nutrition summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground-secondary">
                    <Flame className="h-4 w-4 text-foreground-tertiary" />
                    <span className="text-footnote">Calories</span>
                  </div>
                  <span className="text-footnote font-semibold text-foreground">
                    {todayStats.caloriesConsumed} / {todayStats.totalCalories}
                  </span>
                </div>
                <Progress
                  value={
                    todayStats.totalCalories > 0
                      ? (todayStats.caloriesConsumed / todayStats.totalCalories) * 100
                      : 0
                  }
                  className="mt-2 h-2"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground-secondary">
                  <Drumstick className="h-4 w-4 text-foreground-tertiary" />
                  <span className="text-footnote">Protein</span>
                </div>
                <span className="text-footnote font-semibold text-foreground">
                  {todayStats.proteinConsumed}g
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-subhead font-semibold">
                <StageArt animate={false} className="h-4 w-4 text-primary" />
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

          {/* Things she may need to buy for this stage. Sits below the
              nutrition tips deliberately — this page is for her day, and
              shopping is a side door off it, not the point of it. */}
          <ShopSuggestions />

          {todayStats.pending > 0 && (
            <Card className="bg-accent-soft/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-subhead font-semibold text-accent-soft-foreground">
                  <Clock className="h-4 w-4" />
                  Upcoming meals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {todaysMeals
                  .filter((m) => m.status === "pending")
                  .slice(0, 3)
                  .map((meal) => (
                    <div key={meal.id} className="flex items-center justify-between text-footnote">
                      <span className="mr-2 truncate font-medium text-foreground">{meal.name}</span>
                      <Badge variant="outline" className="shrink-0">
                        {meal.time}
                      </Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-1.5 py-4">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2.5 text-footnote text-foreground-secondary"
                onClick={() => navigate("/patient/plans")}
              >
                <ChefHat className="h-4 w-4" /> Plans, progress & kitchen
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2.5 text-footnote text-foreground-secondary"
                onClick={() => navigate("/patient/consult-doctor")}
              >
                <User className="h-4 w-4" /> Consult doctor
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2.5 text-footnote text-foreground-secondary"
                onClick={() => navigate("/patient/tracker")}
              >
                <Heart className="h-4 w-4" /> Tracker
              </Button>
              {/* PCOD/PCOS patients have no maternal health check; their cycle
                  and skin logs are what their diet plan is built from, so they
                  belong in reach from here. */}
              {healthTracks?.includes("pcos") && (
                <>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2.5 text-footnote text-foreground-secondary"
                    onClick={() => navigate("/patient/period-tracker")}
                  >
                    <Calendar className="h-4 w-4" /> Period & weight tracker
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2.5 text-footnote text-foreground-secondary"
                    onClick={() => navigate("/patient/skin-tracker")}
                  >
                    <Sparkles className="h-4 w-4" /> Skin & acne
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {recipe.element}
    </div>
  );
};

export default Today;
