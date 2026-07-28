import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  Leaf,
  User,
  Target,
  Heart,
  Clock,
  Flame,
  ChefHat,
  AlertTriangle,
  CheckCircle2,
  Save,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Baby,
  Activity,
  Apple,
  Utensils,
  BookOpen,
  XCircle,
  Loader2,
  Printer,
  ExternalLink,
  FileEdit,
  Calendar,
  TrendingUp,
  CircleDot,
  Stethoscope,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import {
  query,
  collection,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { toast } from "sonner";
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
} from "@/services/dietChartService";
import {
  searchRecipeById,
  getInstructionsByRecipeId,
  type RecipeBasic,
} from "@/services/foodoscopeApi";

// ==================== TYPES ====================

interface PatientListItem {
  firebaseId: string;
  customPatientId: string;
  patientName: string;
  fullPatientProfile: Record<string, unknown>;
}

interface RecipeDetail {
  recipe: RecipeBasic;
  instructions: string;
}

interface FlavorSuggestion {
  ingredient: string;
  flavor: string;
  category: string;
}

// Ayurvedic flavor ingredient fallback (used when FlavorDB API is unavailable)
const FLAVOR_FALLBACK: Record<string, { ingredient: string; generic_name: string; category: string }[]> = {
  sweet: [
    { ingredient: "jaggery", generic_name: "Jaggery", category: "Sweetener" },
    { ingredient: "honey", generic_name: "Honey", category: "Sweetener" },
    { ingredient: "dates", generic_name: "Dates", category: "Fruit" },
    { ingredient: "coconut", generic_name: "Coconut", category: "Nut" },
    { ingredient: "sweet potato", generic_name: "Sweet Potato", category: "Vegetable" },
    { ingredient: "banana", generic_name: "Banana", category: "Fruit" },
    { ingredient: "rice", generic_name: "Rice", category: "Cereal" },
    { ingredient: "ghee", generic_name: "Ghee (Clarified Butter)", category: "Dairy" },
  ],
  sour: [
    { ingredient: "lemon", generic_name: "Lemon", category: "Fruit" },
    { ingredient: "tamarind", generic_name: "Tamarind", category: "Spice" },
    { ingredient: "amla", generic_name: "Indian Gooseberry (Amla)", category: "Fruit" },
    { ingredient: "yogurt", generic_name: "Yogurt", category: "Dairy" },
    { ingredient: "tomato", generic_name: "Tomato", category: "Vegetable" },
    { ingredient: "raw mango", generic_name: "Raw Mango", category: "Fruit" },
    { ingredient: "vinegar", generic_name: "Vinegar", category: "Condiment" },
  ],
  bitter: [
    { ingredient: "turmeric", generic_name: "Turmeric", category: "Spice" },
    { ingredient: "fenugreek", generic_name: "Fenugreek (Methi)", category: "Spice" },
    { ingredient: "bitter gourd", generic_name: "Bitter Gourd (Karela)", category: "Vegetable" },
    { ingredient: "neem", generic_name: "Neem Leaves", category: "Herb" },
    { ingredient: "dark chocolate", generic_name: "Dark Chocolate", category: "Confection" },
    { ingredient: "dandelion", generic_name: "Dandelion Greens", category: "Herb" },
  ],
  salty: [
    { ingredient: "rock salt", generic_name: "Rock Salt (Sendha Namak)", category: "Mineral" },
    { ingredient: "sea salt", generic_name: "Sea Salt", category: "Mineral" },
    { ingredient: "seaweed", generic_name: "Seaweed (Kelp)", category: "Vegetable" },
    { ingredient: "celery", generic_name: "Celery", category: "Vegetable" },
    { ingredient: "black salt", generic_name: "Black Salt (Kala Namak)", category: "Mineral" },
    { ingredient: "miso", generic_name: "Miso", category: "Fermented" },
  ],
};

// ==================== HELPER COMPONENTS ====================

const DoshaRadial: React.FC<{
  scores: { vata: number; pitta: number; kapha: number };
  primary: string;
}> = ({ scores, primary }) => {
  const total = scores.vata + scores.pitta + scores.kapha || 1;
  const doshaInfo: Record<string, { color: string; bgColor: string; label: string }> = {
    vata: { color: "text-sky-700", bgColor: "bg-sky-500", label: "Vata" },
    pitta: { color: "text-rose-700", bgColor: "bg-rose-500", label: "Pitta" },
    kapha: { color: "text-emerald-700", bgColor: "bg-emerald-500", label: "Kapha" },
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

const MacroRing: React.FC<{
  value: number;
  target: { min: number; max?: number };
  label: string;
  unit: string;
  color: string;
  icon: React.ReactNode;
}> = ({ value, target, label, unit, color, icon }) => {
  const max = target.max || target.min * 1.3;
  const pct = Math.min(Math.round((value / max) * 100), 100);
  const inRange = value >= target.min * 0.85 && value <= max * 1.15;

  return (
    <div className="text-center space-y-2">
      <div className="relative w-20 h-20 mx-auto">
        <svg viewBox="0 0 36 36" className="w-20 h-20 transform -rotate-90">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="3"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={`${pct}, 100`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-lg font-bold tabular-nums">{Math.round(value)}<span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span></p>
        <p className="text-[11px] text-gray-500">{label}</p>
      </div>
      <Badge variant="outline" className={`text-[10px] ${inRange ? "border-green-300 text-green-700 bg-green-50" : "border-amber-300 text-amber-700 bg-amber-50"}`}>
        {inRange ? "On target" : value < target.min ? "Below" : "Above"}
      </Badge>
    </div>
  );
};

const ProgressStep: React.FC<{
  step: number;
  label: string;
  active: boolean;
  completed: boolean;
}> = ({ step, label, active, completed }) => (
  <div className="flex items-center gap-2">
    <div className={`
      w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
      ${completed ? "bg-green-600 text-white" : active ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-500"}
    `}>
      {completed ? <CheckCircle2 className="w-4 h-4" /> : step}
    </div>
    <span className={`text-sm ${active || completed ? "font-medium text-gray-900" : "text-gray-400"}`}>
      {label}
    </span>
  </div>
);

// ==================== MAIN COMPONENT ====================

const PersonalizedDietChart: React.FC = () => {
  const navigate = useNavigate();

  // --- State ---
  const [patientId, setPatientId] = useState("");
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [patientList, setPatientList] = useState<PatientListItem[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const [numDays, setNumDays] = useState(7);
  const [dietChart, setDietChart] = useState<GeneratedDietChart | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  const [selectedRecipe, setSelectedRecipe] = useState<RecipeBasic | null>(null);
  const [recipeDetail, setRecipeDetail] = useState<RecipeDetail | null>(null);
  const [isLoadingRecipeDetail, setIsLoadingRecipeDetail] = useState(false);
  const [showRecipeDialog, setShowRecipeDialog] = useState(false);

  const [flavorSuggestions, setFlavorSuggestions] = useState<FlavorSuggestion[]>([]);
  const [isLoadingFlavor, setIsLoadingFlavor] = useState(false);
  const [showFlavorDialog, setShowFlavorDialog] = useState(false);
  const [flavorRecipeName, setFlavorRecipeName] = useState("");

  const [activeDay, setActiveDay] = useState(0);

  // --- Auto-fetch patients on mount ---
  useEffect(() => {
    fetchPatients();
  }, []);

  // --- Fetch patient list ---
  const fetchPatients = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setIsLoadingPatients(true);
    try {
      const consultationQuery = query(
        collection(db, "consultationRequests"),
        where("doctorId", "==", currentUser.uid),
        where("status", "==", "accepted")
      );
      const snap = await getDocs(consultationQuery);
      const patients: PatientListItem[] = [];

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        let profile = data.fullPatientProfile || { name: data.patientName || "Unknown" };

        if (data.patientId) {
          try {
            const patientDoc = await getDoc(doc(db, "patients", data.patientId));
            if (patientDoc.exists()) {
              const pd = patientDoc.data();
              profile = {
                ...profile,
                patientId: pd.patientId || data.patientId,
                name: pd.name || profile.name,
                assessmentData: pd.assessmentData || profile.assessmentData,
                ...(pd.assessmentData && { gender: pd.assessmentData.gender || profile.gender }),
              };
            }
          } catch { /* continue */ }
        }

        patients.push({
          firebaseId: data.patientId,
          customPatientId: profile.patientId || data.patientId,
          patientName: data.patientName || profile.name || "Unknown",
          fullPatientProfile: profile,
        });
      }

      setPatientList(patients);
    } catch (err) {
      console.error("Error fetching patients:", err);
    } finally {
      setIsLoadingPatients(false);
    }
  }, []);

  // --- Load patient profile ---
  const loadPatientProfile = useCallback(
    async (selectedId: string) => {
      if (!selectedId) return;
      setIsLoadingProfile(true);
      setPatientProfile(null);
      setDietChart(null);
      setSavedPlanId(null);
      setSavedStatus(null);

      try {
        let found = patientList.find(
          (p) => p.customPatientId === selectedId || p.firebaseId === selectedId
        );
        if (!found) {
          await fetchPatients();
          found = patientList.find(
            (p) => p.customPatientId === selectedId || p.firebaseId === selectedId
          );
        }
        if (!found) {
          toast.error("Patient not found in accepted consultations.");
          return;
        }

        const raw = found.fullPatientProfile as Record<string, unknown>;
        const assessment = (raw.assessmentData || {}) as Record<string, unknown>;
        const merged = { ...raw, ...assessment };

        const profile: PatientProfile = {
          name: (merged.name as string) || found.patientName,
          gender: (merged.gender as string) || "",
          dob: (merged.dob as string) || (merged.dateOfBirth as string) || "",
          lifeStage: ((merged.lifeStage as string) as LifeStage) || "not_applicable",
          pregnancyTrimester: (merged.pregnancyTrimester as string) || "",
          isBreastfeeding: (merged.isBreastfeeding as string) || "",
          menopauseStage: (merged.menopauseStage as string) || "",
          allergies: Array.isArray(merged.allergies) ? (merged.allergies as string[]) : [],
          allergiesOther: (merged.allergiesOther as string) || "",
          foodAvoidances: (merged.foodAvoidances as string) || "",
          dietaryPreferences: (merged.dietaryPreferences as string) || (merged.dietaryPreference as string) || "",
          currentConditions: Array.isArray(merged.currentConditions) ? (merged.currentConditions as string[]) : [],
          healthGoals: Array.isArray(merged.healthGoals) ? (merged.healthGoals as string[]) : [],
          bodyFrame: (merged.bodyFrame as string) || "",
          skinType: (merged.skinType as string) || "",
          hairType: (merged.hairType as string) || "",
          appetitePattern: (merged.appetitePattern as string) || "",
          personalityTraits: Array.isArray(merged.personalityTraits) ? (merged.personalityTraits as string[]) : [],
          weatherPreference: (merged.weatherPreference as string) || "",
          digestionIssues: Array.isArray(merged.digestionIssues) ? (merged.digestionIssues as string[]) : [],
          energyLevels: Number(merged.energyLevels) || 3,
          stressLevels: Number(merged.stressLevels) || 3,
          physicalActivity: (merged.physicalActivity as string) || "",
          sleepDuration: (merged.sleepDuration as string) || "",
        };

        setPatientProfile(profile);
        setPatientId(selectedId);
        toast.success(`Profile loaded: ${profile.name}`);
      } catch (err) {
        console.error("Error loading patient profile:", err);
        toast.error("Failed to load patient profile");
      } finally {
        setIsLoadingProfile(false);
      }
    },
    [patientList, fetchPatients]
  );

  // --- Generate ---
  const handleGenerate = useCallback(async () => {
    if (!patientProfile) { toast.error("Select a patient first"); return; }
    if (!patientProfile.bodyFrame || !patientProfile.skinType) {
      toast.error("Patient assessment incomplete. Body frame and skin type are required.");
      return;
    }
    setIsGenerating(true);
    setDietChart(null);
    setActiveDay(0);
    setSavedPlanId(null);
    setSavedStatus(null);
    try {
      const chart = await generateDietChart(patientProfile, numDays);
      setDietChart(chart);
      toast.success(`${chart.days.length}-day plan generated (${chart.primaryDosha.toUpperCase()} dosha)`);
    } catch (err) {
      console.error("Error generating diet chart:", err);
      toast.error("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [patientProfile, numDays]);

  // --- View recipe ---
  const handleViewRecipe = useCallback(async (recipe: RecipeBasic) => {
    setSelectedRecipe(recipe);
    setShowRecipeDialog(true);
    setIsLoadingRecipeDetail(true);
    setRecipeDetail(null);
    try {
      const [recipeDataRes, instructionsRes] = await Promise.all([
        searchRecipeById(recipe.Recipe_id || recipe._id).catch(() => null),
        getInstructionsByRecipeId(recipe.Recipe_id || recipe._id).catch(() => null),
      ]);

      // searchRecipeById returns { recipe, ingredients } — extract .recipe
      const fullRecipe = recipeDataRes?.recipe || recipe;

      // getInstructionsByRecipeId returns { recipe_id, steps[] } — join steps
      const instructionText =
        instructionsRes?.steps && Array.isArray(instructionsRes.steps) && instructionsRes.steps.length > 0
          ? instructionsRes.steps.map((step: string, i: number) => `${i + 1}. ${step}`).join("\n")
          : recipe.instructions || "Instructions not available.";

      setRecipeDetail({
        recipe: fullRecipe,
        instructions: instructionText,
      });
    } catch {
      setRecipeDetail({ recipe, instructions: recipe.instructions || "Could not load instructions." });
    } finally {
      setIsLoadingRecipeDetail(false);
    }
  }, []);

  // --- Enhance flavor (uses built-in Ayurvedic flavor data) ---
  const handleEnhanceFlavor = useCallback(async (recipe: RecipeBasic) => {
    setFlavorRecipeName(recipe.Recipe_title);
    setShowFlavorDialog(true);
    setIsLoadingFlavor(true);
    setFlavorSuggestions([]);
    const excludeSet = new Set(patientProfile ? buildExcludeIngredients(patientProfile) : []);
    try {
      const allSuggestions: FlavorSuggestion[] = [];
      const flavors = ["sweet", "sour", "bitter", "salty"] as const;

      for (const flavor of flavors) {
        const fallbackItems = FLAVOR_FALLBACK[flavor] || [];
        const filtered = fallbackItems
          .filter((item) => !excludeSet.has(item.ingredient.toLowerCase()))
          .slice(0, 5)
          .map((item) => ({
            ingredient: item.generic_name,
            flavor,
            category: item.category,
          }));
        allSuggestions.push(...filtered);
      }

      setFlavorSuggestions(allSuggestions);
      if (allSuggestions.length === 0) toast.info("No flavor suggestions available.");
    } catch { toast.error("Failed to fetch flavor suggestions"); }
    finally { setIsLoadingFlavor(false); }
  }, [patientProfile]);

  // --- Save ---
  const handleSave = useCallback(async (status: "draft" | "final") => {
    if (!dietChart || !patientId) return;
    setIsSaving(true);
    try {
      const planId = crypto.randomUUID();
      const planData = {
        patientName: dietChart.patientName,
        patientId,
        planDuration: `${numDays} days`,
        planType: "personalized-diet-chart",
        status,
        createdBy: auth.currentUser?.uid || "",
        createdAt: serverTimestamp(),
        lastModified: serverTimestamp(),
        source: "personalized-diet-chart",
        primaryDosha: dietChart.primaryDosha,
        doshaScores: dietChart.doshaScores,
        lifeStage: dietChart.lifeStage,
        lifeStageLabel: dietChart.lifeStageLabel,
        nutritionalTargets: dietChart.nutritionalTargets,
        doshaRecommendations: dietChart.doshaRecommendations,
        medicalNotes: dietChart.medicalNotes,
        excludedIngredients: dietChart.excludedIngredients,
        days: dietChart.days.map((day) => ({
          dayNumber: day.dayNumber,
          dayLabel: day.dayLabel,
          totalCalories: day.totalCalories,
          totalProtein: day.totalProtein,
          totalCarbs: day.totalCarbs,
          totalFat: day.totalFat,
          meals: day.meals.map((meal) => ({
            mealType: meal.mealType,
            label: meal.label,
            time: meal.time,
            targetCalories: meal.targetCalories,
            actualCalories: meal.actualCalories,
            recipeName: meal.recipe.Recipe_title || "",
            recipeId: meal.recipe.Recipe_id || meal.recipe._id || "",
            calories: meal.recipe.Calories || 0,
            protein: meal.recipe["Protein (g)"] || 0,
            carbs: meal.recipe["Carbohydrate, by difference (g)"] || 0,
            fat: meal.recipe["Total lipid (fat) (g)"] || 0,
            region: meal.recipe.Region || "",
            cookTime: meal.recipe.cook_time || "",
            isVegan: meal.recipe.vegan || "0",
            isVegetarian: meal.recipe.lacto_vegetarian || "0",
          })),
        })),
        generatedAt: dietChart.generatedAt,
      };
      await setDoc(doc(db, `patients/${patientId}/dietPlans/${planId}`), planData);
      setSavedPlanId(planId);
      setSavedStatus(status);
      toast.success(status === "final" ? "Diet chart approved and saved." : "Draft saved. You can edit it in Recipe Builder.");
    } catch (err) {
      console.error("Error saving diet chart:", err);
      toast.error("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [dietChart, patientId, numDays]);

  // --- Navigate to Recipe Builder for editing ---
  const handleEditInRecipeBuilder = useCallback(() => {
    if (!savedPlanId || !patientId) return;
    navigate(`/doctor/recipes?editPlanId=${savedPlanId}&patientId=${patientId}`);
  }, [savedPlanId, patientId, navigate]);

  // --- Computed analysis ---
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

  const currentStep = !patientProfile ? 1 : !dietChart ? 2 : 3;

  // ==================== RENDER ====================

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-[1440px] mx-auto">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Personalized Diet Chart</h1>
              <p className="text-sm text-gray-500">Evidence-based, dosha-personalized nutrition planning</p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-6">
          <ProgressStep step={1} label="Patient" active={currentStep === 1} completed={currentStep > 1} />
          <div className="w-8 h-px bg-gray-300" />
          <ProgressStep step={2} label="Generate" active={currentStep === 2} completed={currentStep > 2} />
          <div className="w-8 h-px bg-gray-300" />
          <ProgressStep step={3} label="Review & Save" active={currentStep === 3} completed={!!savedPlanId} />
        </div>
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
          <div className="flex gap-3 items-end">
            <div className="flex-1 max-w-xs">
              <Label className="text-xs text-gray-500 uppercase tracking-wide">Patient ID</Label>
              <Input
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="e.g., P001"
                className="mt-1"
              />
            </div>
            <Button
              onClick={() => loadPatientProfile(patientId.trim())}
              disabled={!patientId.trim() || isLoadingProfile}
              size="sm"
            >
              {isLoadingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Search className="w-4 h-4 mr-1.5" />}
              Load
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchPatients} disabled={isLoadingPatients}>
              <RefreshCw className={`w-4 h-4 ${isLoadingPatients ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {patientList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {patientList.map((p) => (
                <button
                  key={p.firebaseId}
                  onClick={() => { setPatientId(p.customPatientId); loadPatientProfile(p.customPatientId); }}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                    ${patientId === p.customPatientId
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}
                  `}
                >
                  {p.patientName} ({p.customPatientId})
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== PATIENT PROFILE SUMMARY ===== */}
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
                      <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">{s}</span>
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
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 mb-1">Excluded ({profileAnalysis.excludes.length})</p>
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
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-green-600 mb-1">Focus ({profileAnalysis.includes.length})</p>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                    {profileAnalysis.includes.slice(0, 12).map((i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-100">{i}</span>
                    ))}
                    {profileAnalysis.includes.length > 12 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">+{profileAnalysis.includes.length - 12}</span>
                    )}
                  </div>
                </div>
                {patientProfile.dietaryPreferences && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <Apple className="w-3 h-3 text-green-600" />
                    <span className="text-xs capitalize font-medium">{patientProfile.dietaryPreferences}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Medical Notes */}
          {profileAnalysis.targets.notes.length > 0 && (
            <Card className="shadow-sm border-blue-100 bg-blue-50/30">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-900">Clinical Guidelines</span>
                </div>
                <div className="grid md:grid-cols-2 gap-x-6 gap-y-1.5">
                  {profileAnalysis.targets.notes.map((note, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-blue-800">
                      <CircleDot className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                      {note}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ===== GENERATE CONTROLS ===== */}
      {patientProfile && (
        <Card className="shadow-sm">
          <CardContent className="py-5">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Duration</Label>
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

              {dietChart && !savedPlanId && (
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" size="sm" onClick={() => handleSave("draft")} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Save className="w-3 h-3 mr-1.5" />}
                    Save Draft
                  </Button>
                  <Button size="sm" onClick={() => handleSave("final")} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <CheckCircle2 className="w-3 h-3 mr-1.5" />}
                    Approve & Save
                  </Button>
                </div>
              )}

              {savedPlanId && (
                <div className="flex items-center gap-3 ml-auto">
                  <Badge className={savedStatus === "final" ? "bg-green-100 text-green-800 border-green-200" : "bg-amber-100 text-amber-800 border-amber-200"}>
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {savedStatus === "final" ? "Approved" : "Draft Saved"}
                  </Badge>
                  {savedStatus === "draft" && (
                    <Button variant="outline" size="sm" onClick={handleEditInRecipeBuilder} className="gap-1.5">
                      <FileEdit className="w-3.5 h-3.5" />
                      Edit in Recipe Builder
                      <ExternalLink className="w-3 h-3 ml-1 text-gray-400" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => window.print()}>
                    <Printer className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== LOADING STATE ===== */}
      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="relative">
            <Loader2 className="w-10 h-10 text-gray-300 animate-spin" />
            <Leaf className="w-4 h-4 text-green-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm font-medium text-gray-700">Generating {numDays}-day personalized plan...</p>
          <p className="text-xs text-gray-400">Fetching recipes from FoodOScope API with dosha and life-stage filters</p>
        </div>
      )}

      {/* ===== GENERATED CHART ===== */}
      {dietChart && (
        <div className="space-y-6">
          {/* Report Header */}
          <Card className="shadow-sm border-l-4 border-l-green-500">
            <CardContent className="py-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <Leaf className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{dietChart.patientName}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] font-semibold uppercase">{dietChart.primaryDosha} Dosha</Badge>
                      <Badge variant="outline" className="text-[10px] bg-pink-50 text-pink-700 border-pink-200">{dietChart.lifeStageLabel}</Badge>
                      <Badge variant="outline" className="text-[10px]">
                        <Calendar className="w-2.5 h-2.5 mr-1" />{dietChart.days.length} Days
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-400 space-y-0.5">
                  <p>Generated {new Date(dietChart.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
                  <p>Target: {dietChart.nutritionalTargets.calories.min}-{dietChart.nutritionalTargets.calories.max} kcal/day</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dosha Recommendations */}
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold">Dosha Recommendations</span>
                <span className="text-xs text-gray-400 capitalize">({dietChart.primaryDosha})</span>
              </div>
              <p className="text-xs text-gray-600 mb-3">{dietChart.doshaRecommendations.description}</p>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 mb-1">Spices</p>
                  <div className="flex flex-wrap gap-1">
                    {dietChart.doshaRecommendations.spices.map((s) => (
                      <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 mb-1">Cooking</p>
                  <div className="flex flex-wrap gap-1">
                    {dietChart.doshaRecommendations.cookingMethods.map((m) => (
                      <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{m}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600 mb-1">Avoid</p>
                  <div className="flex flex-wrap gap-1">
                    {dietChart.doshaRecommendations.avoidFoods.map((f) => (
                      <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">{f}</span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Day Tabs */}
          <Tabs value={String(activeDay)} onValueChange={(v) => setActiveDay(Number(v))}>
            <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
              {dietChart.days.map((day, idx) => (
                <TabsTrigger
                  key={idx}
                  value={String(idx)}
                  className="data-[state=active]:bg-gray-900 data-[state=active]:text-white rounded-lg px-4 py-2 border text-xs"
                >
                  <div className="text-center">
                    <div className="font-semibold">{day.dayLabel}</div>
                    <div className="opacity-70 tabular-nums">{day.totalCalories} kcal</div>
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>

            {dietChart.days.map((day, dayIdx) => (
              <TabsContent key={dayIdx} value={String(dayIdx)} className="mt-4 space-y-4">
                {/* Macro Rings */}
                <Card className="shadow-sm">
                  <CardContent className="py-5">
                    <div className="flex justify-around">
                      <MacroRing
                        value={day.totalCalories}
                        target={{ min: dietChart.nutritionalTargets.calories.min, max: dietChart.nutritionalTargets.calories.max }}
                        label="Calories" unit="kcal" color="#f97316"
                        icon={<Flame className="w-4 h-4 text-orange-500" />}
                      />
                      <MacroRing
                        value={day.totalProtein}
                        target={{ min: dietChart.nutritionalTargets.protein.min, max: dietChart.nutritionalTargets.protein.max }}
                        label="Protein" unit="g" color="#3b82f6"
                        icon={<Activity className="w-4 h-4 text-blue-500" />}
                      />
                      <MacroRing
                        value={day.totalCarbs}
                        target={{ min: 200, max: 350 }}
                        label="Carbs" unit="g" color="#f59e0b"
                        icon={<Apple className="w-4 h-4 text-amber-500" />}
                      />
                      <MacroRing
                        value={day.totalFat}
                        target={{ min: 44, max: 78 }}
                        label="Fat" unit="g" color="#8b5cf6"
                        icon={<Utensils className="w-4 h-4 text-purple-500" />}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Meal Cards */}
                <div className="space-y-2">
                  {day.meals.map((meal, mealIdx) => (
                    <Card key={mealIdx} className="shadow-sm hover:shadow transition-shadow">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-4">
                          {/* Time */}
                          <div className="w-16 text-center shrink-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{meal.label}</p>
                            <p className="text-xs font-medium text-gray-700">{meal.time}</p>
                          </div>

                          <Separator orientation="vertical" className="h-10" />

                          {/* Recipe Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 truncate">{meal.recipe.Recipe_title}</h4>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                              {meal.recipe.Region && <span>{meal.recipe.Region}</span>}
                              {meal.recipe.cook_time && (
                                <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{meal.recipe.cook_time}</span>
                              )}
                              {meal.recipe.lacto_vegetarian === "1" && <span className="text-green-600 font-medium">Veg</span>}
                              {meal.recipe.vegan === "1" && <span className="text-emerald-600 font-medium">Vegan</span>}
                            </div>
                          </div>

                          {/* Nutrition Badges */}
                          <div className="hidden md:flex items-center gap-1.5 shrink-0">
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="text-[10px] px-2 py-1 rounded bg-orange-50 text-orange-700 font-semibold tabular-nums">
                                  {meal.actualCalories} kcal
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Target: {meal.targetCalories} kcal</TooltipContent>
                            </Tooltip>
                            {meal.recipe["Protein (g)"] && (
                              <span className="text-[10px] px-2 py-1 rounded bg-blue-50 text-blue-700 tabular-nums">
                                {Number(meal.recipe["Protein (g)"]).toFixed(0)}g P
                              </span>
                            )}
                            {meal.recipe["Carbohydrate, by difference (g)"] && (
                              <span className="text-[10px] px-2 py-1 rounded bg-amber-50 text-amber-700 tabular-nums">
                                {Number(meal.recipe["Carbohydrate, by difference (g)"]).toFixed(0)}g C
                              </span>
                            )}
                            {meal.recipe["Total lipid (fat) (g)"] && (
                              <span className="text-[10px] px-2 py-1 rounded bg-purple-50 text-purple-700 tabular-nums">
                                {Number(meal.recipe["Total lipid (fat) (g)"]).toFixed(0)}g F
                              </span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleViewRecipe(meal.recipe)}>
                              <BookOpen className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-600" onClick={() => handleEnhanceFlavor(meal.recipe)}>
                              <Sparkles className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {day.meals.length === 0 && (
                    <Card className="border-amber-200 bg-amber-50 shadow-sm">
                      <CardContent className="py-8 text-center">
                        <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                        <p className="text-sm text-amber-700">No recipes found for this day. Try regenerating.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Compliance Table */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-400" />
                <CardTitle className="text-sm">Compliance Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Day</TableHead>
                    <TableHead className="text-right">Calories</TableHead>
                    <TableHead className="text-right">Protein</TableHead>
                    <TableHead className="text-right">Carbs</TableHead>
                    <TableHead className="text-right">Fat</TableHead>
                    <TableHead className="text-right">Meals</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dietChart.days.map((day) => {
                    const t = dietChart.nutritionalTargets.calories;
                    const ok = day.totalCalories >= t.min * 0.85 && day.totalCalories <= t.max * 1.15;
                    return (
                      <TableRow key={day.dayNumber} className="text-xs">
                        <TableCell className="font-medium">{day.dayLabel}</TableCell>
                        <TableCell className="text-right tabular-nums">{day.totalCalories}</TableCell>
                        <TableCell className="text-right tabular-nums">{day.totalProtein}g</TableCell>
                        <TableCell className="text-right tabular-nums">{day.totalCarbs}g</TableCell>
                        <TableCell className="text-right tabular-nums">{day.totalFat}g</TableCell>
                        <TableCell className="text-right">{day.meals.length}/5</TableCell>
                        <TableCell className="text-center">
                          {ok ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700"><CheckCircle2 className="w-3 h-3" />Target</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600"><AlertTriangle className="w-3 h-3" />Review</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Collapsible Details */}
          <Accordion type="single" collapsible>
            <AccordionItem value="excluded">
              <AccordionTrigger className="text-xs font-medium py-3">
                <span className="flex items-center gap-2"><XCircle className="w-3.5 h-3.5 text-red-400" />Excluded Ingredients ({dietChart.excludedIngredients.length})</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-1">
                  {dietChart.excludedIngredients.map((ing) => (
                    <span key={ing} className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">{ing}</span>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="notes">
              <AccordionTrigger className="text-xs font-medium py-3">
                <span className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-blue-400" />Medical Notes ({dietChart.medicalNotes.length})</span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1.5">
                  {dietChart.medicalNotes.map((note, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-gray-600">
                      <CircleDot className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />{note}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Methodology Footer */}
          <div className="border-t pt-4 text-[10px] text-gray-400 space-y-1">
            <p><strong>Methodology:</strong> Recipes sourced from FoodOScope RecipeDB (118K+ recipes). Nutritional targets based on ACOG, WHO, and NAMS clinical guidelines. Dosha determination via Ayurvedic constitutional assessment (Prakriti analysis). Ingredient exclusion filters applied for allergies, life-stage contraindications, and dosha-specific avoidances.</p>
            <p><strong>Disclaimer:</strong> This diet chart is a clinical decision-support tool. It does not replace professional medical judgment. Always review and adjust based on individual patient assessment.</p>
          </div>
        </div>
      )}

      {/* ===== RECIPE DETAIL DIALOG ===== */}
      <Dialog open={showRecipeDialog} onOpenChange={setShowRecipeDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ChefHat className="w-4 h-4 text-green-600" />
              {selectedRecipe?.Recipe_title || "Recipe Details"}
            </DialogTitle>
            <DialogDescription>Full nutrition, preparation instructions, and dietary information.</DialogDescription>
          </DialogHeader>

          {isLoadingRecipeDetail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : recipeDetail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Calories", value: recipeDetail.recipe.Calories, color: "text-orange-600 bg-orange-50" },
                  { label: "Protein (g)", value: recipeDetail.recipe["Protein (g)"], color: "text-blue-600 bg-blue-50" },
                  { label: "Carbs (g)", value: recipeDetail.recipe["Carbohydrate, by difference (g)"], color: "text-amber-600 bg-amber-50" },
                  { label: "Fat (g)", value: recipeDetail.recipe["Total lipid (fat) (g)"], color: "text-purple-600 bg-purple-50" },
                ].map((n) => (
                  <div key={n.label} className={`rounded-lg p-3 text-center ${n.color}`}>
                    <p className="text-lg font-bold">{n.value || "N/A"}</p>
                    <p className="text-[10px]">{n.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {recipeDetail.recipe.Region && <Badge variant="outline" className="text-xs">{recipeDetail.recipe.Region}</Badge>}
                {recipeDetail.recipe.cook_time && <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />{recipeDetail.recipe.cook_time}</Badge>}
                {recipeDetail.recipe.prep_time && <Badge variant="outline" className="text-xs">Prep: {recipeDetail.recipe.prep_time}</Badge>}
                {recipeDetail.recipe.servings && <Badge variant="outline" className="text-xs">{recipeDetail.recipe.servings} srv</Badge>}
                {recipeDetail.recipe.Utensils && <Badge variant="outline" className="text-xs"><Utensils className="w-3 h-3 mr-1" />{recipeDetail.recipe.Utensils}</Badge>}
              </div>

              <div className="flex gap-1.5">
                {recipeDetail.recipe.vegan === "1" && <Badge className="bg-emerald-100 text-emerald-800 text-xs">Vegan</Badge>}
                {recipeDetail.recipe.lacto_vegetarian === "1" && <Badge className="bg-green-100 text-green-800 text-xs">Vegetarian</Badge>}
                {recipeDetail.recipe.pescetarian === "1" && <Badge className="bg-cyan-100 text-cyan-800 text-xs">Pescetarian</Badge>}
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Instructions</h4>
                <div className="bg-gray-50 rounded-lg p-4 text-xs whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {recipeDetail.instructions}
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full" onClick={() => { setShowRecipeDialog(false); handleEnhanceFlavor(recipeDetail.recipe); }}>
                <Sparkles className="w-3.5 h-3.5 mr-2 text-amber-500" />Enhance Flavor with FlavorDB
              </Button>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4 text-sm">Could not load recipe details.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== FLAVOR DIALOG ===== */}
      <Dialog open={showFlavorDialog} onOpenChange={setShowFlavorDialog}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-amber-500" />Flavor Enhancement
            </DialogTitle>
            <DialogDescription>FlavorDB suggestions for <strong>{flavorRecipeName}</strong>, filtered by patient restrictions.</DialogDescription>
          </DialogHeader>

          {isLoadingFlavor ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            </div>
          ) : flavorSuggestions.length > 0 ? (
            <div className="space-y-4">
              {["sweet", "sour", "bitter", "salty", "umami", "pungent"].map((flavor) => {
                const items = flavorSuggestions.filter((s) => s.flavor === flavor);
                if (items.length === 0) return null;
                const colors: Record<string, string> = {
                  sweet: "bg-pink-50 border-pink-200 text-pink-700",
                  sour: "bg-yellow-50 border-yellow-200 text-yellow-700",
                  bitter: "bg-green-50 border-green-200 text-green-700",
                  salty: "bg-blue-50 border-blue-200 text-blue-700",
                  umami: "bg-red-50 border-red-200 text-red-700",
                  pungent: "bg-orange-50 border-orange-200 text-orange-700",
                };
                return (
                  <div key={flavor}>
                    <p className="text-xs font-semibold capitalize mb-1.5">{flavor}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((item, idx) => (
                        <span key={idx} className={`text-[11px] px-2 py-0.5 rounded border ${colors[flavor] || ""}`}>
                          {item.ingredient}
                          {item.category !== "General" && <span className="opacity-50 ml-1">({item.category})</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4 text-sm">No suggestions available.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PersonalizedDietChart;
