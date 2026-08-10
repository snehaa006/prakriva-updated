import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Clock,
  Utensils,
  Heart,
  Zap,
  Activity,
  Sun,
  Moon,
  Coffee,
  Search,
  RefreshCw,
  User,
  Calendar,
  Info,
  ChefHat,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/lib/supabase";

type Meal = {
  id: string;
  type: "breakfast" | "lunch" | "snack" | "dinner";
  name: string;
  time: string;
  calories: number;
  status: "eaten" | "skipped" | "pending";
  notes?: string;
  preparation?: string;
  benefits?: string;
  doshaBalance?: string;
  quantity?: string;
};

type RecipeInfo = {
  loading: boolean;
  recipe?: string;
  youtube?: string;
  error?: string;
};

type SavedDietPlan = {
  id: string;
  patientName: string;
  planDuration: string;
  planType: string;
  meals: any;
  createdAt: string;
  totalMeals: number;
  activeFilter?: string;
};

const MealLogging = () => {
  const navigate = useNavigate();
  const { user } = useApp();

  // Patient search and diet plan state
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [savedPlans, setSavedPlans] = useState<SavedDietPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SavedDietPlan | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Meal logging state
  const [todaysMeals, setTodaysMeals] = useState<Meal[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const [digestionRating, setDigestionRating] = useState([3]);
  const [moodRating, setMoodRating] = useState([3]);
  const [energyRating, setEnergyRating] = useState([3]);
  const [feedbackNotes, setFeedbackNotes] = useState("");

  // Recipe search state
  const [searchFood, setSearchFood] = useState("");
  const [recipeData, setRecipeData] = useState<RecipeInfo>({ loading: false });

  // Mock recipes for fallback
  const mockRecipes: Record<string, { recipe: string; youtube?: string }> = {
    "oatmeal": { recipe: "Boil oats in milk, add honey and almonds." },
    "quinoa": { recipe: "Cook quinoa, mix with vegetables, and drizzle olive oil.", youtube: "https://www.youtube.com/watch?v=abc123" },
    "fruit salad": { recipe: "Chop seasonal fruits and mix with honey and lemon juice." }
  };

  // Convert Firebase meal plans to Meal format
  const convertDietPlanToMeals = (mealPlans: any, activeFilter: string = "Daily"): Meal[] => {
    const meals: Meal[] = [];
    let mealCounter = 1;

    const timeSlotMappings: { [key: string]: string } = {
      "Breakfast": "08:00 AM",
      "Lunch": "12:30 PM",
      "Dinner": "07:00 PM",
      "Snack": "04:00 PM",
      "Early Morning": "06:30 AM",
      "Mid Morning": "10:00 AM",
      "Afternoon Snack": "03:00 PM",
      "Evening Snack": "05:30 PM",
      "Before Bed": "09:30 PM"
    };

    const mealTypeMapping: { [key: string]: "breakfast" | "lunch" | "snack" | "dinner" } = {
      "Breakfast": "breakfast",
      "Early Morning": "breakfast",
      "Lunch": "lunch",
      "Snack": "snack",
      "Mid Morning": "snack",
      "Afternoon Snack": "snack",
      "Evening Snack": "snack",
      "Dinner": "dinner",
      "Before Bed": "dinner"
    };

    if (activeFilter === "Daily" && mealPlans.Daily) {
      Object.entries(mealPlans.Daily).forEach(([mealType, foods]: [string, any]) => {
        if (Array.isArray(foods)) {
          foods.forEach((food: any) => {
            meals.push({
              id: `${mealCounter++}`,
              type: mealTypeMapping[mealType] || "snack",
              name: food.Food_Item || "Unknown Food",
              time: timeSlotMappings[mealType] || "09:00 AM",
              calories: parseInt(food.Calories) || 0,
              status: "pending",
              preparation: food.preparation || `Prepare ${food.Food_Item} as recommended by your Ayurvedic practitioner`,
              benefits: food.benefits || `Nutritional content: ${food.Protein || 0}g protein, ${food.Fat || 0}g fat, ${food.Carbs || 0}g carbs`,
              doshaBalance: food.Dosha_Vata === "Pacifying" ? "Vata Balancing" :
                           food.Dosha_Pitta === "Pacifying" ? "Pitta Balancing" :
                           food.Dosha_Kapha === "Pacifying" ? "Kapha Balancing" : "Tridoshic",
              quantity: food.quantity || "1 serving"
            });
          });
        }
      });
    }

    // Also handle the days[] format from Recipe Builder's Personalized Generator
    if (mealPlans.days && Array.isArray(mealPlans.days)) {
      const todayIndex = new Date().getDay();
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const todayDay = mealPlans.days.find((d: any) =>
        d.dayLabel?.toLowerCase().includes(dayNames[todayIndex].toLowerCase())
      ) || mealPlans.days[0];

      if (todayDay?.meals) {
        for (const meal of todayDay.meals) {
          const mType = meal.mealType === "breakfast" ? "breakfast"
            : meal.mealType === "lunch" ? "lunch"
            : meal.mealType === "dinner" ? "dinner"
            : "snack";
          meals.push({
            id: `${mealCounter++}`,
            type: mType as Meal["type"],
            name: meal.recipeName || "Unknown Recipe",
            time: meal.time || timeSlotMappings[mType.charAt(0).toUpperCase() + mType.slice(1)] || "12:00 PM",
            calories: Math.round(meal.calories || meal.actualCalories || 0),
            status: "pending",
            preparation: `Prepare as needed`,
            benefits: `${meal.protein || 0}g protein, ${meal.fat || 0}g fat, ${meal.carbs || 0}g carbs`,
            quantity: `1 serving`,
          });
        }
      }
    }

    return meals;
  };

  // Auto-load diet plans for authenticated patient
  useEffect(() => {
    if (user?.id && !patientId) {
      setPatientId(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    if (patientId && patientId === user?.id) {
      fetchDietPlans();
    }
  }, [patientId]);

  // Fetch saved diet plans for a patient
  const fetchDietPlans = async () => {
    if (!patientId.trim()) {
      toast.error("Please enter a patient ID");
      return;
    }

    setLoadingPlans(true);
    try {
      const { data, error } = await supabase
        .from("diet_plans")
        .select("id, patient_name, plan_duration, plan_type, meals, total_meals, active_filter, created_at")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const plans: SavedDietPlan[] = (data ?? []).map((row) => ({
        id: row.id,
        patientName: row.patient_name,
        planDuration: row.plan_duration,
        planType: row.plan_type,
        meals: row.meals,
        totalMeals: row.total_meals,
        activeFilter: row.active_filter,
        createdAt: row.created_at,
      }));

      setSavedPlans(plans);

      if (plans.length === 0) {
        toast.info("No diet plans found for this patient");
        setTodaysMeals([]); // Clear meals if no plans found
      } else {
        toast.success(`Found ${plans.length} diet plan(s)`);
        // Auto-load the most recent plan
        if (plans[0]) {
          await loadDietPlan(plans[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching diet plans:", error);
      toast.error("Failed to fetch diet plans. Please try again.");
      setTodaysMeals([]); // Clear meals on error
    } finally {
      setLoadingPlans(false);
    }
  };

  // Load a specific diet plan
  const loadDietPlan = async (plan: SavedDietPlan) => {
    setSelectedPlan(plan);
    setPatientName(plan.patientName || user?.name || "");

    // Handle both formats: days[] from the Personalized Generator and meals from the Manual Builder
    const planData = (plan as any);
    const dataToConvert = planData.days ? { days: planData.days } : plan.meals;
    const meals = convertDietPlanToMeals(dataToConvert, plan.activeFilter);

    // Restore any eaten/skipped choices already logged for today so a reload
    // doesn't reset every meal back to "pending". Statuses are keyed by the
    // same meal id convertDietPlanToMeals assigns, which is stable per plan.
    const today = new Date().toISOString().split("T")[0];
    try {
      const { data } = await supabase
        .from("meal_tracking")
        .select("statuses")
        .eq("patient_id", patientId)
        .eq("date", today)
        .maybeSingle();
      const saved = (data?.statuses as Record<string, string>) || {};
      setTodaysMeals(
        meals.map((m) =>
          saved[m.id] ? { ...m, status: saved[m.id] as Meal["status"] } : m
        )
      );
    } catch (e) {
      console.error("Failed to load meal tracking:", e);
      setTodaysMeals(meals);
    }

    const dateStr = plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : "recent";
    toast.success(`Loaded diet plan from ${dateStr}`);
  };

  // Persist today's meal statuses to Supabase. The unique index on
  // (patient_id, date) keeps this to one row per day, so re-marking a meal
  // updates the same row instead of piling up history. Only the patient logs
  // their own tracking; a doctor viewing the page just reads it back.
  const persistMealStatuses = (meals: Meal[]) => {
    if (!user?.id || patientId !== user.id) return;

    const today = new Date().toISOString().split("T")[0];
    const statuses: Record<string, string> = {};
    let caloriesConsumed = 0;
    for (const m of meals) {
      statuses[m.id] = m.status;
      if (m.status === "eaten") caloriesConsumed += m.calories;
    }

    void supabase
      .from("meal_tracking")
      .upsert(
        {
          patient_id: user.id,
          date: today,
          statuses,
          calories_consumed: caloriesConsumed,
          total_meals: meals.length,
          eaten_count: meals.filter((m) => m.status === "eaten").length,
          skipped_count: meals.filter((m) => m.status === "skipped").length,
        },
        { onConflict: "patient_id,date" }
      )
      .then(({ error }) => {
        if (error) console.error("Failed to save meal tracking:", error);
      });
  };

  // Update meal status
  const updateMealStatus = (mealId: string, status: "eaten" | "skipped" | "pending", notes?: string) => {
    setTodaysMeals(prev => {
      const updated = prev.map(meal =>
        meal.id === mealId
          ? { ...meal, status, notes: notes || meal.notes }
          : meal
      );
      // Save straight away so the choice survives a reload.
      persistMealStatuses(updated);
      return updated;
    });
    const messages: Record<typeof status, string> = {
      eaten: "Nice — logged as eaten",
      skipped: "No worries, marked as skipped",
      pending: "Back to pending",
    };
    toast.success(messages[status]);
  };

  // Save feedback to Firebase
  const saveFeedback = async () => {
    if (!patientId.trim() || !selectedMeal) {
      toast.error("Please select a meal first");
      return;
    }

    try {
      const feedbackData = {
        patient_id: patientId,
        patient_name: patientName,
        meal_id: selectedMeal,
        meal_name: todaysMeals.find(m => m.id === selectedMeal)?.name || "Unknown",
        digestion_rating: digestionRating[0],
        mood_rating: moodRating[0],
        energy_rating: energyRating[0],
        notes: feedbackNotes,
        date: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      };

      const { error } = await supabase.from("meal_feedback").insert(feedbackData);
      if (error) throw error;


      toast.success("Feedback saved — thank you for sharing how you feel");

      // Reset feedback form
      setSelectedMeal(null);
      setDigestionRating([3]);
      setMoodRating([3]);
      setEnergyRating([3]);
      setFeedbackNotes("");

    } catch (error) {
      console.error("Error saving feedback:", error);
      toast.error("Failed to save feedback. Please try again.");
    }
  };

  const getMealIcon = (type: Meal["type"]) => {
    switch (type) {
      case 'breakfast': return Sun;
      case 'lunch': return Utensils;
      case 'snack': return Coffee;
      case 'dinner': return Moon;
      default: return Utensils;
    }
  };

  const getStatusIcon = (status: Meal["status"]) => {
    switch (status) {
      case 'eaten': return <CheckCircle className="w-5 h-5 text-success" />;
      case 'skipped': return <XCircle className="w-5 h-5 text-foreground-tertiary" />;
      case 'pending': return <Clock className="w-5 h-5 text-warning" />;
      default: return <Clock className="w-5 h-5 text-foreground-tertiary" />;
    }
  };

  const getStatusColor = (status: Meal["status"]) => {
    switch (status) {
      case 'eaten': return 'bg-accent-soft/60 border-accent-soft';
      case 'skipped': return 'bg-muted border-border';
      case 'pending': return 'bg-warning/5 border-warning/20';
      default: return 'bg-muted border-border';
    }
  };

  const getEmojiForRating = (rating: number, type: 'digestion' | 'mood' | 'energy') => {
    if (type === 'digestion') return ['😰', '😕', '😐', '😊', '😄'][rating - 1] || '😐';
    if (type === 'mood') return ['😢', '😟', '😐', '🙂', '😊'][rating - 1] || '😐';
    if (type === 'energy') return ['😴', '🥱', '😐', '⚡', '🚀'][rating - 1] || '😐';
    return '😐';
  };

  // Mock fetch function for recipes
  const fetchRecipe = async () => {
    if (!searchFood) return;
    setRecipeData({ loading: true });
    setTimeout(() => {
      const key = searchFood.toLowerCase();
      if (mockRecipes[key]) {
        setRecipeData({ loading: false, ...mockRecipes[key] });
      } else {
        setRecipeData({
          loading: false,
          error: "Recipe not found",
          youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchFood)}`
        });
      }
    }, 1000);
  };

  const selectedMealData = selectedMeal ? todaysMeals.find(m => m.id === selectedMeal) : null;
  const eatenCount = todaysMeals.filter(m => m.status === 'eaten').length;
  const pendingCount = todaysMeals.filter(m => m.status === 'pending').length;
  const totalCalories = todaysMeals.reduce((sum, meal) => sum + meal.calories, 0);

  return (
    <div className="flex-1 space-y-6 p-4 sm:space-y-8 sm:p-6 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-title1 text-foreground">Meal Logging & Feedback</h1>
          <p className="mt-1.5 text-body text-foreground-secondary">
            Track your Ayurvedic meals today and how they made you feel
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/patient/dashboard')} className="w-full sm:w-auto">
          Back to Dashboard
        </Button>
      </div>

      {/* Today's progress — the dominant summary, shown first */}
      {todaysMeals.length > 0 && (
        <Card className="border-accent-soft bg-accent-soft/30">
          <CardContent className="p-5 sm:p-6 md:p-8">
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 sm:gap-6">
              <div>
                <div className="text-caption1 text-foreground-secondary">Today's meals</div>
                <div className="mt-1 text-title2 text-foreground">{todaysMeals.length}</div>
              </div>
              <div>
                <div className="text-caption1 text-foreground-secondary">Eaten</div>
                <div className="mt-1 text-title2 text-primary">{eatenCount}</div>
              </div>
              <div>
                <div className="text-caption1 text-foreground-secondary">Still pending</div>
                <div className="mt-1 text-title2 text-foreground">{pendingCount}</div>
              </div>
              <div>
                <div className="text-caption1 text-foreground-secondary">Calories logged</div>
                <div className="mt-1 text-title2 text-foreground">{totalCalories}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Patient Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-headline">
            <User className="w-5 h-5 text-primary" />
            Load Diet Plan
          </CardTitle>
          <CardDescription>
            Enter a patient ID to load their personalized Ayurvedic diet plan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="patient-id">Patient ID *</Label>
              <Input
                id="patient-id"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="Enter patient ID"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="patient-name-display">Patient Name</Label>
              <Input
                id="patient-name-display"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Will be loaded from plan"
                disabled={!!selectedPlan}
                className="mt-1.5"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={fetchDietPlans}
                disabled={loadingPlans || !patientId.trim()}
                className="w-full gap-2 h-11"
              >
                {loadingPlans ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Load Diet Plan
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Available Plans */}
          {savedPlans.length > 0 && (
            <div className="pt-2 space-y-2">
              <Label className="text-caption1 text-foreground-secondary">Available plans</Label>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
                {savedPlans.map((plan) => (
                  <Button
                    key={plan.id}
                    size="sm"
                    variant={selectedPlan?.id === plan.id ? "default" : "outline"}
                    onClick={() => loadDietPlan(plan)}
                    className="gap-1.5 shrink-0"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(plan.createdAt).toLocaleDateString()} · {plan.planType}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Current Plan Info */}
          {selectedPlan && (
            <div className="flex items-start gap-3 rounded-xl border border-accent-soft bg-accent-soft/40 px-4 py-3.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
              <div>
                <p className="text-footnote font-medium text-foreground">Currently loaded plan</p>
                <p className="mt-0.5 text-footnote text-foreground-secondary">
                  {selectedPlan.patientName} · {selectedPlan.planDuration} · {selectedPlan.planType.replace('-', ' ')}
                  {" · "}Created {new Date(selectedPlan.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Meals Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-headline">
              <ChefHat className="w-5 h-5 text-primary" />
              Today's Ayurvedic Meals
            </CardTitle>
            <CardDescription>
              {todaysMeals.length > 0
                ? `${todaysMeals.length} personalized meals from your diet plan`
                : "Load a diet plan above to see today's meals"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {todaysMeals.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-primary">
                  <Utensils className="w-6 h-6" />
                </div>
                <p className="mt-4 text-subhead font-medium text-foreground">No meals loaded yet</p>
                <p className="mt-1.5 max-w-xs text-footnote text-foreground-secondary">
                  Enter a patient ID above and we'll bring in their personalized diet plan.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaysMeals.map((meal) => {
                  const MealIcon = getMealIcon(meal.type);
                  return (
                    <div
                      key={meal.id}
                      className={`p-4 border rounded-xl cursor-pointer transition-colors duration-200 ease-ios ${getStatusColor(meal.status)} ${selectedMeal === meal.id ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => setSelectedMeal(meal.id)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-primary">
                            <MealIcon className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-subhead font-medium text-foreground truncate">{meal.name}</h3>
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
                        <span className="shrink-0">{getStatusIcon(meal.status)}</span>
                      </div>

                      {/* Meal Details */}
                      {selectedMeal === meal.id && (
                        <div className="mt-3.5 pt-3.5 border-t border-border/60 space-y-2">
                          {meal.quantity && (
                            <p className="text-footnote text-foreground-secondary">
                              <span className="font-medium text-foreground">Quantity:</span> {meal.quantity}
                            </p>
                          )}
                          {meal.preparation && (
                            <p className="text-footnote text-foreground-secondary">
                              <span className="font-medium text-foreground">Preparation:</span> {meal.preparation}
                            </p>
                          )}
                          {meal.benefits && (
                            <p className="text-footnote text-foreground-secondary">
                              <span className="font-medium text-foreground">Benefits:</span> {meal.benefits}
                            </p>
                          )}

                          {/* Status Update Buttons */}
                          <div className="grid grid-cols-3 gap-2 pt-2">
                            <Button
                              size="sm"
                              variant={meal.status === 'eaten' ? 'default' : 'outline'}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateMealStatus(meal.id, 'eaten');
                              }}
                              className="gap-1.5 h-10"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Eaten
                            </Button>
                            <Button
                              size="sm"
                              variant={meal.status === 'skipped' ? 'secondary' : 'outline'}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateMealStatus(meal.id, 'skipped');
                              }}
                              className="gap-1.5 h-10"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Skip
                            </Button>
                            <Button
                              size="sm"
                              variant={meal.status === 'pending' ? 'secondary' : 'outline'}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateMealStatus(meal.id, 'pending');
                              }}
                              className="gap-1.5 h-10"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              Pending
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

        {/* Feedback Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-headline">Post-Meal Feedback</CardTitle>
            <CardDescription>
              {selectedMealData
                ? `Rate how "${selectedMealData.name}" made you feel`
                : "Select a meal to provide feedback"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!selectedMealData ? (
              <div className="flex flex-col items-center py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-primary">
                  <Heart className="w-6 h-6" />
                </div>
                <p className="mt-4 text-footnote text-foreground-secondary max-w-xs">
                  Select a meal on the left to share how it made you feel.
                </p>
              </div>
            ) : (
              <>
                {/* Selected Meal Info */}
                <div className="rounded-xl bg-muted px-4 py-3">
                  <h4 className="text-subhead font-medium text-foreground">{selectedMealData.name}</h4>
                  <p className="text-footnote text-foreground-secondary">
                    {selectedMealData.time} · Status: {selectedMealData.status}
                  </p>
                </div>

                {/* Digestion Rating */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-footnote font-medium text-foreground flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      Digestion
                    </label>
                    <span className="text-2xl">{getEmojiForRating(digestionRating[0], 'digestion')}</span>
                  </div>
                  <Slider
                    value={digestionRating}
                    onValueChange={setDigestionRating}
                    max={5}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-caption1 text-foreground-tertiary">
                    <span>Poor</span>
                    <span>Excellent</span>
                  </div>
                </div>

                {/* Mood Rating */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-footnote font-medium text-foreground flex items-center gap-2">
                      <Heart className="w-4 h-4 text-primary" />
                      Mood
                    </label>
                    <span className="text-2xl">{getEmojiForRating(moodRating[0], 'mood')}</span>
                  </div>
                  <Slider
                    value={moodRating}
                    onValueChange={setMoodRating}
                    max={5}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-caption1 text-foreground-tertiary">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>

                {/* Energy Rating */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-footnote font-medium text-foreground flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      Energy Level
                    </label>
                    <span className="text-2xl">{getEmojiForRating(energyRating[0], 'energy')}</span>
                  </div>
                  <Slider
                    value={energyRating}
                    onValueChange={setEnergyRating}
                    max={5}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-caption1 text-foreground-tertiary">
                    <span>Tired</span>
                    <span>Energetic</span>
                  </div>
                </div>

                <Textarea
                  placeholder="Anything else about how this meal made you feel..."
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  rows={3}
                />

                <Button
                  className="w-full"
                  onClick={saveFeedback}
                  disabled={!patientId || !selectedMeal}
                >
                  Save Feedback
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recipe Search Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-headline">Recipe & Preparation Guide</CardTitle>
            <CardDescription>Search for cooking instructions for your Ayurvedic meals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Enter food name (e.g., quinoa, oatmeal)..."
                value={searchFood}
                onChange={(e) => setSearchFood(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && fetchRecipe()}
                className="h-11 sm:h-10"
              />
              <Button onClick={fetchRecipe} className="gap-2 shrink-0 h-11 sm:h-10">
                <Search className="w-4 h-4" />
                Search
              </Button>
            </div>

            {recipeData.loading && (
              <div className="flex items-center gap-2 text-footnote text-foreground-secondary">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <p>Looking that up...</p>
              </div>
            )}

            {recipeData.error && (
              <div className="rounded-xl border border-border bg-muted px-4 py-3">
                <p className="text-footnote text-foreground-secondary">
                  No recipe on file for that one yet — try the YouTube search below.
                </p>
              </div>
            )}

            {recipeData.recipe && (
              <div className="rounded-xl border border-accent-soft bg-accent-soft/40 px-4 py-3.5">
                <h4 className="text-footnote font-medium text-foreground mb-1">Recipe instructions</h4>
                <p className="text-footnote text-foreground-secondary">{recipeData.recipe}</p>
              </div>
            )}

            {recipeData.youtube && (
              <div className="rounded-xl border border-border bg-muted px-4 py-3">
                <a
                  className="text-footnote font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                  href={recipeData.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Watch cooking videos on YouTube →
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MealLogging;
