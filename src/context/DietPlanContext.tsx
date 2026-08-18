// One source of truth for the patient's plans and today's meals.
//
// "Today" and the plan hub are separate routes now, so the thing that makes
// them feel like one screen is that they read and write the same state: pick a
// plan under Plans and Today is already following it, mark a meal eaten on
// Today and Progress counts it, without either page refetching.
//
// This also replaces the duplicated loading that used to live in
// PatientDashboard and MealLogging, which fetched the same rows separately and
// disagreed about which plan was current.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/lib/supabase";
import { isPreviewMode } from "@/lib/previewMode";
import { PREVIEW_ALL_PLANS, PREVIEW_DIET_PLAN_DOC } from "@/lib/previewMockData";
import {
  activePlanStorageKey,
  dayKey,
  planToTodaysMeals,
  summarise,
  TRACKING_STORAGE_KEY,
  type DietPlanDoc,
  type MealStatus,
  type TodayStats,
  type TrackedMeal,
} from "@/lib/dietPlan";

export interface DayTracking {
  eaten: number;
  total: number;
  calories: number;
}

interface DietPlanContextValue {
  plans: DietPlanDoc[];
  activePlan: DietPlanDoc | null;
  loadingPlans: boolean;
  /** Follow this plan from now on — Today re-derives from it immediately. */
  activatePlan: (plan: DietPlanDoc) => void;
  /** Called after saving a newly generated plan; activates it too. */
  addPlan: (plan: DietPlanDoc) => void;
  todaysMeals: TrackedMeal[];
  todayStats: TodayStats;
  updateMealStatus: (mealId: string, status: MealStatus) => void;
  replaceMeal: (mealId: string, next: TrackedMeal) => void;
  trackingHistory: Record<string, DayTracking>;
}

const DietPlanContext = createContext<DietPlanContextValue | null>(null);

const rowToPlan = (row: any): DietPlanDoc => ({
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
});

export function DietPlanProvider({ children }: { children: ReactNode }) {
  const { user } = useApp();
  const userId = user?.id ?? null;

  const [plans, setPlans] = useState<DietPlanDoc[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [todaysMeals, setTodaysMeals] = useState<TrackedMeal[]>([]);
  const [trackingHistory, setTrackingHistory] = useState<Record<string, DayTracking>>({});

  // ── Load the patient's plans ──
  useEffect(() => {
    if (!userId) return;

    if (isPreviewMode()) {
      setPlans(PREVIEW_ALL_PLANS as unknown as DietPlanDoc[]);
      setActivePlanId((PREVIEW_DIET_PLAN_DOC as unknown as DietPlanDoc).id);
      setLoadingPlans(false);
      return;
    }

    let cancelled = false;
    setLoadingPlans(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("diet_plans")
          .select("*")
          .eq("patient_id", userId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (cancelled) return;

        const loaded = (data ?? []).map(rowToPlan);
        setPlans(loaded);

        // Prefer the plan she last chose to follow; fall back to the newest.
        // Without this the choice reset to "most recent" on every reload, so
        // activating an older plan never survived leaving the page.
        const remembered = localStorage.getItem(activePlanStorageKey(userId));
        const stillExists = loaded.some((p) => p.id === remembered);
        setActivePlanId(stillExists ? remembered : loaded[0]?.id ?? null);
      } catch (e) {
        console.error("Error loading diet plans:", e);
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) ?? null,
    [plans, activePlanId]
  );

  // ── Derive today's meals from the active plan, then restore saved statuses ──
  useEffect(() => {
    const meals = planToTodaysMeals(activePlan);
    if (meals.length === 0) {
      setTodaysMeals([]);
      return;
    }

    const today = dayKey();

    // localStorage first so the list paints with the right ticks immediately.
    let local: Record<string, string> = {};
    try {
      local = JSON.parse(localStorage.getItem(`${TRACKING_STORAGE_KEY}_${today}`) ?? "{}");
    } catch {
      /* a corrupt cache is not worth failing the page over */
    }
    setTodaysMeals(
      meals.map((m) => (local[m.id] ? { ...m, status: local[m.id] as MealStatus } : m))
    );

    // meal_tracking is the durable record — localStorage is per-browser, so on
    // another device every meal would otherwise read as pending.
    if (!userId || isPreviewMode()) return;
    let cancelled = false;
    void supabase
      .from("meal_tracking")
      .select("statuses")
      .eq("patient_id", userId)
      .eq("date", today)
      .maybeSingle()
      .then(({ data }) => {
        const saved = (data?.statuses as Record<string, string>) ?? {};
        if (cancelled || Object.keys(saved).length === 0) return;
        setTodaysMeals((prev) =>
          prev.map((m) => (saved[m.id] ? { ...m, status: saved[m.id] as MealStatus } : m))
        );
      });

    return () => {
      cancelled = true;
    };
  }, [activePlan, userId]);

  // ── Last week's completion, for Progress ──
  useEffect(() => {
    const history: Record<string, DayTracking> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      const saved = localStorage.getItem(`${TRACKING_STORAGE_KEY}_${key}`);
      if (!saved) continue;
      try {
        const entries = Object.entries(JSON.parse(saved) as Record<string, string>);
        if (entries.length === 0) continue;
        history[key] = {
          eaten: entries.filter(([, v]) => v === "eaten").length,
          total: entries.length,
          calories: Number(localStorage.getItem(`${TRACKING_STORAGE_KEY}_cal_${key}`) || 0),
        };
      } catch {
        /* skip an unreadable day rather than dropping the whole week */
      }
    }
    setTrackingHistory(history);
  }, [todaysMeals]);

  const activatePlan = useCallback(
    (plan: DietPlanDoc) => {
      setActivePlanId(plan.id);
      if (userId) localStorage.setItem(activePlanStorageKey(userId), plan.id);
    },
    [userId]
  );

  const addPlan = useCallback(
    (plan: DietPlanDoc) => {
      setPlans((prev) => [plan, ...prev]);
      activatePlan(plan);
    },
    [activatePlan]
  );

  const updateMealStatus = useCallback(
    (mealId: string, status: MealStatus) => {
      setTodaysMeals((prev) => {
        const updated = prev.map((m) => (m.id === mealId ? { ...m, status } : m));

        const today = dayKey();
        const statuses: Record<string, string> = {};
        let caloriesConsumed = 0;
        for (const m of updated) {
          statuses[m.id] = m.status;
          if (m.status === "eaten") caloriesConsumed += m.calories;
        }
        localStorage.setItem(`${TRACKING_STORAGE_KEY}_${today}`, JSON.stringify(statuses));
        localStorage.setItem(`${TRACKING_STORAGE_KEY}_cal_${today}`, String(caloriesConsumed));

        if (userId && !isPreviewMode()) {
          void supabase
            .from("meal_tracking")
            .upsert(
              {
                patient_id: userId,
                date: today,
                statuses,
                calories_consumed: caloriesConsumed,
                total_meals: updated.length,
                eaten_count: updated.filter((m) => m.status === "eaten").length,
                skipped_count: updated.filter((m) => m.status === "skipped").length,
              },
              { onConflict: "patient_id,date" }
            )
            .then(({ error }) => {
              if (error) console.error("Failed to save meal tracking:", error);
            });
        }

        return updated;
      });
    },
    [userId]
  );

  /** Swap keeps the meal's id so the day's tracking stays continuous. */
  const replaceMeal = useCallback((mealId: string, next: TrackedMeal) => {
    setTodaysMeals((prev) =>
      prev.map((m) => (m.id === mealId ? { ...next, id: mealId, status: "pending" } : m))
    );
  }, []);

  const todayStats = useMemo(() => summarise(todaysMeals), [todaysMeals]);

  const value = useMemo(
    () => ({
      plans,
      activePlan,
      loadingPlans,
      activatePlan,
      addPlan,
      todaysMeals,
      todayStats,
      updateMealStatus,
      replaceMeal,
      trackingHistory,
    }),
    [
      plans, activePlan, loadingPlans, activatePlan, addPlan,
      todaysMeals, todayStats, updateMealStatus, replaceMeal, trackingHistory,
    ]
  );

  return <DietPlanContext.Provider value={value}>{children}</DietPlanContext.Provider>;
}

export function useDietPlan() {
  const ctx = useContext(DietPlanContext);
  if (!ctx) throw new Error("useDietPlan must be used inside a DietPlanProvider");
  return ctx;
}
