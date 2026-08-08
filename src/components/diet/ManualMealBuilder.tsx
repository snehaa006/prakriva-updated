import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useFoodContext } from "@/context/FoodContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, FileEdit, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { PatientPicker } from "@/components/patients/PatientPicker";
import { useDoctorPatients } from "@/hooks/useDoctorPatients";
import { usePersistentState } from "@/hooks/usePersistentState";
import { CACHE_KEYS } from "@/lib/localCache";

const mealSlots = ["Breakfast", "Lunch", "Dinner", "Snack"];
const weekDays = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

export const ManualMealBuilder = () => {
  const [searchParams] = useSearchParams();

  const { selectedFoods } = useFoodContext();

  // Track selected filter
  const [activeFilter, setActiveFilter] = usePersistentState(
    CACHE_KEYS.recipeBuilderDraft + ":filter",
    "Daily"
  );

  // Save form state. `patientId` is the patients.id UUID that diet_plans keys
  // on; `patientCode` is the P001-style code shown to the doctor.
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
  // come from a cached draft or from the ?patientId= link out of the
  // Personalized Generator tab, neither of which carries the P001 code.
  useEffect(() => {
    if (!patientId || doctorPatients.length === 0) return;
    const match = doctorPatients.find((patient) => patient.id === patientId);
    if (!match) return;
    setPatientCode((current) => current || match.code);
    setPatientName((current) => current || match.name);
  }, [patientId, doctorPatients, setPatientCode, setPatientName]);

  // Draft editing state
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editingDraftMeta, setEditingDraftMeta] = useState<Record<string, unknown> | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);

  // Meal plans. Cached in localStorage: a half-built plan is real work and must
  // survive a page refresh or an accidental navigation.
  const [mealPlans, setMealPlans] = usePersistentState(
    CACHE_KEYS.recipeBuilderDraft + ":meals",
    {
      Daily: { Breakfast: [], Lunch: [], Dinner: [], Snack: [] },
      Weekly: weekDays.reduce((acc, day) => {
        acc[day] = { Breakfast: [], Lunch: [], Dinner: [], Snack: [] };
        return acc;
      }, {}),
    }
  );

  // Palette
  const [paletteFoods, setPaletteFoods] = useState([...selectedFoods]);

  // --- Load draft from the Personalized Generator tab ---
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
        setEditingDraftMeta({
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

        // Convert personalized-diet-chart days[] to Weekly builder format
        const mealTypeToSlot: Record<string, string> = {
          breakfast: "Breakfast",
          mid_morning: "Snack",
          lunch: "Lunch",
          afternoon_snack: "Snack",
          dinner: "Dinner",
        };

        const newWeekly: Record<string, Record<string, unknown[]>> = {};
        weekDays.forEach((day) => {
          newWeekly[day] = { Breakfast: [], Lunch: [], Dinner: [], Snack: [] };
        });

        const allFoodsForDaily: { Breakfast: any[]; Lunch: any[]; Dinner: any[]; Snack: any[] } = {
          Breakfast: [],
          Lunch: [],
          Dinner: [],
          Snack: [],
        };

        if (planData.days && Array.isArray(planData.days)) {
          for (const day of planData.days) {
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

              // Also populate daily view from first day
              if (day.dayNumber === 1) {
                allFoodsForDaily[slot].push(foodItem);
              }
            }
          }
        }

        setMealPlans({
          Daily: allFoodsForDaily,
          Weekly: newWeekly,
        });

        setActiveFilter("Weekly");
        toast.success(`Draft loaded: ${planData.patientName}'s personalized diet plan. You can now drag & drop to edit.`);
      } catch (err) {
        console.error("Error loading draft plan:", err);
        toast.error("Failed to load draft plan.");
      } finally {
        setIsLoadingDraft(false);
      }
    };

    loadDraft();
  }, [searchParams]);

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

  // Regular save meal plan function for manual plans
  const saveMealPlan = async () => {
    if (!patientId.trim() || !patientName.trim()) {
      toast.error("Please enter patient ID and name");
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

      const dietPlanData: Record<string, unknown> = {
        // patients.id UUID — never the P001 code (uuid column + RLS check).
        patient_id: patientId.trim(),
        created_by: authData.user?.id ?? null,
        doctor_id: authData.user?.id ?? null,
        patient_name: patientName,
        plan_duration: planDuration,
        plan_type: editingDraftId ? "personalized-diet-chart" : "manual",
        meals: mealPlans,
        active_filter: activeFilter,
        source: editingDraftId ? "personalized-diet-chart-edited" : "manual",
        status: "final",
        total_meals:
          Object.values(mealPlans.Daily).flat().length +
          Object.values(mealPlans.Weekly)
            .flatMap((dayMeals) => Object.values(dayMeals))
            .flat().length,
      };

      // Preserve metadata from the Personalized Generator draft
      if (editingDraftId && editingDraftMeta) {
        dietPlanData.primary_dosha = editingDraftMeta.primaryDosha;
        dietPlanData.dosha_scores = editingDraftMeta.doshaScores;
        dietPlanData.life_stage = editingDraftMeta.lifeStage;
        dietPlanData.life_stage_label = editingDraftMeta.lifeStageLabel;
        dietPlanData.nutritional_targets = editingDraftMeta.nutritionalTargets;
        dietPlanData.dosha_recommendations = editingDraftMeta.doshaRecommendations;
        dietPlanData.medical_notes = editingDraftMeta.medicalNotes;
        dietPlanData.excluded_ingredients = editingDraftMeta.excludedIngredients;
        dietPlanData.original_generated_at = editingDraftMeta.generatedAt;
      }

      if (editingDraftId) {
        // Update existing draft in-place
        const { error } = await supabase
          .from("diet_plans")
          .update(dietPlanData)
          .eq("id", editingDraftId)
          .eq("patient_id", patientId.trim());
        if (error) throw error;
        toast.success("Personalized diet plan updated and approved!");
      } else {
        const { data: inserted, error } = await supabase
          .from("diet_plans")
          .insert(dietPlanData)
          .select("id")
          .single();
        if (error) throw error;
        toast.success(`Manual diet plan saved successfully! ID: ${inserted.id}`);
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

  return (
    <div>
      {/* Loading Draft Overlay */}
      {isLoadingDraft && (
        <div className="fixed inset-0 bg-white/80 z-50 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto" />
            <p className="text-sm font-medium text-gray-700">Loading personalized diet plan draft...</p>
          </div>
        </div>
      )}

      {/* Editing Draft Banner */}
      {editingDraftId && !isLoadingDraft && (
        <Card className="mb-4 border-green-200 bg-green-50/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <FileEdit className="w-4 h-4 text-green-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-900">Editing Personalized Generator Draft</p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-green-700">
                  {editingDraftMeta?.primaryDosha && (
                    <Badge variant="outline" className="text-[10px] h-4 bg-white border-green-300 text-green-700 capitalize">
                      {String(editingDraftMeta.primaryDosha)} Dosha
                    </Badge>
                  )}
                  {editingDraftMeta?.lifeStageLabel && (
                    <Badge variant="outline" className="text-[10px] h-4 bg-white border-pink-300 text-pink-700">
                      {String(editingDraftMeta.lifeStageLabel)}
                    </Badge>
                  )}
                  <span className="text-green-600">Drag & drop meals to rearrange, then save to approve.</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-green-300 text-green-700 hover:bg-green-100"
                onClick={() => {
                  setEditingDraftId(null);
                  setEditingDraftMeta(null);
                  setPatientId("");
                  setPatientName("");
                  setMealPlans({
                    Daily: { Breakfast: [], Lunch: [], Dinner: [], Snack: [] },
                    Weekly: weekDays.reduce((acc, day) => {
                      acc[day] = { Breakfast: [], Lunch: [], Dinner: [], Snack: [] };
                      return acc;
                    }, {}),
                  });
                  setActiveFilter("Daily");
                  // Clear URL params
                  window.history.replaceState({}, "", window.location.pathname);
                  toast.info("Draft editing cancelled.");
                }}
              >
                <AlertCircle className="w-3 h-3" />
                Cancel Edit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header with Save Form */}
      <div className="mb-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Diet Plan Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <PatientPicker
                  label="Patient"
                  value={patientId}
                  onSelect={(patient) => {
                    setPatientId(patient?.id ?? "");
                    setPatientCode(patient?.code ?? "");
                    setPatientName(patient?.name ?? "");
                  }}
                />
              </div>
              <div>
                <Label htmlFor="patient-name">Patient Name</Label>
                <Input
                  id="patient-name"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Selected from the patient list"
                />
                {patientCode && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Patient ID: <span className="font-mono">{patientCode}</span>
                  </p>
                )}
              </div>
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
                  className={`w-full gap-2 ${editingDraftId ? "bg-green-600 hover:bg-green-700" : ""}`}
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

      </div>

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
                      ? "bg-green-500 text-white"
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
                        <p className="text-xs text-gray-500mb-2">
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
            <div className="mt-6 p-4 bg-green-50 border rounded">
              <h2 className="text-lg font-bold mb-2">
                Nutrition Totals ({activeFilter})
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {Math.round(nutritionTotals.Calories)}
                  </p>
                  <p className="text-sm text-gray-600">Calories</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {Math.round(nutritionTotals.Protein)}
                  </p>
                  <p className="text-sm text-gray-600">Protein (g)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {Math.round(nutritionTotals.Fat)}
                  </p>
                  <p className="text-sm text-gray-600">Fat (g)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">
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
