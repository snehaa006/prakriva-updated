// The PCOD/PCOS track's cycle and weight tracker.
//
// This page is what the maternal Health Check is for the pregnancy track: the
// place a PCOS patient's own data is collected, and the thing her diet plan,
// her exercise recommendations and her doctor's review are all derived from.
// Everything on it is designed around the specific ways a PCOS cycle goes
// wrong — long gaps, missed months, two periods in one month, heavy bleeding —
// rather than around a textbook 28-day cycle she does not have.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  CloudOff,
  Droplet,
  Info,
  Loader2,
  Plus,
  Scale,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { CHART_COLORS } from "@/lib/chartColors";
import { RISK_STYLES } from "@/lib/riskLevels";
import { todayIso } from "@/lib/lifestyleLog";
import {
  CYCLE_SYMPTOMS,
  FLOW_INTENSITIES,
  FLOW_LABELS,
  REGULARITY_LABELS,
  analyseCycles,
  monthOf,
  symptomFrequency,
  type CycleSymptom,
  type FlowIntensity,
  type MissedMonth,
  type PeriodEntry,
} from "@/lib/cycleTracking";
import {
  BMI_BAND_LABELS,
  TREND_LABELS,
  analyseWeights,
  bmiBand,
  type WeightEntry,
} from "@/lib/weightLog";
import {
  deleteMissedMonth,
  deletePeriod,
  loadCycleHistory,
  newEntryId,
  saveMissedMonth,
  savePeriod,
} from "@/services/cycleLogService";
import { loadWeights, saveWeight } from "@/services/weightLogService";
import {
  heightCmFromAssessment,
  isPregnantPatient,
} from "@/services/diseaseDetectionService";

const FLOW_STYLES: Record<FlowIntensity, string> = {
  spotting: "bg-accent-soft text-accent-soft-foreground border-transparent",
  light: "bg-accent-soft text-accent-soft-foreground border-transparent",
  moderate: "bg-warning/15 text-warning border-warning/30",
  heavy: "bg-primary text-primary-foreground border-transparent",
};

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const prettyMonth = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const emptyDraft = (today: string) => ({
  startDate: today,
  endDate: "",
  flow: null as FlowIntensity | null,
  symptoms: [] as CycleSymptom[],
  notes: "",
});

const PeriodTracker = () => {
  const navigate = useNavigate();
  const today = todayIso();

  const [patientId, setPatientId] = useState<string | null>(null);
  const [periods, setPeriods] = useState<PeriodEntry[]>([]);
  const [missedMonths, setMissedMonths] = useState<MissedMonth[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  // A pregnant patient's cycle log is still hers to keep, but nothing recent
  // in it should be read as a finding — periods stop, so the gap is the
  // pregnancy. See `analyseCycles`.
  const [isPregnant, setIsPregnant] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSynced, setIsSynced] = useState(true);

  const [draft, setDraft] = useState(emptyDraft(today));
  const [missedDraft, setMissedDraft] = useState({ month: monthOf(today), notes: "" });
  const [weightDraft, setWeightDraft] = useState({ date: today, weightKg: "", notes: "" });

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

      try {
        const [history, weightHistory, profile] = await Promise.all([
          loadCycleHistory(user.id),
          loadWeights(user.id),
          supabase
            .from("patients")
            .select("assessment_data")
            .eq("id", user.id)
            .maybeSingle(),
        ]);

        if (cancelled) return;
        setPeriods(history.periods);
        setMissedMonths(history.missedMonths);
        setWeights(weightHistory.weights);
        setIsSynced(history.synced && weightHistory.synced);
        setHeightCm(heightCmFromAssessment(profile.data?.assessment_data ?? null));
        setIsPregnant(isPregnantPatient(profile.data?.assessment_data ?? null));
      } catch (error) {
        console.error("Error loading cycle history:", error);
      }

      if (!cancelled) setIsLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const analysis = useMemo(
    () => analyseCycles(periods, missedMonths, { today, isPregnant }),
    [periods, missedMonths, today, isPregnant]
  );

  const weightAnalysis = useMemo(
    () => analyseWeights(weights, heightCm, { today }),
    [weights, heightCm, today]
  );

  const symptoms = useMemo(() => symptomFrequency(periods), [periods]);

  const weightChartData = useMemo(
    () => weights.map((w) => ({ date: w.date, weight: w.weightKg })),
    [weights]
  );

  const cycleChartData = useMemo(() => {
    const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
    return sorted.slice(1).map((entry, index) => ({
      date: entry.startDate,
      length:
        (new Date(`${entry.startDate}T00:00:00Z`).getTime() -
          new Date(`${sorted[index].startDate}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000),
    }));
  }, [periods]);

  const toggleSymptom = (symptom: CycleSymptom) =>
    setDraft((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter((s) => s !== symptom)
        : [...prev.symptoms, symptom],
    }));

  const handleLogPeriod = useCallback(async () => {
    if (!patientId) return;
    if (!draft.startDate) {
      toast.error("When did this period start?");
      return;
    }
    if (draft.endDate && draft.endDate < draft.startDate) {
      toast.error("The end date can't be before the start date");
      return;
    }

    // Reuse the existing entry's id when correcting a period already logged
    // for that start date, so the upsert updates the row instead of orphaning
    // it under a fresh id.
    const existing = periods.find((p) => p.startDate === draft.startDate);

    const entry: PeriodEntry = {
      id: existing?.id ?? newEntryId(),
      startDate: draft.startDate,
      endDate: draft.endDate || null,
      flow: draft.flow,
      symptoms: draft.symptoms,
      notes: draft.notes.trim(),
    };

    const { periods: updated, synced } = await savePeriod(patientId, entry);
    setPeriods(updated);
    setIsSynced((prev) => prev && synced);
    setDraft(emptyDraft(today));
    toast.success(existing ? "Period updated" : "Period logged");
  }, [patientId, draft, periods, today]);

  const handleDeletePeriod = useCallback(
    async (entryId: string) => {
      if (!patientId) return;
      setPeriods(await deletePeriod(patientId, entryId));
      toast.success("Entry removed");
    },
    [patientId]
  );

  const handleLogMissedMonth = useCallback(async () => {
    if (!patientId) return;
    if (!/^\d{4}-\d{2}$/.test(missedDraft.month)) {
      toast.error("Pick the month you had no period in");
      return;
    }

    const { missedMonths: updated, synced } = await saveMissedMonth(patientId, {
      month: missedDraft.month,
      notes: missedDraft.notes.trim(),
    });
    setMissedMonths(updated);
    setIsSynced((prev) => prev && synced);
    setMissedDraft({ month: monthOf(today), notes: "" });
    toast.success("Missed month recorded");
  }, [patientId, missedDraft, today]);

  const handleLogWeight = useCallback(async () => {
    if (!patientId) return;
    const value = Number(weightDraft.weightKg);
    if (!Number.isFinite(value) || value < 25 || value > 250) {
      toast.error("Enter a weight between 25 and 250 kg");
      return;
    }

    const { weights: updated, synced } = await saveWeight(patientId, {
      date: weightDraft.date,
      weightKg: value,
      notes: weightDraft.notes.trim(),
    });
    setWeights(updated);
    setIsSynced((prev) => prev && synced);
    setWeightDraft({ date: today, weightKg: "", notes: "" });
    toast.success("Weight recorded");
  }, [patientId, weightDraft, today]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center p-12">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
          <p className="text-subhead text-foreground-secondary">Loading your cycle history…</p>
        </div>
      </div>
    );
  }

  const TrendIcon =
    weightAnalysis.trend === "gaining"
      ? TrendingUp
      : weightAnalysis.trend === "losing"
        ? TrendingDown
        : Scale;

  return (
    <div className="mx-auto max-w-7xl flex-1 space-y-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title1 text-foreground">Period &amp; Weight Tracker</h1>
          <p className="mt-1.5 max-w-2xl text-body text-foreground-secondary">
            {isPregnant
              ? "Your cycles are paused while you're pregnant — your history still shapes your plan."
              : "Your cycle history and weight are what your PCOD/PCOS diet plan is built from."}
          </p>
        </div>
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => navigate("/patient/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      {!isSynced && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-footnote text-foreground">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            Saved on this device only — we couldn't reach the server. Nothing is lost;
            it will sync when the connection is back.
          </span>
        </div>
      )}

      {/* ── Overview ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-caption1 font-medium text-foreground-secondary">Cycle Regularity</CardTitle>
            <CalendarDays className="h-4 w-4 text-vata" />
          </CardHeader>
          <CardContent>
            <div className="text-title3 text-foreground">
              {REGULARITY_LABELS[analysis.regularity]}
            </div>
            <p className="mt-0.5 text-caption1 text-foreground-tertiary">
              {analysis.cycleCount} cycle{analysis.cycleCount === 1 ? "" : "s"} logged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-caption1 font-medium text-foreground-secondary">Average Cycle</CardTitle>
            <Sparkles className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-title2 text-foreground">
              {analysis.averageCycleLength === null
                ? "—"
                : `${analysis.averageCycleLength} d`}
            </div>
            <p className="mt-0.5 text-caption1 text-foreground-tertiary">
              {analysis.shortestCycle !== null
                ? `range ${analysis.shortestCycle}–${analysis.longestCycle} days`
                : "log two periods to see this"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-caption1 font-medium text-foreground-secondary">Days Since Period</CardTitle>
            <Droplet className="h-4 w-4 text-pitta" />
          </CardHeader>
          <CardContent>
            <div className="text-title2 text-foreground">
              {analysis.daysSinceLastPeriod ?? "—"}
            </div>
            <p className={`mt-0.5 text-caption1 ${analysis.isOverdue ? "text-warning" : "text-foreground-tertiary"}`}>
              {analysis.predictedNextStart
                ? analysis.isOverdue
                  ? `overdue since ${prettyDate(analysis.predictedNextStart)}`
                  : `next expected ${prettyDate(analysis.predictedNextStart)}`
                : "no prediction yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-caption1 font-medium text-foreground-secondary">Weight</CardTitle>
            <TrendIcon className="h-4 w-4 text-vata" />
          </CardHeader>
          <CardContent>
            <div className="text-title2 text-foreground">
              {weightAnalysis.latest ? `${weightAnalysis.latest.weightKg} kg` : "—"}
            </div>
            <p className="mt-0.5 text-caption1 text-foreground-tertiary">
              {weightAnalysis.bmi !== null
                ? `BMI ${weightAnalysis.bmi} · ${BMI_BAND_LABELS[bmiBand(weightAnalysis.bmi)]}`
                : "add your height in your profile for BMI"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── What your cycles are saying ── */}
      {analysis.flags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-title3">
              <Info className="h-5 w-5 text-foreground-secondary" />
              What your cycles are saying
            </CardTitle>
            <CardDescription>
              Patterns we can see in what you've logged. These are observations, not a
              diagnosis — bring them to your doctor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.flags.map((flag) => (
              <div key={flag.key} className="rounded-2xl border border-border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-subhead font-medium text-foreground">{flag.label}</h4>
                  <Badge variant="outline" className={RISK_STYLES[flag.severity].badge}>
                    {RISK_STYLES[flag.severity].label}
                  </Badge>
                </div>
                <p className="mt-1 text-footnote text-foreground-secondary">{flag.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Log a period ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-title3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-primary">
              <Droplet className="h-4 w-4" />
            </span>
            Log a period
          </CardTitle>
          <CardDescription>
            Logging the same start date again corrects that entry rather than adding a
            second one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="period-start">Started on</Label>
              <Input
                id="period-start"
                type="date"
                max={today}
                value={draft.startDate}
                onChange={(e) => setDraft((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-end">Ended on (leave blank if ongoing)</Label>
              <Input
                id="period-end"
                type="date"
                max={today}
                value={draft.endDate}
                onChange={(e) => setDraft((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <span className="text-subhead font-medium text-foreground">Flow</span>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FLOW_INTENSITIES.map((flow) => (
                <Button
                  key={flow}
                  type="button"
                  size="sm"
                  variant={draft.flow === flow ? "default" : "outline"}
                  onClick={() => setDraft((p) => ({ ...p, flow }))}
                >
                  {FLOW_LABELS[flow]}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-subhead font-medium text-foreground">Symptoms</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {CYCLE_SYMPTOMS.map((symptom) => {
                const selected = draft.symptoms.includes(symptom.value);
                return (
                  <button
                    key={symptom.value}
                    type="button"
                    onClick={() => toggleSymptom(symptom.value)}
                    aria-pressed={selected}
                    className={`rounded-full border px-3.5 py-1.5 text-footnote transition-colors ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-accent-soft/40 text-foreground-secondary hover:bg-accent-soft"
                    }`}
                  >
                    {symptom.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="period-notes">Notes</Label>
            <Textarea
              id="period-notes"
              rows={2}
              value={draft.notes}
              onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Anything you want to remember about this cycle…"
            />
          </div>

          <Button onClick={handleLogPeriod} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Save period
          </Button>
        </CardContent>
      </Card>

      {/* ── Missed months ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-title3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-primary">
              <CalendarX className="h-4 w-4" />
            </span>
            Months with no period
          </CardTitle>
          <CardDescription>
            Record these explicitly — a gap in your log could just be a month you forgot
            to fill in, and we won't treat it as a missed period unless you say so.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[200px_1fr_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="missed-month">Month</Label>
              <Input
                id="missed-month"
                type="month"
                max={monthOf(today)}
                value={missedDraft.month}
                onChange={(e) =>
                  setMissedDraft((p) => ({ ...p, month: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="missed-notes">Notes</Label>
              <Input
                id="missed-notes"
                value={missedDraft.notes}
                onChange={(e) =>
                  setMissedDraft((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder="Optional — e.g. started a new medication"
              />
            </div>
            <Button onClick={handleLogMissedMonth} variant="outline">
              Record
            </Button>
          </div>

          {missedMonths.length > 0 && (
            <ul className="space-y-2">
              {[...missedMonths].reverse().map((missed) => (
                <li
                  key={missed.month}
                  className="flex items-center justify-between rounded-2xl border border-border p-3.5"
                >
                  <div>
                    <span className="text-subhead font-medium text-foreground">{prettyMonth(missed.month)}</span>
                    {missed.notes && (
                      <span className="ml-2 text-footnote text-foreground-tertiary">{missed.notes}</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${prettyMonth(missed.month)}`}
                    onClick={async () => {
                      if (!patientId) return;
                      setMissedMonths(await deleteMissedMonth(patientId, missed.month));
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-foreground-tertiary" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Weight ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-title3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-primary">
              <Scale className="h-4 w-4" />
            </span>
            Weight
          </CardTitle>
          <CardDescription>
            {isPregnant
              ? "Gaining weight is the expected course of a pregnancy, so nothing here feeds your calorie target — that belongs with your obstetrician. Log it if it's useful to you."
              : "Once a week is plenty — weigh yourself at the same time of day, and don't read anything into a single kilo. Your diet plan uses the trend, not one reading."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[160px_160px_1fr_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="weight-date">Date</Label>
              <Input
                id="weight-date"
                type="date"
                max={today}
                value={weightDraft.date}
                onChange={(e) => setWeightDraft((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight-kg">Weight (kg)</Label>
              <Input
                id="weight-kg"
                type="number"
                min={25}
                max={250}
                step="0.1"
                value={weightDraft.weightKg}
                onChange={(e) =>
                  setWeightDraft((p) => ({ ...p, weightKg: e.target.value }))
                }
                placeholder="58.5"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight-notes">Notes</Label>
              <Input
                id="weight-notes"
                value={weightDraft.notes}
                onChange={(e) => setWeightDraft((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <Button onClick={handleLogWeight} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Log
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <h4 className="text-caption1 font-medium text-foreground-secondary">Trend</h4>
              <p className="mt-1 text-title3 text-foreground">
                {TREND_LABELS[weightAnalysis.trend]}
              </p>
              <p className="mt-0.5 text-footnote text-foreground-tertiary">
                {weightAnalysis.changeKg === null
                  ? "Log at least two readings a fortnight apart."
                  : `${weightAnalysis.changeKg > 0 ? "+" : ""}${weightAnalysis.changeKg} kg since ${prettyDate(
                      weightAnalysis.earliest!.date
                    )}`}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <h4 className="text-caption1 font-medium text-foreground-secondary">BMI</h4>
              <p className="mt-1 text-title3 text-foreground">
                {weightAnalysis.bmi ?? "—"}
              </p>
              <p className="mt-0.5 text-footnote text-foreground-tertiary">
                {weightAnalysis.band
                  ? BMI_BAND_LABELS[weightAnalysis.band]
                  : "Add your height in the questionnaire to see this."}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <h4 className="text-caption1 font-medium text-foreground-secondary">5% target</h4>
              <p className="mt-1 text-title3 text-foreground">
                {weightAnalysis.fivePercentTargetKg
                  ? `${weightAnalysis.fivePercentTargetKg} kg`
                  : "—"}
              </p>
              <p className="mt-0.5 text-footnote text-foreground-tertiary">
                {isPregnant
                  ? "Not a target during pregnancy — shown for after."
                  : "Losing 5% of body weight is the change with the strongest evidence for restoring PCOS cycles."}
              </p>
            </div>
          </div>

          {weightAnalysis.isRapidGain && !isPregnant && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-footnote text-foreground">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>
                You've gained {weightAnalysis.changeKgPerMonth} kg/month recently. Your
                next generated diet plan will move to a reduced-calorie, low-glycaemic
                pattern — worth mentioning to your doctor too.
              </span>
            </div>
          )}

          {weightChartData.length > 1 && (
            <div>
              <h4 className="mb-2 text-caption1 font-medium text-foreground-secondary">Your weight</h4>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} />
                    <YAxis domain={["dataMin - 2", "dataMax + 2"]} />
                    <Tooltip formatter={(value: number) => [`${value} kg`, "Weight"]} />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke={CHART_COLORS.primary}
                      strokeWidth={2}
                      dot
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── History & patterns ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-title3">Logged periods</CardTitle>
            <CardDescription>
              {periods.length} entr{periods.length === 1 ? "y" : "ies"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {periods.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
                <Droplet className="mb-2 h-6 w-6 text-foreground-tertiary" />
                <p className="text-footnote text-foreground-secondary">
                  Nothing logged yet. Add your last period above to get started.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {[...periods].reverse().map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-border p-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-subhead font-medium text-foreground">{prettyDate(entry.startDate)}</span>
                        {entry.endDate && (
                          <span className="text-footnote text-foreground-tertiary">
                            → {prettyDate(entry.endDate)}
                          </span>
                        )}
                        {entry.flow && (
                          <Badge variant="outline" className={FLOW_STYLES[entry.flow]}>
                            {FLOW_LABELS[entry.flow]}
                          </Badge>
                        )}
                      </div>
                      {entry.symptoms.length > 0 && (
                        <p className="mt-1 text-footnote text-foreground-secondary">
                          {entry.symptoms
                            .map(
                              (s) =>
                                CYCLE_SYMPTOMS.find((c) => c.value === s)?.label ?? s
                            )
                            .join(", ")}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="mt-1 text-footnote text-foreground-tertiary">{entry.notes}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove period starting ${prettyDate(entry.startDate)}`}
                      onClick={() => handleDeletePeriod(entry.id)}
                    >
                      <Trash2 className="h-4 w-4 text-foreground-tertiary" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-title3">Patterns</CardTitle>
            <CardDescription>Cycle lengths and your most common symptoms</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {cycleChartData.length > 0 ? (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cycleChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} />
                    <YAxis domain={[0, "dataMax + 5"]} />
                    <Tooltip formatter={(value: number) => [`${value} days`, "Cycle"]} />
                    <Line
                      type="monotone"
                      dataKey="length"
                      stroke={CHART_COLORS.sleep}
                      strokeWidth={2}
                      dot
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-footnote text-foreground-tertiary">
                Log two periods and your cycle length appears here.
              </p>
            )}

            {symptoms.length > 0 && (
              <div className="space-y-2.5">
                {symptoms.slice(0, 6).map(({ symptom, count }) => (
                  <div key={symptom}>
                    <div className="flex items-center justify-between text-footnote">
                      <span className="text-foreground">
                        {CYCLE_SYMPTOMS.find((c) => c.value === symptom)?.label ?? symptom}
                      </span>
                      <span className="text-foreground-tertiary">
                        {count}/{periods.length}
                      </span>
                    </div>
                    <Progress
                      className="mt-1 h-2"
                      value={(count / Math.max(1, periods.length)) * 100}
                    />
                  </div>
                ))}
              </div>
            )}

            {analysis.twiceInAMonth > 0 && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-accent-soft bg-accent-soft/60 p-4 text-footnote text-accent-soft-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {analysis.twiceInAMonth} month
                  {analysis.twiceInAMonth === 1 ? "" : "s"} had two periods. That is
                  tracked separately from irregular cycles because it costs you iron
                  rather than ovulation.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PeriodTracker;
