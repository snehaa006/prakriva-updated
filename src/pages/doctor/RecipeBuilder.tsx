import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useFoodContext } from "@/context/FoodContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  FileEdit,
  AlertCircle,
  Loader2,
  User,
  Target,
  Heart,
  Baby,
  Activity,
  Apple,
  AlertTriangle,
  XCircle,
  BookOpen,
  CircleDot,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { PatientPicker } from "@/components/patients/PatientPicker";
import { useDoctorPatients } from "@/hooks/useDoctorPatients";
import type { DoctorPatient } from "@/hooks/useDoctorPatients";
import { usePersistentState } from "@/hooks/usePersistentState";
import { CACHE_KEYS } from "@/lib/localCache";
import {
  generateDietChart,
  determinePrimaryDosha,
  getNutritionalTargets,
  buildExcludeIngredients,
  buildIncludeIngredients,
  DOSHA_FOOD_PREFERENCES,
  type PatientProfile,
  type GeneratedDietChart,
  type LifeStage,
  type DietChartContext,
} from "@/services/dietChartService";
import { fetchPantryItems, type PantryItem } from "@/services/pantryService";
import { fetchScreenings } from "@/services/diseaseDetectionService";
import type { RiskLevel, StoredScreening } from "@/types/diseaseDetection";
import { RISK_STYLES } from "@/lib/riskLevels";

const mealSlots = ["Breakfast", "Lunch", "Dinner", "Snack"];
const weekDays = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

function emptyMealPlans() {
  return {
    Daily: { Breakfast: [], Lunch: [], Dinner: [], Snack: [] },
    Weekly: weekDays.reduce((acc, day) => {
      acc[day] = { Breakfast: [], Lunch: [], Dinner: [], Snack: [] };
      return acc;
    }, {} as Record<string, Record<string, unknown[]>>),
  };
}

/** Flatten a doctor's patient record into the profile the generator expects. */
function toPatientProfile(patient: DoctorPatient): PatientProfile {
  const raw = patient.profile;
  const assessment = (raw.assessmentData || {}) as Record<string, unknown>;
  const merged = { ...raw, ...assessment };

  return {
    name: (merged.name as string) || patient.name,
    gender: (merged.gender as string) || "",
    dob: (merged.dob as string) || (merged.dateOfBirth as string) || "",
    lifeStage: ((merged.lifeStage as string) as LifeStage) || "not_applicable",
    pregnancyTrimester: (merged.pregnancyTrimester as string) || "",
    isBreastfeeding: (merged.isBreastfeeding as string) || "",
    menopauseStage: (merged.menopauseStage as string) || "",
    allergies: Array.isArray(merged.allergies) ? (merged.allergies as string[]) : [],
    allergiesOther: (merged.allergiesOther as string) || "",
    foodAvoidances: (merged.foodAvoidances as string) || "",
    dietaryPreferences:
      (merged.dietaryPreferences as string) || (merged.dietaryPreference as string) || "",
    currentConditions: Array.isArray(merged.currentConditions)
      ? (merged.currentConditions as string[])
      : [],
    healthGoals: Array.isArray(merged.healthGoals) ? (merged.healthGoals as string[]) : [],
    bodyFrame: (merged.bodyFrame as string) || "",
    skinType: (merged.skinType as string) || "",
    hairType: (merged.hairType as string) || "",
    appetitePattern: (merged.appetitePattern as string) || "",
    personalityTraits: Array.isArray(merged.personalityTraits)
      ? (merged.personalityTraits as string[])
      : [],
    weatherPreference: (merged.weatherPreference as string) || "",
    digestionIssues: Array.isArray(merged.digestionIssues)
      ? (merged.digestionIssues as string[])
      : [],
    energyLevels: Number(merged.energyLevels) || 3,
    stressLevels: Number(merged.stressLevels) || 3,
    physicalActivity: (merged.physicalActivity as string) || "",
    sleepDuration: (merged.sleepDuration as string) || "",
  };
}

// A generated chart's meal type maps onto one of the four drag-and-drop slots.
const mealTypeToSlot: Record<string, string> = {
  breakfast: "Breakfast",
  mid_morning: "Snack",
  lunch: "Lunch",
  afternoon_snack: "Snack",
  dinner: "Dinner",
};

// Board food-list slots. Palette items and generated/saved items don't share
// one shape, so this stays a loose `any[]` like `mealPlans` itself does.
type SlotFoods = { Breakfast: any[]; Lunch: any[]; Dinner: any[]; Snack: any[] };

/** Turn a freshly generated chart's days[] into the board's { Daily, Weekly } shape. */
function chartToMealPlans(chart: GeneratedDietChart) {
  const newWeekly: Record<string, Record<string, unknown[]>> = {};
  weekDays.forEach((day) => {
    newWeekly[day] = { Breakfast: [], Lunch: [], Dinner: [], Snack: [] };
  });

  const allFoodsForDaily: SlotFoods = {
    Breakfast: [],
    Lunch: [],
    Dinner: [],
    Snack: [],
  };

  for (const day of chart.days) {
    const dayName = day.dayLabel;
    if (!newWeekly[dayName]) continue;

    for (const meal of day.meals) {
      const slot = mealTypeToSlot[meal.mealType] || "Snack";
      const recipe = meal.recipe;
      const foodItem = {
        Food_Item: recipe.Recipe_title || "Unknown Recipe",
        Calories: String(recipe.Calories ?? meal.actualCalories ?? 0),
        Protein: String(recipe["Protein (g)"] ?? 0),
        Fat: String(recipe["Total lipid (fat) (g)"] ?? 0),
        Carbs: String(recipe["Carbohydrate, by difference (g)"] ?? 0),
        Region: recipe.Region || "",
        cook_time: recipe.cook_time || "",
        Recipe_id: recipe.Recipe_id || recipe._id || "",
        mealType: meal.mealType,
        label: meal.label,
        time: meal.time,
      };

      newWeekly[dayName][slot].push(foodItem);
      if (day.dayNumber === 1) allFoodsForDaily[slot].push(foodItem);
    }
  }

  return { Daily: allFoodsForDaily, Weekly: newWeekly };
}

// A saved draft's days[] (patient_id, dayLabel, meals[].recipeName/…) is a
// flatter, already-serialized shape than a freshly generated chart's
// days[].meals[].recipe — same idea, different field names.
function chartToMealPlansFromSavedDays(days: any[]) {
  const newWeekly: Record<string, Record<string, unknown[]>> = {};
  weekDays.forEach((day) => {
    newWeekly[day] = { Breakfast: [], Lunch: [], Dinner: [], Snack: [] };
  });

  const allFoodsForDaily: SlotFoods = {
    Breakfast: [],
    Lunch: [],
    Dinner: [],
    Snack: [],
  };

  for (const day of days) {
    const dayName = day.dayLabel;
    if (!newWeekly[dayName]) continue;

    for (const meal of day.meals || []) {
      const slot = mealTypeToSlot[meal.mealType] || "Snack";
      const foodItem = {
        Food_Item: meal.recipeName || "Unknown Recipe",
        Calories: String(meal.calories || meal.actualCalories || 0),
        Protein: String(meal.protein || 0),
        Fat: String(meal.fat || 0),
        Carbs: String(meal.carbs || 0),
        Region: meal.region || "",
        cook_time: meal.cookTime || "",
        Recipe_id: meal.recipeId || "",
        mealType: meal.mealType,
        label: meal.label,
        time: meal.time,
      };

      newWeekly[dayName][slot].push(foodItem);
      if (day.dayNumber === 1) allFoodsForDaily[slot].push(foodItem);
    }
  }

  return { Daily: allFoodsForDaily, Weekly: newWeekly };
}

const DoshaRadial: React.FC<{
  scores: { vata: number; pitta: number; kapha: number };
  primary: string;
}> = ({ scores, primary }) => {
  const total = scores.vata + scores.pitta + scores.kapha || 1;
  const doshaInfo: Record<string, { bgColor: string; label: string }> = {
    vata: { bgColor: "bgplum-500", label: "Vata" },
    pitta: { bgColor: "bg-rose-500", label: "Pitta" },
    kapha: { bgColor: "bgrose-500", label: "Kapha" },
  };

  return (
    <div className="space-y-3">
      {(["vata", "pitta", "kapha"] as const).map((d) => {
        const pct = Math.round((scores[d] / total) * 100);
        const info = doshaInfo[d];
        return (
          <div key={d} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${info.bgColor}`} />
                <span className={`text-sm font-medium ${d === primary ? "text-gray-900" : "text-gray-500"}`}>
                  {info.label}
                </span>
                {d === primary && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white bg-gray-800 px-1.5 py-0.5 rounded">
                    Primary
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${info.bgColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const RecipeBuilder = () => {
  const [searchParams] = useSearchParams();

  const { selectedFoods } = useFoodContext();

  // Track selected filter
  const [activeFilter, setActiveFilter] = usePersistentState(
    CACHE_KEYS.recipeBuilderDraft + ":filter",
    "Daily"
  );

  // Patient + save form state. `patientId` is the patients.id UUID that
  // diet_plans keys on; `patientCode` is the P001-style code shown to the
  // doctor. One picker drives both the profile analysis below and what gets
  // saved.
  const [patientId, setPatientId] = usePersistentState(
    CACHE_KEYS.recipeBuilderDraft + ":patientId",
    ""
  );
  const [patientCode, setPatientCode] = usePersistentState(
    CACHE_KEYS.recipeBuilderDraft + ":patientCode",
    ""
  );
  const [patientName, setPatientName] = usePersistentState(
    CACHE_KEYS.recipeBuilderDraft + ":patientName",
    ""
  );
  const [planDuration, setPlanDuration] = usePersistentState(
    CACHE_KEYS.recipeBuilderDraft + ":duration",
    "7 days"
  );
  const [planType, setPlanType] = usePersistentState(
    CACHE_KEYS.recipeBuilderDraft + ":planType",
    "weight-management"
  );
  const [saving, setSaving] = useState(false);

  // The doctor's own patients, for the picker and profile lookups.
  const { patients: doctorPatients } = useDoctorPatients();

  // Fill in the display code/name once the patient list arrives — the id may
  // come from a cached draft or from the ?patientId= link out of the Diet
  // Chart viewer, neither of which carries the P001 code.
  useEffect(() => {
    if (!patientId || doctorPatients.length === 0) return;
    const match = doctorPatients.find((patient) => patient.id === patientId);
    if (!match) return;
    setPatientCode((current) => current || match.code);
    setPatientName((current) => current || match.name);
  }, [patientId, doctorPatients, setPatientCode, setPatientName]);

  // The full dosha/assessment profile for whoever is selected — everything
  // "Personalized Diet Chart" used to show lives off this.
  const patientProfile = useMemo<PatientProfile | null>(() => {
    if (!patientId || doctorPatients.length === 0) return null;
    const match = doctorPatients.find((patient) => patient.id === patientId);
    return match ? toPatientProfile(match) : null;
  }, [patientId, doctorPatients]);

  // The two extra sources the AI generator plans around: what the patient
  // actually has in her kitchen, and what her disease screenings found. Both
  // are optional — a patient with neither still gets a chart, just one built
  // from the dosha and life-stage rules alone.
  const { data: pantryItems = [] } = useQuery<PantryItem[]>({
    queryKey: ["recipe-builder-pantry", patientId],
    queryFn: () => fetchPantryItems(patientId),
    enabled: !!patientId,
    // The doctor can't edit it from here, so a stale read costs nothing.
    staleTime: 5 * 60_000,
  });

  const { data: screenings = [] } = useQuery<StoredScreening[]>({
    queryKey: ["recipe-builder-screenings", patientId],
    queryFn: () => fetchScreenings(patientId),
    enabled: !!patientId,
    staleTime: 5 * 60_000,
  });

  /** The pantry and screening payload the generator sends to the backend. */
  const generationContext = useMemo<DietChartContext>(() => {
    const toEntries = (availability: PantryItem["availability"]) =>
      pantryItems
        .filter((item) => item.availability === availability)
        .map((item) => ({
          name: item.foodName,
          quantity: item.quantity,
          category: item.category,
        }));

    return {
      pantry: { atHome: toEntries("at_home"), toBuy: toEntries("to_buy") },
      // Only the risk picture is needed; `result` carries it and the raw
      // measurements stay on the screening page where they belong.
      screenings: screenings.map((screening) => ({
        createdAt: screening.createdAt,
        result: screening.result,
      })),
    };
  }, [pantryItems, screenings]);

  const pantryAtHomeCount = useMemo(
    () => pantryItems.filter((item) => item.availability === "at_home").length,
    [pantryItems]
  );

  /** The most recent screening's flagged conditions, for the context banner. */
  const flaggedConditions = useMemo(() => {
    const latest = screenings[0];
    if (!latest) return [];
    return (latest.result?.conditions ?? [])
      .filter((condition) => condition.risk_level !== "low")
      .map((condition) => ({
        label: condition.label,
        level: condition.risk_level as RiskLevel,
      }));
  }, [screenings]);

  const [numDays, setNumDays] = useState(7);
  const [isGenerating, setIsGenerating] = useState(false);

  // Draft/generation provenance. `editingDraftId` is set only when re-opening
  // an already-saved plan (e.g. from the Diet Chart viewer's Edit button);
  // `planMeta` carries the dosha/target metadata to preserve on save either
  // way — from that saved row, or from a chart generated fresh in this
  // session.
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [planMeta, setPlanMeta] = useState<Record<string, unknown> | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);

  // Meal plans. Cached in localStorage: a half-built plan is real work and must
  // survive a page refresh or an accidental navigation.
  const [mealPlans, setMealPlans] = usePersistentState(
    CACHE_KEYS.recipeBuilderDraft + ":meals",
    emptyMealPlans()
  );

  // Palette
  const [paletteFoods, setPaletteFoods] = useState([...selectedFoods]);

  // --- Patient selection (restricted to this doctor's own patients) ---
  const handlePatientSelect = useCallback(
    (patient: DoctorPatient | null) => {
      setPatientId(patient?.id ?? "");
      setPatientCode(patient?.code ?? "");
      setPatientName(patient?.name ?? "");
      // A meal plan is patient-specific — switching patients starts a fresh board.
      setMealPlans(emptyMealPlans());
      setActiveFilter("Daily");
      setEditingDraftId(null);
      setPlanMeta(null);
    },
    [setPatientId, setPatientCode, setPatientName, setMealPlans, setActiveFilter]
  );

  // --- Load an existing saved plan for editing (Diet Chart viewer's Edit button) ---
  useEffect(() => {
    const editPlanId = searchParams.get("editPlanId");
    const editPatientId = searchParams.get("patientId");

    if (!editPlanId || !editPatientId) return;

    const loadDraft = async () => {
      setIsLoadingDraft(true);
      try {
        const { data: row, error } = await supabase
          .from("diet_plans")
          .select("*")
          .eq("id", editPlanId)
          .eq("patient_id", editPatientId)
          .maybeSingle();

        if (error || !row) {
          toast.error("Draft plan not found.");
          setIsLoadingDraft(false);
          return;
        }

        // The day-by-day body lives in meals.days.
        const planData: any = {
          patientId: row.patient_id,
          patientName: row.patient_name,
          planDuration: row.plan_duration,
          primaryDosha: row.primary_dosha,
          doshaScores: row.dosha_scores,
          lifeStage: row.life_stage,
          lifeStageLabel: row.life_stage_label,
          nutritionalTargets: row.nutritional_targets,
          doshaRecommendations: row.dosha_recommendations,
          medicalNotes: row.medical_notes,
          excludedIngredients: row.excluded_ingredients,
          source: row.source,
          generatedAt: row.generated_at,
          days: (row.meals as any)?.days,
        };

        // Populate form fields
        setPatientId(planData.patientId || editPatientId);
        setPatientName(planData.patientName || "");
        setPlanDuration(planData.planDuration || "7 days");
        setPlanType("personalized-diet-chart");
        setEditingDraftId(editPlanId);
        setPlanMeta({
          primaryDosha: planData.primaryDosha,
          doshaScores: planData.doshaScores,
          lifeStage: planData.lifeStage,
          lifeStageLabel: planData.lifeStageLabel,
          nutritionalTargets: planData.nutritionalTargets,
          doshaRecommendations: planData.doshaRecommendations,
          medicalNotes: planData.medicalNotes,
          excludedIngredients: planData.excludedIngredients,
          source: planData.source,
          generatedAt: planData.generatedAt,
        });

        if (planData.days && Array.isArray(planData.days)) {
          // Already the rich days[] shape — reuse the same conversion path
          // generation uses, just sourced from the saved row instead.
          const { Daily, Weekly } = chartToMealPlansFromSavedDays(planData.days);
          setMealPlans({ Daily, Weekly });
        } else {
          toast.info("Draft loaded but no meal rows could be extracted.");
        }

        setActiveFilter("Weekly");
        toast.success(`Draft loaded: ${planData.patientName}'s diet plan. Drag & drop to edit.`);
      } catch (err) {
        console.error("Error loading draft plan:", err);
        toast.error("Failed to load draft plan.");
      } finally {
        setIsLoadingDraft(false);
      }
    };

    loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // --- Generate: fills the same board a manual drag would ---
  const handleGenerate = useCallback(async () => {
    if (!patientProfile) { toast.error("Select a patient first"); return; }
    if (!patientProfile.bodyFrame || !patientProfile.skinType) {
      toast.error("Patient assessment incomplete. Body frame and skin type are required.");
      return;
    }
    setIsGenerating(true);
    try {
      const chart = await generateDietChart(patientProfile, numDays, generationContext);
      const { Daily, Weekly } = chartToMealPlans(chart);
      setMealPlans({ Daily, Weekly });
      setActiveFilter("Weekly");
      setEditingDraftId(null);
      setPlanMeta({
        primaryDosha: chart.primaryDosha,
        doshaScores: chart.doshaScores,
        lifeStage: chart.lifeStage,
        lifeStageLabel: chart.lifeStageLabel,
        nutritionalTargets: chart.nutritionalTargets,
        doshaRecommendations: chart.doshaRecommendations,
        medicalNotes: chart.medicalNotes,
        excludedIngredients: chart.excludedIngredients,
        source: chart.source,
        clinicalFocus: chart.clinicalFocus,
        pantryGaps: chart.pantryGaps,
        summary: chart.summary,
        generatedAt: chart.generatedAt,
      });
      setPlanDuration(`${numDays} days`);

      // Which generator ran matters to the doctor: a fallback chart knows
      // nothing about the kitchen or the screening, so say so rather than let
      // it pass for the personalised one.
      toast.success(
        chart.source === "gemini"
          ? `${chart.days.length}-day plan generated (${chart.primaryDosha.toUpperCase()} dosha, personalised to her kitchen). Drag & drop to adjust, then save.`
          : `${chart.days.length}-day plan generated from the recipe database (${chart.primaryDosha.toUpperCase()} dosha) — the AI planner was unavailable. Drag & drop to adjust, then save.`
      );

      // A dropped meal leaves a hole in the board; the doctor needs to know it
      // was removed on purpose.
      if (chart.rejectedMeals?.length) {
        toast.warning(
          `${chart.rejectedMeals.length} generated meal(s) were dropped for naming a restricted ingredient. Fill those slots by hand.`
        );
      }
    } catch (err) {
      console.error("Error generating diet chart:", err);
      toast.error("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [patientProfile, numDays, generationContext, setMealPlans, setActiveFilter, setPlanDuration]);

  const handleClearBoard = useCallback(() => {
    const wasEditingSavedDraft = !!editingDraftId;
    setEditingDraftId(null);
    setPlanMeta(null);
    setMealPlans(emptyMealPlans());
    setActiveFilter("Daily");
    if (wasEditingSavedDraft) {
      setPatientId("");
      setPatientCode("");
      setPatientName("");
      window.history.replaceState({}, "", window.location.pathname);
      toast.info("Draft editing cancelled.");
    } else {
      toast.info("Generated plan cleared.");
    }
  }, [editingDraftId, setMealPlans, setActiveFilter, setPatientId, setPatientCode, setPatientName]);

  const handleDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const updatedMealPlans = JSON.parse(JSON.stringify(mealPlans));
    const updatedPalette = [...paletteFoods];
    let draggedFood;

    // Get dragged item
    if (source.droppableId === "palette") {
      draggedFood = updatedPalette[source.index];
    } else {
      const path = source.droppableId.split("__");
      if (path[0] === "Daily") {
        draggedFood = updatedMealPlans.Daily[path[1]][source.index];
      } else if (path[0] === "Weekly") {
        draggedFood = updatedMealPlans.Weekly[path[1]][path[2]][source.index];
      }
    }

    // Remove from source
    if (source.droppableId === "palette") {
      updatedPalette.splice(source.index, 1);
    } else {
      const path = source.droppableId.split("__");
      if (path[0] === "Daily") {
        updatedMealPlans.Daily[path[1]].splice(source.index, 1);
      } else if (path[0] === "Weekly") {
        updatedMealPlans.Weekly[path[1]][path[2]].splice(source.index, 1);
      }
    }

    // Add to destination
    if (destination.droppableId === "palette") {
      updatedPalette.splice(destination.index, 0, draggedFood);
    } else {
      const path = destination.droppableId.split("__");
      if (path[0] === "Daily") {
        updatedMealPlans.Daily[path[1]].splice(destination.index, 0, draggedFood);
      } else if (path[0] === "Weekly") {
        updatedMealPlans.Weekly[path[1]][path[2]].splice(destination.index, 0, draggedFood);
      }
    }

    setMealPlans(updatedMealPlans);
    setPaletteFoods(updatedPalette);
  };

  const renderFoodCard = (food, index, draggableId) => (
    <Draggable key={draggableId} draggableId={draggableId} index={index}>
      {(provided) => (
        <div
          className="p-2 mb-2 bg-white border rounded text-sm shadow-sm cursor-grab"
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <div className="font-medium">{food.Food_Item || food.name}</div>
          <div className="text-xs text-gray-500">
            {food.Calories || food.calories} cal • {food.Protein || food.protein}g protein • {food.Fat || food.fat}g fat • {food.Carbs || food.carbs}g carbs
          </div>
        </div>
      )}
    </Draggable>
  );

  // Save the board as-is — whether it was hand-built, generated, or generated
  // then edited by hand makes no difference to how it's saved.
  const saveMealPlan = async () => {
    if (!patientId.trim() || !patientName.trim()) {
      toast.error("Select a patient first");
      return;
    }

    const hasAnyMeals =
      Object.values(mealPlans.Daily).some((foods) => foods.length > 0) ||
      Object.values(mealPlans.Weekly).some((dayMeals) =>
        Object.values(dayMeals).some((foods) => foods.length > 0)
      );

    if (!hasAnyMeals) {
      toast.error("Please add at least one meal to the plan");
      return;
    }

    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const hasProvenance = !!editingDraftId || !!planMeta;

      const dietPlanData: Record<string, unknown> = {
        // patients.id UUID — never the P001 code (uuid column + RLS check).
        patient_id: patientId.trim(),
        created_by: authData.user?.id ?? null,
        doctor_id: authData.user?.id ?? null,
        patient_name: patientName,
        plan_duration: planDuration,
        plan_type: hasProvenance ? "personalized-diet-chart" : "manual",
        meals: mealPlans,
        active_filter: activeFilter,
        source: editingDraftId
          ? "personalized-diet-chart-edited"
          : hasProvenance
          ? "personalized-diet-chart"
          : "manual",
        status: "final",
        total_meals:
          Object.values(mealPlans.Daily).flat().length +
          Object.values(mealPlans.Weekly)
            .flatMap((dayMeals) => Object.values(dayMeals))
            .flat().length,
      };

      // Preserve dosha/target metadata, whether it came from a saved draft or
      // a chart generated in this session.
      if (hasProvenance && planMeta) {
        dietPlanData.primary_dosha = planMeta.primaryDosha;
        dietPlanData.dosha_scores = planMeta.doshaScores;
        dietPlanData.life_stage = planMeta.lifeStage;
        dietPlanData.life_stage_label = planMeta.lifeStageLabel;
        dietPlanData.nutritional_targets = planMeta.nutritionalTargets;
        dietPlanData.dosha_recommendations = planMeta.doshaRecommendations;
        dietPlanData.medical_notes = planMeta.medicalNotes;
        dietPlanData.excluded_ingredients = planMeta.excludedIngredients;
        dietPlanData.original_generated_at = planMeta.generatedAt;
      }

      if (editingDraftId) {
        // Update existing draft in-place
        const { error } = await supabase
          .from("diet_plans")
          .update(dietPlanData)
          .eq("id", editingDraftId)
          .eq("patient_id", patientId.trim());
        if (error) throw error;
        toast.success("Diet plan updated and approved!");
      } else {
        const { data: inserted, error } = await supabase
          .from("diet_plans")
          .insert(dietPlanData)
          .select("id")
          .single();
        if (error) throw error;
        toast.success(`Diet plan saved successfully! ID: ${inserted.id}`);
      }
    } catch (error) {
      console.error("Error saving diet plan:", error);
      toast.error(
        `Failed to save diet plan: ${error instanceof Error ? error.message : "Please try again."}`
      );
    } finally {
      setSaving(false);
    }
  };

  // Calculate nutrition totals
  const nutritionTotals = useMemo(() => {
    const items = [];

    if (activeFilter === "Daily") {
      Object.values(mealPlans.Daily).forEach((foods) => {
        items.push(...foods);
      });
    } else if (activeFilter === "Weekly") {
      Object.values(mealPlans.Weekly).forEach((dayMeals) => {
        Object.values(dayMeals).forEach((foods) => items.push(...foods));
      });
    }

    return {
      Calories: items.reduce((acc, f) => acc + (parseFloat(f.Calories || f.calories) || 0), 0),
      Protein: items.reduce((acc, f) => acc + (parseFloat(f.Protein || f.protein) || 0), 0),
      Fat: items.reduce((acc, f) => acc + (parseFloat(f.Fat || f.fat) || 0), 0),
      Carbs: items.reduce((acc, f) => acc + (parseFloat(f.Carbs || f.carbs) || 0), 0),
    };
  }, [mealPlans, activeFilter]);

  // --- Computed dosha/target analysis for whoever is selected ---
  const profileAnalysis = patientProfile
    ? (() => {
        const dosha = determinePrimaryDosha(patientProfile);
        const targets = getNutritionalTargets(
          patientProfile.lifeStage as LifeStage,
          patientProfile.pregnancyTrimester,
          patientProfile.isBreastfeeding,
          patientProfile.menopauseStage
        );
        const excludes = buildExcludeIngredients(patientProfile);
        const includes = buildIncludeIngredients(patientProfile);
        const doshaPrefs = DOSHA_FOOD_PREFERENCES[dosha.primary] || DOSHA_FOOD_PREFERENCES["vata"];
        return { dosha, targets, excludes, includes, doshaPrefs };
      })()
    : null;

  return (
    <div className="p-6 space-y-6">
      {/* Loading Draft Overlay */}
      {isLoadingDraft && (
        <div className="fixed inset-0 bg-white/80 z-50 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin textrose-600 mx-auto" />
            <p className="text-sm font-medium text-gray-700">Loading diet plan draft...</p>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold mb-1">Recipe Builder</h1>
        <p className="text-muted-foreground">
          Choose a patient, optionally generate a personalized starting point, then drag &amp; drop to fine-tune before saving.
        </p>
      </div>

      {/* ===== PATIENT SELECTION ===== */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <CardTitle className="text-base">Patient Selection</CardTitle>
          </div>
          <CardDescription>Select a patient from your accepted consultations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md">
            <PatientPicker
              value={patientId}
              onSelect={handlePatientSelect}
              label="Patient"
              placeholder="Search your patients by name or ID…"
            />
          </div>

          {patientId && patientName && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">{patientName}</Badge>
              {patientCode && (
                <Badge variant="secondary" className="text-xs font-mono">{patientCode}</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== PATIENT PROFILE SUMMARY (what Personalized Diet Chart used to show) ===== */}
      {patientProfile && profileAnalysis && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Dosha Analysis — 4 cols */}
            <Card className="lg:col-span-4 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-gray-400" />
                    <CardTitle className="text-sm">Dosha Profile</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs font-semibold capitalize">
                    {profileAnalysis.dosha.primary}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <DoshaRadial scores={profileAnalysis.dosha.scores} primary={profileAnalysis.dosha.primary} />
                <Separator />
                <p className="text-xs text-gray-500 leading-relaxed">{profileAnalysis.doshaPrefs.description}</p>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Spices</p>
                  <div className="flex flex-wrap gap-1">
                    {profileAnalysis.doshaPrefs.spices.map((s) => (
                      <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bgcoral-50 textcoral-700 border bordercoral-100">{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Methods</p>
                  <div className="flex flex-wrap gap-1">
                    {profileAnalysis.doshaPrefs.cookingMethods.map((m) => (
                      <span key={m} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{m}</span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Guidelines — 4 cols */}
            <Card className="lg:col-span-4 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {patientProfile.lifeStage === "pregnancy" ? <Baby className="w-4 h-4 text-gray-400" />
                      : patientProfile.lifeStage === "menopause" ? <Activity className="w-4 h-4 text-gray-400" />
                      : <Heart className="w-4 h-4 text-gray-400" />}
                    <CardTitle className="text-sm">Nutritional Targets</CardTitle>
                  </div>
                  <Badge className="bg-pink-50 text-pink-700 border border-pink-200 text-[10px]">
                    {profileAnalysis.targets.calories.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {[
                    { label: "Calories", value: `${profileAnalysis.targets.calories.min}-${profileAnalysis.targets.calories.max}`, unit: "kcal" },
                    { label: "Protein", value: `${profileAnalysis.targets.protein.min}-${profileAnalysis.targets.protein.max}`, unit: profileAnalysis.targets.protein.unit },
                    { label: "Iron", value: `${profileAnalysis.targets.iron.min}`, unit: profileAnalysis.targets.iron.unit },
                    { label: "Calcium", value: `${profileAnalysis.targets.calcium.min}`, unit: profileAnalysis.targets.calcium.unit },
                    { label: "Folate", value: `${profileAnalysis.targets.folate.min}`, unit: profileAnalysis.targets.folate.unit },
                    { label: "Vitamin D", value: `${profileAnalysis.targets.vitaminD.min}`, unit: profileAnalysis.targets.vitaminD.unit },
                    { label: "Fiber", value: `${profileAnalysis.targets.fiber.min}`, unit: profileAnalysis.targets.fiber.unit },
                    { label: "Omega-3", value: `${profileAnalysis.targets.omega3.min}`, unit: profileAnalysis.targets.omega3.unit },
                  ].map((n) => (
                    <div key={n.label} className="flex justify-between items-baseline">
                      <span className="text-xs text-gray-500">{n.label}</span>
                      <span className="text-xs font-semibold tabular-nums">{n.value} <span className="font-normal text-gray-400">{n.unit}</span></span>
                    </div>
                  ))}
                </div>
                <Separator className="my-3" />
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <ShieldCheck className="w-3 h-3" />
                  {patientProfile.lifeStage === "pregnancy" ? "ACOG Clinical Guidelines"
                    : patientProfile.lifeStage === "postpartum" ? "WHO Postpartum Nutrition"
                    : patientProfile.lifeStage === "menopause" ? "NAMS / Endocrine Society"
                    : "Standard Dietary Reference Intakes"}
                </div>
              </CardContent>
            </Card>

            {/* Restrictions — 4 cols */}
            <Card className="lg:col-span-4 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-gray-400" />
                  <CardTitle className="text-sm">Restrictions & Focus</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {patientProfile.allergies.length > 0 && !patientProfile.allergies.includes("none") && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500 mb-1">Allergies</p>
                    <div className="flex flex-wrap gap-1">
                      {patientProfile.allergies.map((a) => (
                        <Badge key={a} variant="destructive" className="text-[10px] h-5">
                          <XCircle className="w-2.5 h-2.5 mr-0.5" />{a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider textcoral-600 mb-1">Excluded ({profileAnalysis.excludes.length})</p>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                    {profileAnalysis.excludes.slice(0, 15).map((e) => (
                      <span key={e} className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">{e}</span>
                    ))}
                    {profileAnalysis.excludes.length > 15 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">+{profileAnalysis.excludes.length - 15}</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider textrose-600 mb-1">Focus ({profileAnalysis.includes.length})</p>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                    {profileAnalysis.includes.slice(0, 12).map((i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bgrose-50 textrose-600 border borderrose-100">{i}</span>
                    ))}
                    {profileAnalysis.includes.length > 12 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">+{profileAnalysis.includes.length - 12}</span>
                    )}
                  </div>
                </div>
                {patientProfile.dietaryPreferences && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <Apple className="w-3 h-3 textrose-600" />
                    <span className="text-xs capitalize font-medium">{patientProfile.dietaryPreferences}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Medical Notes */}
          {profileAnalysis.targets.notes.length > 0 && (
            <Card className="shadow-sm borderplum-100 bgplum-50/30">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 textplum-600" />
                  <span className="text-sm font-semibold textplum-900">Clinical Guidelines</span>
                </div>
                <div className="grid md:grid-cols-2 gap-x-6 gap-y-1.5">
                  {profileAnalysis.targets.notes.map((note, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs textplum-800">
                      <CircleDot className="w-3 h-3 textplum-400 shrink-0 mt-0.5" />
                      {note}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ===== GENERATE CONTROLS ===== */}
          <Card className="shadow-sm">
            <CardContent className="py-5">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Duration to generate</Label>
                  <Select value={String(numDays)} onValueChange={(v) => setNumDays(Number(v))}>
                    <SelectTrigger className="w-32 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 Days</SelectItem>
                      <SelectItem value="5">5 Days</SelectItem>
                      <SelectItem value="7">7 Days</SelectItem>
                      <SelectItem value="14">14 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="bg-gray-900 hover:bg-gray-800 h-10 px-6"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" />Generate Diet Chart</>
                  )}
                </Button>

                {isGenerating && (
                  <span className="text-xs text-gray-400">
                    Composing meals around her dosha, clinical targets, kitchen and screening results — this drops straight into the board below.
                  </span>
                )}
              </div>

              {/* What the generator is planning around, so the doctor can see
                  the inputs before spending a generation on them. */}
              <Separator className="my-4" />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Apple className="w-3.5 h-3.5 text-gray-400" />
                  {pantryItems.length > 0 ? (
                    <span>
                      Kitchen: <span className="font-medium text-gray-700">{pantryAtHomeCount} at home</span>
                      {pantryItems.length - pantryAtHomeCount > 0 && (
                        <span>, {pantryItems.length - pantryAtHomeCount} on the shopping list</span>
                      )}
                    </span>
                  ) : (
                    <span>No pantry recorded — meals will use common staples.</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
                  {screenings.length === 0 ? (
                    <span>No disease screening on record.</span>
                  ) : flaggedConditions.length === 0 ? (
                    <span>{screenings.length} screening(s) on record, none above low risk.</span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-1">
                      Screening flags:
                      {flaggedConditions.map((condition) => (
                        <Badge
                          key={condition.label}
                          variant="outline"
                          className={`text-[10px] h-5 ${RISK_STYLES[condition.level].badge}`}
                        >
                          {condition.label}
                        </Badge>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ===== GENERATED / EDITING BANNER ===== */}
      {planMeta && !isLoadingDraft && (
        <Card className="borderrose-200 bgrose-50/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bgrose-100 flex items-center justify-center">
                <FileEdit className="w-4 h-4 textrose-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold textrose-900">
                  {editingDraftId ? "Editing a saved diet plan" : "Personalized plan generated"}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs textrose-700">
                  {!!planMeta.primaryDosha && (
                    <Badge variant="outline" className="text-[10px] h-4 bg-white borderrose-300 textrose-700 capitalize">
                      {String(planMeta.primaryDosha)} Dosha
                    </Badge>
                  )}
                  {!!planMeta.lifeStageLabel && (
                    <Badge variant="outline" className="text-[10px] h-4 bg-white border-pink-300 text-pink-700">
                      {String(planMeta.lifeStageLabel)}
                    </Badge>
                  )}
                  <span className="textrose-600">Drag & drop meals below to adjust, then save.</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 borderrose-300 textrose-700 hover:bgrose-100"
                onClick={handleClearBoard}
              >
                <AlertCircle className="w-3 h-3" />
                {editingDraftId ? "Cancel Edit" : "Clear"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== SAVE FORM ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Diet Plan Details</CardTitle>
          {patientName && (
            <CardDescription>
              Saving for <strong>{patientName}</strong>{patientCode ? ` (${patientCode})` : ""}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="plan-duration">Plan Duration</Label>
              <Select value={planDuration} onValueChange={setPlanDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7 days">7 Days</SelectItem>
                  <SelectItem value="14 days">14 Days</SelectItem>
                  <SelectItem value="21 days">21 Days</SelectItem>
                  <SelectItem value="30 days">30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="plan-type">Plan Type</Label>
              <Select value={planType} onValueChange={setPlanType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weight-management">Weight Management</SelectItem>
                  <SelectItem value="detox">Detox Plan</SelectItem>
                  <SelectItem value="digestive-health">Digestive Health</SelectItem>
                  <SelectItem value="immunity-boost">Immunity Boost</SelectItem>
                  <SelectItem value="diabetes-management">Diabetes Management</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={saveMealPlan}
                disabled={saving}
                className={`w-full gap-2 ${editingDraftId ? "bgrose-600 hover:bgrose-700" : ""}`}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : editingDraftId ? (
                  <>
                    <Save className="w-4 h-4" />
                    Approve & Save
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Plan
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== DRAG & DROP BOARD — always available, generated or not ===== */}
      <div className="flex gap-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          {/* Left: Food Palette */}
          <Droppable droppableId="palette">
            {(provided) => (
              <div
                className="w-1/4 p-4 bg-gray-100 rounded"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                <h2 className="text-lg font-bold mb-4">Food Palette</h2>
                <p className="text-sm text-gray-600 mb-4">
                  {paletteFoods.length} foods available
                </p>
                {paletteFoods.map((food, index) =>
                  renderFoodCard(food, index, `palette-${index}`)
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* Right: Planner */}
          <div className="w-3/4">
            {/* Filter Switch */}
            <div className="flex gap-4 mb-6">
              {["Daily", "Weekly"].map((option) => (
                <button
                  key={option}
                  className={`px-4 py-2 rounded ${
                    activeFilter === option
                      ? "bgrose-500 text-white"
                      : "bg-gray-200"
                  }`}
                  onClick={() => setActiveFilter(option)}
                >
                  {option}
                </button>
              ))}
            </div>

            {/* Daily Planner */}
            {activeFilter === "Daily" && (
              <div className="grid grid-cols-4 gap-4">
                {mealSlots.map((slot) => (
                  <Droppable key={slot} droppableId={`Daily__${slot}`}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="p-4 bg-gray-50 rounded border"
                      >
                        <h3 className="font-bold mb-2">{slot}</h3>
                        <p className="text-xs text-gray-500 mb-2">
                          {mealPlans.Daily[slot].length} items
                        </p>
                        {mealPlans.Daily[slot].map((food, idx) =>
                          renderFoodCard(food, idx, `Daily-${slot}-${idx}`)
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>
            )}

            {/* Weekly Planner */}
            {activeFilter === "Weekly" && (
              <div className="grid grid-cols-2 gap-4">
                {weekDays.map((day) => (
                  <div key={day} className="p-4 border rounded">
                    <h3 className="font-bold mb-2">{day}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {mealSlots.map((slot) => (
                        <Droppable
                          key={slot}
                          droppableId={`Weekly__${day}__${slot}`}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className="p-2 bg-gray-50 rounded border"
                            >
                              <h4 className="text-sm font-semibold">{slot}</h4>
                              <p className="text-xs text-gray-400">
                                {mealPlans.Weekly[day][slot].length} items
                              </p>
                              {mealPlans.Weekly[day][slot].map((food, idx) =>
                                renderFoodCard(
                                  food,
                                  idx,
                                  `Weekly-${day}-${slot}-${idx}`
                                )
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Nutrition Summary */}
            <div className="mt-6 p-4 bgrose-50 border rounded">
              <h2 className="text-lg font-bold mb-2">
                Nutrition Totals ({activeFilter})
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-2xl font-bold textrose-600">
                    {Math.round(nutritionTotals.Calories)}
                  </p>
                  <p className="text-sm text-gray-600">Calories</p>
                </div>
                <div>
                  <p className="text-2xl font-bold textplum-600">
                    {Math.round(nutritionTotals.Protein)}
                  </p>
                  <p className="text-sm text-gray-600">Protein (g)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold textcoral-600">
                    {Math.round(nutritionTotals.Fat)}
                  </p>
                  <p className="text-sm text-gray-600">Fat (g)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold textplum-600">
                    {Math.round(nutritionTotals.Carbs)}
                  </p>
                  <p className="text-sm text-gray-600">Carbs (g)</p>
                </div>
              </div>
            </div>
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};

export default RecipeBuilder;
