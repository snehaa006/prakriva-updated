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
  TrendingUp,
  Plus,
  Minus,
  CheckCircle2,
  ArrowLeft,
  Flame,
  Loader2,
  FlaskConical,
  Trash2,
  Utensils,
  ClipboardCheck,
  CloudOff,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { useCachedPageData } from "@/hooks/useCachedPageData";
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
  conditionsFromScreening,
  EXERCISE_DISCLAIMER,
  recommendExercises,
  type ConditionInput,
  type Exercise,
} from "@/lib/exerciseRecommendations";
import { ExerciseSuggestions } from "@/components/wellness/ExercisePlan";
import {
  isDemoDataOn,
  isDemoModeAvailable,
  isDemoRequestedByUrl,
  setDemoDataOn,
} from "@/lib/demoMode";
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
  loadLifestyleLogs,
  saveLifestyleDay,
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

const SLEEP_QUALITY_STYLES: Record<string, string> = {
  deep: "bg-accent-soft text-accent-soft-foreground border-transparent",
  disturbed: "bg-warning/10 text-warning border-warning/20",
  insufficient: "bg-destructive/10 text-destructive border-destructive/20",
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

/** Everything the tracker reads on open, loaded as one cacheable snapshot. */
interface TrackerSnapshot {
  logs: LifestyleDayLog[];
  /** False when the logs came from the local cache alone. */
  synced: boolean;
  conditions: ConditionInput[];
  isPregnant: boolean;
  calorieTarget: CalorieTarget;
  mealTracking: MealTrackingDay[];
}

/**
 * Read the tracker's four sources in one pass.
 *
 * Each part fails on its own: a screening service that is down costs the
 * tailored exercises, not the page, and the logs themselves are local-first so
 * they survive Supabase being unreachable entirely.
 */
const loadTracker = async (patientId: string): Promise<TrackerSnapshot> => {
  const snapshot: TrackerSnapshot = {
    logs: [],
    synced: true,
    conditions: [],
    isPregnant: false,
    calorieTarget: { min: 1800, max: 2200, label: "General Adult" },
    mealTracking: [],
  };

  // Cached logs render immediately; the Supabase merge lands underneath.
  try {
    const { logs, synced } = await loadLifestyleLogs(patientId);
    snapshot.logs = logs;
    snapshot.synced = synced;
  } catch (error) {
    console.error("Error loading lifestyle logs:", error);
  }

  // Conditions come from two places: what she reported in her profile, and
  // what the maternal screening flagged. Both feed the exercise picks.
  try {
    const { data: patient } = await supabase
      .from("patients")
      .select("assessment_data")
      .eq("id", patientId)
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

    snapshot.isPregnant = isPregnantPatient(assessment);
    snapshot.calorieTarget = getNutritionalTargets(
      (record.lifeStage as LifeStage) ?? "not_applicable",
      record.pregnancyTrimester as string | undefined,
      record.isBreastfeeding as string | undefined,
      record.menopauseStage as string | undefined
    ).calories;

    // Only moderate/high screening findings shape the plan — a low-risk score
    // is a reassurance, not a condition to train around.
    let screened: ConditionInput[] = [];
    try {
      const screenings = await fetchScreenings(patientId);
      screened = conditionsFromScreening(screenings[0]?.result.conditions);
    } catch (error) {
      console.error("Error loading screening results:", error);
    }

    snapshot.conditions = [...screened, ...reported];
  } catch (error) {
    console.error("Error loading patient profile:", error);
  }

  // Diet adherence is read from what she logs on the Meal Logging page.
  try {
    snapshot.mealTracking = await fetchMealTracking(
      patientId,
      lastNDates(7, todayIso())[0]
    );
  } catch (error) {
    console.error("Error loading meal tracking:", error);
  }

  return snapshot;
};

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

  const patientId = useAuthUserId();

  // Cached: coming back to the tracker re-renders yesterday's streak instantly
  // instead of spinning while the same four sources are read again. Keyed on
  // the date too, so a tab left open overnight reloads for the new day.
  const { data, isFirstLoad } = useCachedPageData(
    ["lifestyle-tracker", patientId, today],
    () => loadTracker(patientId as string),
    { enabled: !!patientId }
  );

  const conditions = useMemo(() => data?.conditions ?? [], [data]);
  const isPregnant = data?.isPregnant ?? false;
  const calorieTarget = useMemo<CalorieTarget>(
    () => data?.calorieTarget ?? { min: 1800, max: 2200, label: "General Adult" },
    [data]
  );
  const mealTracking = useMemo(() => data?.mealTracking ?? [], [data]);

  const [logs, setLogs] = useState<LifestyleDayLog[]>([]);
  const [isSynced, setIsSynced] = useState(true);

  // Demo data is generated on the fly from a persisted flag — never written to
  // Supabase, and never into the lifestyle-log cache either, so it cannot be
  // mistaken for (or overwrite) the patient's own history. See lib/demoMode.ts.
  const demoAvailable = useMemo(() => isDemoModeAvailable(), []);
  const [isDemoData, setIsDemoData] = useState(false);
  const [demoMealTracking, setDemoMealTracking] = useState<MealTrackingDay[] | null>(null);
  /** Real logs, parked while demo data is showing so Clear can restore them. */
  const realLogs = useRef<LifestyleDayLog[]>([]);

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

  /**
   * Pick up demo mode from the persisted flag (or `?demo=1`).
   *
   * Runs again once the patient id resolves, and only ever switches demo *on* —
   * turning it off is Clear's job alone, so a late-arriving id can't yank a
   * demo out from under someone mid-walkthrough.
   */
  useEffect(() => {
    if (isDemoRequestedByUrl()) {
      setDemoDataOn(patientId, true);
      setIsDemoData(true);
    } else if (isDemoDataOn(patientId)) {
      setIsDemoData(true);
    }
  }, [patientId]);

  /**
   * Put the loaded logs on screen — but only when they are newer than what is
   * already there.
   *
   * Logging is local-first and debounced, so a background refresh that landed
   * mid-edit could otherwise paint a stale server copy over minutes she had
   * just entered. Demo mode owns `logs` outright while it is on, so it is left
   * alone here too.
   */
  const seededLogs = useRef<LifestyleDayLog[] | null>(null);
  useEffect(() => {
    if (!data || seededLogs.current === data.logs) return;
    seededLogs.current = data.logs;

    realLogs.current = data.logs;
    setIsSynced(data.synced);
    if (!isDemoData) setLogs(data.logs);
  }, [data, isDemoData]);

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

        // While demo data is showing, edits stay in memory: they are changes to
        // a fabricated month, so persisting them anywhere would be writing
        // fiction into her real history.
        if (patientId && !isDemoData) {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            void saveLifestyleDay(patientId, updated).then((persisted) =>
              setIsSynced(persisted)
            );
          }, 600);
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

  // Exercise ids as a stable string, so the regeneration effect below fires
  // when the recommended plan actually changes rather than on every render.
  const exerciseIdsKey = recommendation.exercises.map((e) => e.id).join(",");

  /**
   * Generate (or regenerate) the demo month whenever demo mode is on.
   *
   * Anchored to `today` and to her current recommended exercises, so it is
   * always internally consistent: reopen the page a week later and the streaks
   * still run up to today instead of trailing off into a stale gap.
   */
  useEffect(() => {
    if (!isDemoData) return;
    setLogs(buildDemoLogs(exerciseIdsKey ? exerciseIdsKey.split(",") : [], today));
    setDemoMealTracking(buildDemoMealTracking(today, calorieTarget.min));
  }, [isDemoData, exerciseIdsKey, today, calorieTarget.min]);

  const loadDemoData = useCallback(() => {
    // No `patientId` guard: the toggle is clickable before auth resolves, and
    // the flag helpers handle a null id by parking it under a pending key.
    setDemoDataOn(patientId, true);
    setIsDemoData(true); // the effect above fills in the month
  }, [patientId]);

  const clearDemoData = useCallback(() => {
    setDemoDataOn(patientId, false);
    // Also clear the pre-auth key, so Clear sticks regardless of which one the
    // demo was switched on under.
    setDemoDataOn(null, false);
    setIsDemoData(false);
    setDemoMealTracking(null);
    // Demo data never touched the cache or the server, so her real logs are
    // exactly as they were — just put them back on screen.
    setLogs(realLogs.current);
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

  // First visit only — a return to this tab renders from the cached snapshot.
  if (isFirstLoad) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-foreground-tertiary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl flex-1 space-y-8 p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title1 text-foreground">Tracker</h1>
          <p className="mt-1.5 max-w-lg text-subhead text-foreground-secondary">
            One daily check-in: sleep, movement, water and your diet plan.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full gap-2 sm:w-auto"
          onClick={() => navigate("/patient/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      {demoAvailable && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-footnote ${
            isDemoData
              ? "border-transparent bg-vata/10 text-foreground"
              : "border-dashed border-border bg-muted/60 text-foreground-secondary"
          }`}
        >
          <div className="flex items-start gap-2.5">
            <FlaskConical className={`mt-0.5 h-4 w-4 shrink-0 ${isDemoData ? "text-vata" : "text-foreground-tertiary"}`} />
            <span>
              {isDemoData ? (
                <>
                  <strong className="font-medium">
                    Sample data — showing {DEMO_DAYS} days of example logs.
                  </strong>{" "}
                  None of this is real and none of it is saved: your own logs are
                  untouched underneath and come straight back when you clear it.
                </>
              ) : (
                <>See it with data: load {DEMO_DAYS} days of sample logs to fill the
                streaks, calendars, charts and diet summary.</>
              )}
            </span>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={loadDemoData}>
              {isDemoData ? "Regenerate" : `Load ${DEMO_DAYS} days of sample data`}
            </Button>
            {isDemoData && (
              <Button size="sm" variant="outline" onClick={clearDemoData} className="gap-1.5">
                <Trash2 className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      {!isSynced && !isDemoData && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/20 bg-warning/10 p-4 text-footnote text-foreground">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            Saved on this device only — we couldn't reach the server. Your streak is safe
            here and will sync when the connection is back.
          </span>
        </div>
      )}

      {/* Overview */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-footnote font-medium text-foreground-secondary">Activity Streak</CardTitle>
            <Flame className="h-4 w-4 text-pitta" />
          </CardHeader>
          <CardContent>
            <div className="text-title2 text-foreground">
              {activityStreak} day{activityStreak === 1 ? "" : "s"}
            </div>
            <p className="mt-1 text-caption1 text-foreground-tertiary">
              best: {bestActivityStreak} day{bestActivityStreak === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-footnote font-medium text-foreground-secondary">Hydration Today</CardTitle>
            <Droplets className="h-4 w-4 text-vata" />
          </CardHeader>
          <CardContent>
            <div className="text-title2 text-foreground">
              {todayLog.waterGlasses}/{waterGoal}
            </div>
            <p className={`mt-1 text-caption1 ${hydrationMet ? "text-success" : "text-foreground-tertiary"}`}>
              {hydrationMet ? "Daily target met" : "Target not met yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-footnote font-medium text-foreground-secondary">Average Sleep</CardTitle>
            <Moon className="h-4 w-4 text-vata" />
          </CardHeader>
          <CardContent>
            <div className="text-title2 text-foreground">
              {averages.avgSleepHours === null ? "—" : `${averages.avgSleepHours.toFixed(1)}h`}
            </div>
            <p className="mt-1 text-caption1 text-foreground-tertiary">per night (last 7 days)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-footnote font-medium text-foreground-secondary">Diet Plan Today</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-title2 text-foreground">
              {todayAdherence?.hasPlan ? `${todayAdherence.planCompletionPct}%` : "—"}
            </div>
            <p className="mt-1 text-caption1 text-foreground-tertiary">
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
                <Activity className="h-5 w-5 text-primary" />
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
            <div className="flex items-center gap-2.5 rounded-xl bg-accent-soft px-4 py-2.5">
              <Flame className="h-5 w-5 text-primary" />
              <div>
                <div className="text-title3 leading-none text-accent-soft-foreground">
                  {activityStreak}
                </div>
                <div className="text-caption1 text-accent-soft-foreground/80">day streak</div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-xl bg-muted p-4">
            <span className="text-footnote text-foreground-secondary">Logged today</span>
            <span className="flex items-center gap-2 text-subhead font-medium text-foreground">
              {todayActivityMinutes} min
              {todayActivityMinutes > 0 && <CheckCircle2 className="h-4 w-4 text-success" />}
            </span>
          </div>

          {todayActivityMinutes === 0 && activityStreak > 0 && (
            <p className="text-footnote text-foreground-secondary">
              Log any movement today to keep your {activityStreak}-day streak alive.
            </p>
          )}

          {/* Recommended exercises — the only things you can log minutes against,
              so the log always matches the recommendation. */}
          <ExerciseSuggestions
            recommendation={recommendation}
            isDone={(exercise) =>
              (todayLog.activityMinutes[exercise.id] ?? 0) >= exercise.minutes
            }
            renderAction={(exercise: Exercise) => {
              const logged = todayLog.activityMinutes[exercise.id] ?? 0;
              return (
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => adjustExercise(exercise.id, -5)}
                    disabled={logged === 0}
                    aria-label={`Remove 5 minutes of ${exercise.name}`}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-16 text-center text-subhead font-medium text-foreground">{logged}m</span>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => adjustExercise(exercise.id, 5)}
                    aria-label={`Add 5 minutes of ${exercise.name}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              );
            }}
          />

          <p className="text-caption1 text-foreground-tertiary">{EXERCISE_DISCLAIMER.patient}</p>

          {/* Streak calendar */}
          <div>
            <h4 className="mb-2.5 text-footnote font-medium text-foreground-secondary">Last 14 days</h4>
            <div className="grid grid-cols-7 gap-2">
              {fortnight.map((date) => {
                const minutes = totalActivityMinutes(logByDate.get(date));
                return (
                  <div key={date} className="text-center">
                    <div className="mb-1 text-caption2 text-foreground-tertiary">{dayNumber(date)}</div>
                    <div
                      className={`flex h-9 items-center justify-center rounded-md text-caption1 font-medium ${
                        minutes > 0
                          ? "bg-accent-soft text-accent-soft-foreground"
                          : "bg-muted text-foreground-tertiary"
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
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-vata" />
              Hydration
            </CardTitle>
            <CardDescription>Did you hit your daily water target?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3 text-center">
              <div className={`text-large-title ${hydrationMet ? "text-success" : "text-vata"}`}>
                {todayLog.waterGlasses}
              </div>
              <p className="text-footnote text-foreground-secondary">of {waterGoal} glasses today</p>
              <Progress
                value={Math.min(100, (todayLog.waterGlasses / waterGoal) * 100)}
                className="h-3 w-full"
              />
              <Badge
                variant="outline"
                className={
                  hydrationMet
                    ? "border-transparent bg-success/10 text-success"
                    : "border-border bg-muted text-foreground-secondary"
                }
              >
                {hydrationMet
                  ? "Daily target met"
                  : `${waterGoal - todayLog.waterGlasses} more to go`}
              </Badge>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                variant="outline"
                size="lg"
                onClick={() => adjustWater(-1)}
                disabled={todayLog.waterGlasses === 0}
                className="w-full gap-2 sm:w-auto"
              >
                <Minus className="h-4 w-4" />
                Remove Glass
              </Button>
              <Button
                size="lg"
                onClick={() => adjustWater(1)}
                disabled={todayLog.waterGlasses >= 20}
                className="w-full gap-2 sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Add Glass
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2 text-footnote text-foreground-secondary">
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
              <span className="font-medium text-foreground">{waterGoal}</span>
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
              <div className="mb-2.5 flex items-center justify-between">
                <h4 className="text-footnote font-medium text-foreground-secondary">Last 7 days</h4>
                <span className="text-caption1 text-foreground-tertiary">
                  {hydrationStreak} day{hydrationStreak === 1 ? "" : "s"} on target
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {week.map((date) => {
                  const log = logByDate.get(date);
                  const met = isHydrationGoalMet(log);
                  return (
                    <div key={date} className="text-center">
                      <div className="mb-1 text-caption2 text-foreground-tertiary">{dayLabel(date)}</div>
                      {/* Met is a *filled* chip, not another pale tint, so the
                          strip stays legible at a glance. */}
                      <div
                        className={`rounded-md p-1 text-footnote font-medium ${
                          met
                            ? "bg-success text-white"
                            : log?.waterGlasses
                              ? "bg-vata/10 text-vata ring-1 ring-inset ring-vata/20"
                              : "bg-muted text-foreground-tertiary"
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
              <Moon className="h-5 w-5 text-vata" />
              Sleep
            </CardTitle>
            <CardDescription>How long and how well you slept last night</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <label className="text-footnote font-medium text-foreground" htmlFor="sleep-hours">
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
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted"
              />
              <div className="flex justify-between text-caption1 text-foreground-tertiary">
                <span>4h</span>
                <span>12h</span>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-footnote font-medium text-foreground">Sleep quality</span>
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
                      className="flex items-center justify-between rounded-lg bg-muted p-2.5"
                    >
                      <span className="text-footnote text-foreground-secondary">
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
                          <span className="text-footnote font-medium text-foreground">
                            {log.sleepHours.toFixed(1)}h
                          </span>
                        </div>
                      ) : (
                        <span className="text-footnote text-foreground-tertiary">not logged</span>
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
            <Utensils className="h-5 w-5 text-primary" />
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
              className={`rounded-xl border p-4 ${
                todayAdherence?.nutritionComplete
                  ? "border-transparent bg-accent-soft"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-subhead font-medium text-foreground">Daily nutrition complete</h4>
                {todayAdherence?.nutritionComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-foreground-tertiary" />
                )}
              </div>
              <p className="mt-2 text-title3 text-foreground">
                {todayAdherence?.caloriesConsumed ?? 0}
                <span className="text-footnote font-normal text-foreground-tertiary">
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
              <p className="mt-2 text-footnote text-foreground-secondary">
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
              className={`rounded-xl border p-4 ${
                todayAdherence?.planFollowed
                  ? "border-transparent bg-accent-soft"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-subhead font-medium text-foreground">Diet plan followed</h4>
                {todayAdherence?.planFollowed ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <ClipboardCheck className="h-5 w-5 text-foreground-tertiary" />
                )}
              </div>
              <p className="mt-2 text-title3 text-foreground">
                {todayAdherence?.mealsEaten ?? 0}
                <span className="text-footnote font-normal text-foreground-tertiary">
                  {" "}
                  / {todayAdherence?.mealsPlanned ?? 0} meals
                </span>
              </p>
              <Progress className="mt-2 h-2" value={todayAdherence?.planCompletionPct ?? 0} />
              <p className="mt-2 text-footnote text-foreground-secondary">
                {!todayAdherence?.hasPlan
                  ? "No plan loaded today — open Meal Logging to start one."
                  : todayAdherence.planFollowed
                    ? "You're following the plan your doctor provided."
                    : `${todayAdherence.mealsPlanned - todayAdherence.mealsEaten} meal(s) still to log.`}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-footnote font-medium text-foreground-secondary">Last 7 days</h4>
              <span className="text-caption1 text-foreground-tertiary">
                nutrition met {adherenceSummary.daysNutritionComplete}/7 · plan followed{" "}
                {adherenceSummary.daysPlanFollowed}/7
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {adherence.map((day) => (
                <div key={day.date} className="text-center">
                  <div className="mb-1 text-caption2 text-foreground-tertiary">{dayLabel(day.date)}</div>
                  <div
                    className="flex flex-col gap-1"
                    title={`${day.date}: ${day.caloriesConsumed} kcal, ${day.mealsEaten}/${day.mealsPlanned} meals`}
                  >
                    {/* Filled = achieved, hollow = not. */}
                    <div
                      className={`h-5 rounded text-[10px] leading-5 ${
                        day.nutritionComplete
                          ? "bg-primary font-medium text-primary-foreground"
                          : "bg-muted text-foreground-tertiary"
                      }`}
                    >
                      kcal
                    </div>
                    <div
                      className={`h-5 rounded text-[10px] leading-5 ${
                        day.planFollowed
                          ? "bg-vata font-medium text-white"
                          : "bg-muted text-foreground-tertiary"
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
            <TrendingUp className="h-5 w-5 text-primary" />
            Your Trends
          </CardTitle>
          <CardDescription>The last 14 days of everything you've logged</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 lg:grid-cols-3">
          <div>
            <h4 className="mb-2.5 text-footnote font-medium text-foreground-secondary">Sleep (hours)</h4>
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
            <h4 className="mb-2.5 text-footnote font-medium text-foreground-secondary">Activity (minutes)</h4>
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
            <p className="mt-1.5 text-caption1 text-foreground-tertiary">
              {averages.avgActivityMinutes} min/day average this week
            </p>
          </div>

          <div>
            <h4 className="mb-2.5 text-footnote font-medium text-foreground-secondary">Water (glasses)</h4>
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
            <p className="mt-1.5 text-caption1 text-foreground-tertiary">
              {averages.avgWaterGlasses} glasses/day average this week
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LifestyleTracker;
