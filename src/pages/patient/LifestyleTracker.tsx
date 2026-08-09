import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  Moon,
  Activity,
  Droplets,
  Dumbbell,
  Wind,
  Waves,
  Bike,
  StretchHorizontal,
  Footprints,
  Heart,
  TrendingUp,
  Plus,
  Minus,
  CheckCircle2,
  ArrowLeft,
  Flame,
  Loader2,
  Youtube,
  FlaskConical,
  Trash2,
  AlertTriangle,
  Utensils,
  ClipboardCheck,
  CloudOff,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_WATER_GOAL,
  activeDates,
  currentStreak,
  emptyDayLog,
  hydratedDates,
  isHydrationGoalMet,
  lastNDates,
  longestStreak,
  todayIso,
  totalActivityMinutes,
  weeklyAverages,
  type LifestyleDayLog,
  type SleepQuality,
} from "@/lib/lifestyleLog";
import {
  recommendExercises,
  videoUrl,
  type ConditionInput,
  type Exercise,
  type ExerciseIcon,
} from "@/lib/exerciseRecommendations";
import { isDemoModeAvailable } from "@/lib/demoMode";
import {
  buildDemoLogs,
  buildDemoMealTracking,
  DEMO_DAYS,
} from "@/lib/demoLifestyleData";
import {
  evaluateDay,
  summarise,
  type CalorieTarget,
  type DietAdherenceDay,
  type MealTrackingDay,
} from "@/lib/dietAdherence";
import {
  cacheLifestyleDay,
  clearCachedLogs,
  loadLifestyleLogs,
  saveLifestyleDay,
  writeCachedLogs,
} from "@/services/lifestyleLogService";
import { fetchMealTracking } from "@/services/mealAdherenceService";
import {
  fetchScreenings,
  isPregnantPatient,
  type AssessmentData,
} from "@/services/diseaseDetectionService";
import { getNutritionalTargets, type LifeStage } from "@/services/dietChartService";

import { CHART_COLORS } from "@/lib/chartColors";
const SLEEP_QUALITIES: SleepQuality[] = ["deep", "disturbed", "insufficient"];

const EXERCISE_ICONS: Record<ExerciseIcon, typeof Activity> = {
  walk: Footprints,
  yoga: StretchHorizontal,
  breathing: Wind,
  strength: Dumbbell,
  swim: Waves,
  cycle: Bike,
  stretch: StretchHorizontal,
  heart: Heart,
};

// One ramp per intensity so the three stay tellable apart at a glance; the
// badge also spells the word out, so hue is never the only cue.
const INTENSITY_STYLES: Record<string, string> = {
  gentle: "bg-rose-100 text-rose-800 border-rose-200",
  moderate: "bg-coral-100 text-coral-800 border-coral-200",
  brisk: "bg-plum-100 text-plum-800 border-plum-200",
};

const SLEEP_QUALITY_STYLES: Record<string, string> = {
  deep: "bg-rose-100 text-rose-800 border-rose-200",
  disturbed: "bg-coral-100 text-coral-800 border-coral-200",
  insufficient: "bg-red-100 text-red-800 border-red-200",
};

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });

const dayNumber = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    timeZone: "UTC",
  });

/**
 * The patient's one-page lifestyle tracker.
 *
 * Sleep, activity, hydration and diet-plan adherence live in a single view —
 * they are one daily check-in, not four separate ones. Everything logged here
 * is cached locally first and mirrored to Supabase, so the activity streak
 * survives a refresh (and an offline day) rather than resetting.
 */
const LifestyleTracker = () => {
  const navigate = useNavigate();

  const today = todayIso();

  const [patientId, setPatientId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LifestyleDayLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSynced, setIsSynced] = useState(true);
  const [conditions, setConditions] = useState<ConditionInput[]>([]);
  const [isPregnant, setIsPregnant] = useState(false);
  const [calorieTarget, setCalorieTarget] = useState<CalorieTarget>({
    min: 1800,
    max: 2200,
    label: "General Adult",
  });
  const [mealTracking, setMealTracking] = useState<MealTrackingDay[]>([]);

  // Demo data is local-only and clearly flagged; see src/lib/demoMode.ts.
  const demoAvailable = useMemo(() => isDemoModeAvailable(), []);
  const [isDemoData, setIsDemoData] = useState(false);
  const [demoMealTracking, setDemoMealTracking] = useState<MealTrackingDay[] | null>(null);

  // Supabase mirroring is debounced so holding "+" on a water glass doesn't
  // fire an upsert per click; the localStorage cache is written synchronously
  // inside saveLifestyleDay, so nothing is lost if the tab closes first.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      if (!cancelled) setPatientId(user.id);

      // Cached logs render immediately; the Supabase merge lands underneath.
      try {
        const { logs: loaded, synced } = await loadLifestyleLogs(user.id);
        if (!cancelled) {
          setLogs(loaded);
          setIsSynced(synced);
        }
      } catch (error) {
        console.error("Error loading lifestyle logs:", error);
      }

      // Conditions come from two places: what she reported in her profile, and
      // what the maternal screening flagged. Both feed the exercise picks.
      try {
        const { data: patient } = await supabase
          .from("patients")
          .select("assessment_data")
          .eq("id", user.id)
          .maybeSingle();

        const assessment = (patient?.assessment_data as AssessmentData) ?? null;
        const record = (assessment ?? {}) as Record<string, unknown>;

        const reported: ConditionInput[] = [
          ...(Array.isArray(record.currentConditions) ? record.currentConditions : []),
          ...(typeof record.currentConditionsOther === "string"
            ? [record.currentConditionsOther]
            : []),
        ]
          .filter((c): c is string => typeof c === "string" && c.trim() !== "")
          .map((condition) => ({ condition }));

        if (!cancelled) {
          setIsPregnant(isPregnantPatient(assessment));
          setCalorieTarget(
            getNutritionalTargets(
              (record.lifeStage as LifeStage) ?? "not_applicable",
              record.pregnancyTrimester as string | undefined,
              record.isBreastfeeding as string | undefined,
              record.menopauseStage as string | undefined
            ).calories
          );
        }

        // Only moderate/high screening findings shape the plan — a low-risk
        // score is a reassurance, not a condition to train around.
        let screened: ConditionInput[] = [];
        try {
          const screenings = await fetchScreenings(user.id);
          screened = (screenings[0]?.result.conditions ?? [])
            .filter((c) => c.risk_level === "moderate" || c.risk_level === "high")
            .map((c) => ({ condition: c.condition, riskLevel: c.risk_level }));
        } catch (error) {
          console.error("Error loading screening results:", error);
        }

        if (!cancelled) setConditions([...screened, ...reported]);
      } catch (error) {
        console.error("Error loading patient profile:", error);
      }

      // Diet adherence is read from what she logs on the Meal Logging page.
      try {
        const rows = await fetchMealTracking(user.id, lastNDates(7, todayIso())[0]);
        if (!cancelled) setMealTracking(rows);
      } catch (error) {
        console.error("Error loading meal tracking:", error);
      }

      if (!cancelled) setIsLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const todayLog = useMemo(
    () => logs.find((l) => l.date === today) ?? emptyDayLog(today),
    [logs, today]
  );

  /** Apply a change to today's entry, then cache + mirror it. */
  const updateToday = useCallback(
    (mutate: (log: LifestyleDayLog) => LifestyleDayLog) => {
      setLogs((previous) => {
        const existing = previous.find((l) => l.date === today) ?? emptyDayLog(today);
        const updated = mutate(existing);
        const next = [...previous.filter((l) => l.date !== today), updated].sort((a, b) =>
          a.date.localeCompare(b.date)
        );

        if (patientId) {
          if (isDemoData) {
            // Never mirror fabricated data to Supabase — cache only.
            cacheLifestyleDay(patientId, updated);
          } else {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => {
              void saveLifestyleDay(patientId, updated).then((persisted) =>
                setIsSynced(persisted)
              );
            }, 600);
          }
        }

        return next;
      });
    },
    [patientId, today, isDemoData]
  );

  const recommendation = useMemo(
    () => recommendExercises({ conditions, isPregnant }),
    [conditions, isPregnant]
  );

  /** Fill the tracker with a month of fabricated data, cache-only. */
  const loadDemoData = useCallback(() => {
    // Logged against her actual recommended exercises, so the demo month
    // matches the plan she is being shown.
    const demoLogs = buildDemoLogs(
      recommendation.exercises.map((e) => e.id),
      today
    );
    setLogs(demoLogs);
    setDemoMealTracking(buildDemoMealTracking(today, calorieTarget.min));
    setIsDemoData(true);
    if (patientId) writeCachedLogs(patientId, demoLogs);
  }, [recommendation.exercises, today, calorieTarget.min, patientId]);

  const clearDemoData = useCallback(() => {
    setIsDemoData(false);
    setDemoMealTracking(null);
    setLogs([]);
    if (patientId) clearCachedLogs(patientId);
    // Re-read whatever is really on the server.
    if (patientId) {
      void loadLifestyleLogs(patientId).then(({ logs: real, synced }) => {
        setLogs(real);
        setIsSynced(synced);
      });
    }
  }, [patientId]);

  const activityStreak = useMemo(() => currentStreak(activeDates(logs), today), [logs, today]);
  const bestActivityStreak = useMemo(() => longestStreak(activeDates(logs)), [logs]);
  const hydrationStreak = useMemo(
    () => currentStreak(hydratedDates(logs), today),
    [logs, today]
  );

  const averages = useMemo(() => weeklyAverages(logs, today), [logs, today]);
  const week = useMemo(() => lastNDates(7, today), [today]);
  const fortnight = useMemo(() => lastNDates(14, today), [today]);

  const logByDate = useMemo(() => new Map(logs.map((l) => [l.date, l])), [logs]);

  const adherence: DietAdherenceDay[] = useMemo(() => {
    const source = demoMealTracking ?? mealTracking;
    const byDate = new Map(source.map((m) => [m.date, m]));
    return week.map((date) => evaluateDay(date, byDate.get(date), calorieTarget));
  }, [week, mealTracking, demoMealTracking, calorieTarget]);

  const adherenceSummary = useMemo(() => summarise(adherence), [adherence]);
  const todayAdherence = adherence[adherence.length - 1];

  const chartData = useMemo(
    () =>
      fortnight.map((date) => {
        const log = logByDate.get(date);
        return {
          date,
          sleep: log?.sleepHours ?? null,
          activity: totalActivityMinutes(log),
          water: log?.waterGlasses ?? 0,
        };
      }),
    [fortnight, logByDate]
  );

  const todayActivityMinutes = totalActivityMinutes(todayLog);
  const waterGoal = todayLog.waterGoal || DEFAULT_WATER_GOAL;
  const hydrationMet = isHydrationGoalMet(todayLog);

  const adjustExercise = (exerciseId: string, delta: number) =>
    updateToday((log) => {
      const next = Math.max(0, (log.activityMinutes[exerciseId] ?? 0) + delta);
      const minutes = { ...log.activityMinutes };
      if (next === 0) delete minutes[exerciseId];
      else minutes[exerciseId] = next;
      return { ...log, activityMinutes: minutes };
    });

  const adjustWater = (delta: number) =>
    updateToday((log) => ({
      ...log,
      waterGlasses: Math.max(0, Math.min(20, log.waterGlasses + delta)),
    }));

  const setSleep = (hours: number) =>
    updateToday((log) => ({ ...log, sleepHours: Number(hours.toFixed(1)) }));

  const setQuality = (quality: SleepQuality) =>
    updateToday((log) => ({ ...log, sleepQuality: quality }));

  const setWaterGoal = (goal: number) =>
    updateToday((log) => ({ ...log, waterGoal: Math.max(1, Math.min(20, goal)) }));

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tracker</h1>
          <p className="text-gray-600">
            One daily check-in: sleep, movement, water and your diet plan
          </p>
        </div>
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => navigate("/patient/dashboard")}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>
      </div>

      {demoAvailable && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm ${
            isDemoData
              ? "border-plum-300 bg-plum-100 text-plum-900"
              : "border-dashed border-gray-300 bg-gray-50 text-gray-600"
          }`}
        >
          <div className="flex items-start gap-2">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {isDemoData ? (
                <>
                  <strong>Showing {DEMO_DAYS} days of demo data.</strong> None of this is
                  real, and none of it is saved to the server — it lives in this browser
                  only until you clear it.
                </>
              ) : (
                <>Testing tools: load {DEMO_DAYS} days of fake data to see the streaks,
                calendars and charts populated.</>
              )}
            </span>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={loadDemoData}>
              {isDemoData ? "Regenerate" : `Load ${DEMO_DAYS} days of demo data`}
            </Button>
            {isDemoData && (
              <Button
                size="sm"
                variant="outline"
                onClick={clearDemoData}
                className="flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      {!isSynced && !isDemoData && (
        <div className="flex items-start gap-2 rounded-lg border border-coral-200 bg-coral-50 p-3 text-sm text-coral-800">
          <CloudOff className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Saved on this device only — we couldn't reach the server. Your streak is safe
            here and will sync when the connection is back.
          </span>
        </div>
      )}

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activity Streak</CardTitle>
            <Flame className="h-4 w-4 text-coral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activityStreak} day{activityStreak === 1 ? "" : "s"}
            </div>
            <p className="text-xs text-gray-600">
              best: {bestActivityStreak} day{bestActivityStreak === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hydration Today</CardTitle>
            <Droplets className="h-4 w-4 text-plum-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todayLog.waterGlasses}/{waterGoal}
            </div>
            <p className={`text-xs ${hydrationMet ? "text-rose-600" : "text-gray-600"}`}>
              {hydrationMet ? "Daily target met" : "Target not met yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Sleep</CardTitle>
            <Moon className="h-4 w-4 text-plum-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {averages.avgSleepHours === null ? "—" : `${averages.avgSleepHours.toFixed(1)}h`}
            </div>
            <p className="text-xs text-gray-600">per night (last 7 days)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Diet Plan Today</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todayAdherence?.hasPlan ? `${todayAdherence.planCompletionPct}%` : "—"}
            </div>
            <p className="text-xs text-gray-600">
              {todayAdherence?.hasPlan
                ? `${todayAdherence.mealsEaten}/${todayAdherence.mealsPlanned} meals eaten`
                : "no plan logged today"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Activity: recommended exercises + streak ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Movement & Exercise
              </CardTitle>
              <CardDescription>
                {recommendation.isGeneral
                  ? "A balanced starting week — add your conditions in your health profile to tailor this"
                  : `Chosen for your ${recommendation.plans
                      .map((p) => p.label)
                      .join(", ")}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-coral-50 px-4 py-2">
              <Flame className="w-5 h-5 text-coral-500" />
              <div>
                <div className="text-xl font-bold leading-none text-coral-600">
                  {activityStreak}
                </div>
                <div className="text-xs text-coral-700">day streak</div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <span className="text-sm text-gray-600">Logged today</span>
            <span className="text-sm font-semibold">
              {todayActivityMinutes} min
              {todayActivityMinutes > 0 && (
                <CheckCircle2 className="ml-2 inline h-4 w-4 text-rose-600" />
              )}
            </span>
          </div>

          {todayActivityMinutes === 0 && activityStreak > 0 && (
            <p className="text-sm text-coral-700">
              Log any movement today to keep your {activityStreak}-day streak alive.
            </p>
          )}

          {/* Recommended exercises — the only things you can log minutes against,
              so the log always matches the recommendation. */}
          <div className="grid gap-3 md:grid-cols-2">
            {recommendation.exercises.map((exercise: Exercise) => {
              const Icon = EXERCISE_ICONS[exercise.icon] ?? Activity;
              const logged = todayLog.activityMinutes[exercise.id] ?? 0;
              const done = logged >= exercise.minutes;

              return (
                <div
                  key={exercise.id}
                  className={`rounded-lg border p-4 ${done ? "border-rose-200 bg-rose-50/50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gray-700" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-medium">{exercise.name}</h4>
                          <Badge
                            variant="outline"
                            className={INTENSITY_STYLES[exercise.intensity]}
                          >
                            {exercise.intensity}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">{exercise.how}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Target: {exercise.minutes} min/day
                        </p>
                        <a
                          href={videoUrl(exercise)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                        >
                          <Youtube className="h-3.5 w-3.5" />
                          Watch how to do it
                        </a>
                      </div>
                    </div>
                    {done && <CheckCircle2 className="h-5 w-5 shrink-0 text-rose-600" />}
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => adjustExercise(exercise.id, -5)}
                      disabled={logged === 0}
                      aria-label={`Remove 5 minutes of ${exercise.name}`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-16 text-center font-medium">{logged}m</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => adjustExercise(exercise.id, 5)}
                      aria-label={`Add 5 minutes of ${exercise.name}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Why these, per condition */}
          <div className="space-y-3">
            {recommendation.plans.map((plan) => (
              <div key={plan.key} className="rounded-lg border border-plum-100 bg-plum-50/50 p-4">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-plum-600" />
                  <h4 className="font-medium text-plum-900">Why this for {plan.label}</h4>
                </div>
                <p className="mt-1 text-sm text-plum-900/80">{plan.rationale}</p>
              </div>
            ))}
          </div>

          {recommendation.avoid.length > 0 && (
            <div className="rounded-lg border border-red-100 bg-red-50/50 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <h4 className="font-medium text-red-900">Avoid for now</h4>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-red-900/80">
                {recommendation.avoid.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-gray-500">
            General wellness suggestions based on your health profile — check with your
            doctor before starting anything new.
          </p>

          {/* Streak calendar */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700">Last 14 days</h4>
            <div className="grid grid-cols-7 gap-2">
              {fortnight.map((date) => {
                const minutes = totalActivityMinutes(logByDate.get(date));
                return (
                  <div key={date} className="text-center">
                    <div className="mb-1 text-xs text-gray-500">{dayNumber(date)}</div>
                    <div
                      className={`flex h-9 items-center justify-center rounded text-xs font-medium ${
                        minutes > 0
                          ? "bg-coral-100 text-coral-800"
                          : "bg-gray-100 text-gray-400"
                      }`}
                      title={`${date}: ${minutes} min`}
                    >
                      {minutes > 0 ? `${minutes}m` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Hydration + Sleep ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplets className="w-5 h-5" />
              Hydration
            </CardTitle>
            <CardDescription>Did you hit your daily water target?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4 text-center">
              <div className={`text-6xl font-bold ${hydrationMet ? "text-rose-600" : "text-plum-600"}`}>
                {todayLog.waterGlasses}
              </div>
              <p className="text-gray-600">of {waterGoal} glasses today</p>
              <Progress
                value={Math.min(100, (todayLog.waterGlasses / waterGoal) * 100)}
                className="h-3 w-full"
              />
              <Badge
                variant="outline"
                className={
                  hydrationMet
                    ? "border-rose-200 bg-rose-100 text-rose-800"
                    : "border-gray-200 bg-gray-100 text-gray-700"
                }
              >
                {hydrationMet
                  ? "Daily target met"
                  : `${waterGoal - todayLog.waterGlasses} more to go`}
              </Badge>
            </div>

            <div className="flex justify-center gap-4">
              <Button
                variant="outline"
                size="lg"
                onClick={() => adjustWater(-1)}
                disabled={todayLog.waterGlasses === 0}
                className="flex items-center gap-2"
              >
                <Minus className="w-4 h-4" />
                Remove Glass
              </Button>
              <Button
                size="lg"
                onClick={() => adjustWater(1)}
                disabled={todayLog.waterGlasses >= 20}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Glass
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <span>Daily target</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setWaterGoal(waterGoal - 1)}
                disabled={waterGoal <= 1}
                aria-label="Lower daily water target"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="font-medium">{waterGoal}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setWaterGoal(waterGoal + 1)}
                disabled={waterGoal >= 20}
                aria-label="Raise daily water target"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">Last 7 days</h4>
                <span className="text-xs text-gray-500">
                  {hydrationStreak} day{hydrationStreak === 1 ? "" : "s"} on target
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {week.map((date) => {
                  const log = logByDate.get(date);
                  const met = isHydrationGoalMet(log);
                  return (
                    <div key={date} className="text-center">
                      <div className="mb-1 text-xs text-gray-500">{dayLabel(date)}</div>
                      {/* Met is a *filled* chip, not another pale tint: inside
                          one hue family two 100-level tints read as the same
                          colour at a glance, which is exactly the thing this
                          strip exists to distinguish. */}
                      <div
                        className={`rounded p-1 text-sm font-medium ${
                          met
                            ? "bg-rose-600 text-white"
                            : log?.waterGlasses
                              ? "bg-coral-100 text-coral-800 ring-1 ring-inset ring-coral-300"
                              : "bg-gray-100 text-gray-400"
                        }`}
                        title={`${date}: ${log?.waterGlasses ?? 0} glasses${
                          met ? " — target met" : ""
                        }`}
                      >
                        {log?.waterGlasses ?? 0}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="w-5 h-5" />
              Sleep
            </CardTitle>
            <CardDescription>How long and how well you slept last night</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <label className="text-sm font-medium" htmlFor="sleep-hours">
                Sleep duration: {(todayLog.sleepHours ?? 7).toFixed(1)}h
              </label>
              <input
                id="sleep-hours"
                type="range"
                min="4"
                max="12"
                step="0.5"
                value={todayLog.sleepHours ?? 7}
                onChange={(e) => setSleep(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>4h</span>
                <span>12h</span>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-sm font-medium">Sleep quality</span>
              <div className="grid grid-cols-3 gap-2">
                {SLEEP_QUALITIES.map((quality) => (
                  <Button
                    key={quality}
                    variant={todayLog.sleepQuality === quality ? "default" : "outline"}
                    size="sm"
                    onClick={() => setQuality(quality)}
                  >
                    {quality.charAt(0).toUpperCase() + quality.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {week
                .slice()
                .reverse()
                .slice(0, 4)
                .map((date) => {
                  const log = logByDate.get(date);
                  return (
                    <div
                      key={date}
                      className="flex items-center justify-between rounded bg-gray-50 p-2"
                    >
                      <span className="text-sm">
                        {dayLabel(date)} {dayNumber(date)}
                      </span>
                      {log?.sleepHours ? (
                        <div className="flex items-center gap-2">
                          {log.sleepQuality && (
                            <Badge
                              variant="outline"
                              className={SLEEP_QUALITY_STYLES[log.sleepQuality]}
                            >
                              {log.sleepQuality}
                            </Badge>
                          )}
                          <span className="text-sm font-medium">
                            {log.sleepHours.toFixed(1)}h
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">not logged</span>
                      )}
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Diet plan & daily nutrition (no streak — each day stands alone) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="w-5 h-5" />
            Daily Nutrition & Diet Plan
          </CardTitle>
          <CardDescription>
            Whether you completed your daily nutrition and followed the plan you were given
            — pulled from what you tick off in Meal Logging
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div
              className={`rounded-lg border p-4 ${
                todayAdherence?.nutritionComplete ? "border-rose-200 bg-rose-50/50" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Daily nutrition complete</h4>
                {todayAdherence?.nutritionComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-rose-600" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <p className="mt-2 text-2xl font-bold">
                {todayAdherence?.caloriesConsumed ?? 0}
                <span className="text-sm font-normal text-gray-600">
                  {" "}
                  / {calorieTarget.min}–{calorieTarget.max} kcal
                </span>
              </p>
              <Progress
                className="mt-2 h-2"
                value={Math.min(
                  100,
                  ((todayAdherence?.caloriesConsumed ?? 0) / calorieTarget.min) * 100
                )}
              />
              <p className="mt-2 text-sm text-gray-600">
                {todayAdherence?.overTarget
                  ? `Over your ${calorieTarget.label.toLowerCase()} range — worth mentioning to your doctor.`
                  : todayAdherence?.nutritionComplete
                    ? `You've met your ${calorieTarget.label.toLowerCase()} intake for today.`
                    : `${Math.max(
                        0,
                        calorieTarget.min - (todayAdherence?.caloriesConsumed ?? 0)
                      )} kcal short of your daily minimum.`}
              </p>
            </div>

            <div
              className={`rounded-lg border p-4 ${
                todayAdherence?.planFollowed ? "border-rose-200 bg-rose-50/50" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Diet plan followed</h4>
                {todayAdherence?.planFollowed ? (
                  <CheckCircle2 className="h-5 w-5 text-rose-600" />
                ) : (
                  <ClipboardCheck className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <p className="mt-2 text-2xl font-bold">
                {todayAdherence?.mealsEaten ?? 0}
                <span className="text-sm font-normal text-gray-600">
                  {" "}
                  / {todayAdherence?.mealsPlanned ?? 0} meals
                </span>
              </p>
              <Progress className="mt-2 h-2" value={todayAdherence?.planCompletionPct ?? 0} />
              <p className="mt-2 text-sm text-gray-600">
                {!todayAdherence?.hasPlan
                  ? "No plan loaded today — open Meal Logging to start one."
                  : todayAdherence.planFollowed
                    ? "You're following the plan your doctor provided."
                    : `${todayAdherence.mealsPlanned - todayAdherence.mealsEaten} meal(s) still to log.`}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-medium text-gray-700">Last 7 days</h4>
              <span className="text-xs text-gray-500">
                nutrition met {adherenceSummary.daysNutritionComplete}/7 · plan followed{" "}
                {adherenceSummary.daysPlanFollowed}/7
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {adherence.map((day) => (
                <div key={day.date} className="text-center">
                  <div className="mb-1 text-xs text-gray-500">{dayLabel(day.date)}</div>
                  <div
                    className="flex flex-col gap-1"
                    title={`${day.date}: ${day.caloriesConsumed} kcal, ${day.mealsEaten}/${day.mealsPlanned} meals`}
                  >
                    {/* Filled = achieved, hollow = not. Two 100-level tints
                        of the same family were indistinguishable at this size. */}
                    <div
                      className={`h-5 rounded text-[10px] leading-5 ${
                        day.nutritionComplete
                          ? "bg-rose-600 font-medium text-white"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      kcal
                    </div>
                    <div
                      className={`h-5 rounded text-[10px] leading-5 ${
                        day.planFollowed
                          ? "bg-plum-600 font-medium text-white"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      plan
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Trends ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Your Trends
          </CardTitle>
          <CardDescription>The last 14 days of everything you've logged</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700">Sleep (hours)</h4>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={dayNumber} />
                  <YAxis domain={[0, 12]} />
                  <Tooltip formatter={(value: number) => [`${value}h`, "Sleep"]} />
                  <Line
                    type="monotone"
                    dataKey="sleep"
                    stroke={CHART_COLORS.sleep}
                    strokeWidth={2}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700">Activity (minutes)</h4>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={dayNumber} />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`${value} min`, "Activity"]} />
                  <Bar dataKey="activity" fill={CHART_COLORS.activity} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {averages.avgActivityMinutes} min/day average this week
            </p>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700">Water (glasses)</h4>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={dayNumber} />
                  <YAxis domain={[0, Math.max(12, waterGoal + 2)]} />
                  <Tooltip formatter={(value: number) => [`${value} glasses`, "Water"]} />
                  <Line type="monotone" dataKey="water" stroke={CHART_COLORS.water} strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {averages.avgWaterGlasses} glasses/day average this week
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LifestyleTracker;
