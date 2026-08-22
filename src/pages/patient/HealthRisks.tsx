import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import { endOfDay, format, isSameDay, startOfDay } from "date-fns";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  Baby,
  CalendarRange,
  ClipboardList,
  HeartPulse,
  History,
  Loader2,
  Watch,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { useCachedPageData } from "@/hooks/useCachedPageData";
import { supabase } from "@/lib/supabase";
import {
  BloodResultsSection,
  computeBmi,
  DiabetesRiskFactorsSection,
  MaternalVitalsSection,
  PreeclampsiaSection,
  ThyroidSection,
} from "@/components/health/ScreeningFields";
import { ScreeningResultsView } from "@/components/health/ScreeningResults";
import { ScreeningExercisePlan } from "@/components/wellness/ExercisePlan";
import { RiskScoreTrend } from "@/components/health/RiskScoreTrend";
import { AppleHealthPanel } from "@/components/health/AppleHealthPanel";
import { WatchSignalsCard } from "@/components/health/WatchSignalsCard";
import { WatchRiskCard } from "@/components/health/WatchRiskCard";
import { fetchScreeningSignals } from "@/services/healthSampleService";
import { EMPTY_SIGNALS, type ScreeningSignals } from "@/lib/healthSamples";
import { ReportUploadCard } from "@/components/health/ReportUploadCard";
import { isAnalysisEnabled } from "@/services/analysisService";
import { RISK_STYLES } from "@/lib/riskLevels";
import { validateMeasurements } from "@/lib/screeningValidation";
import {
  AssessmentData,
  buildScreeningInputFromAssessment,
  emptyScreeningInput,
  heightCmFromAssessment,
  isPregnantPatient,
  fetchScreenings,
  loadHealthCheck,
  saveScreening,
  screenPatient,
} from "@/services/diseaseDetectionService";
import {
  ScreeningInput,
  ScreeningResult,
  StoredScreening,
} from "@/types/diseaseDetection";

/** Date-range presets for the patient's own history. `0` means "all recorded". */
const RANGE_PRESETS = [
  { value: 1, label: "Today" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 0, label: "All" },
] as const;

/**
 * The patient's own maternal health check.
 *
 * She answers what only she can answer — symptoms, history and wellbeing
 * scales — and gets her risk results straight away. Lab values are not asked
 * for here; her doctor adds those on the clinician screening page, where this
 * submission arrives prefilled.
 */
const HealthRisks: React.FC = () => {
  const { toast } = useToast();

  const patientId = useAuthUserId();

  const [form, setForm] = useState<ScreeningInput>(emptyScreeningInput());
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [history, setHistory] = useState<StoredScreening[]>([]);

  // History filter — defaults to "All" so nothing is hidden the first time
  // this tab opens, regardless of how sparse or dense her check history is.
  const [rangeDays, setRangeDays] = useState<number>(0);
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [useCustomRange, setUseCustomRange] = useState(false);

  const [signals, setSignals] = useState<ScreeningSignals>(EMPTY_SIGNALS);

  const [isPregnant, setIsPregnant] = useState(true);
  const [isScreening, setIsScreening] = useState(false);
  const [activeTab, setActiveTab] = useState("check");

  // Raw profile JSON, kept so the pregnancy setup can merge into it rather than
  // overwrite it. The setup fields below let a patient open the check without
  // going back to the whole onboarding questionnaire.
  const [assessmentData, setAssessmentData] = useState<AssessmentData>(null);
  const [setupDueDate, setSetupDueDate] = useState("");
  const [setupHeightCm, setSetupHeightCm] = useState("");
  const [savingSetup, setSavingSetup] = useState(false);

  // Report reading needs Gemini; hide the card entirely when it is unconfigured
  // rather than offer an upload that can only fail.
  const [canReadReports, setCanReadReports] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isAnalysisEnabled().then((enabled) => {
      if (!cancelled) setCanReadReports(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cached, so returning to this tab re-renders her last check rather than
  // spinning while the same rows are read again.
  const { data, error, isFirstLoad } = useCachedPageData(
    ["health-check", patientId],
    () => loadHealthCheck(patientId as string),
    { enabled: !!patientId }
  );

  useEffect(() => {
    if (error) console.error("Error loading health check:", error);
  }, [error]);

  // Seeded once per patient: the form below is hers to edit, so a background
  // refresh must never overwrite what she is part-way through typing.
  const hasSeededForm = useRef(false);
  useEffect(() => {
    if (!data || hasSeededForm.current) return;
    hasSeededForm.current = true;

    const { assessment, screenings } = data;
    setAssessmentData(assessment);
    setIsPregnant(isPregnantPatient(assessment));
    const existingHeight = heightCmFromAssessment(assessment);
    setHeightCm(existingHeight);
    if (existingHeight) setSetupHeightCm(String(existingHeight));
    if (typeof assessment?.dueDate === "string") setSetupDueDate(assessment.dueDate);

    setHistory(screenings);
    if (screenings.length > 0) {
      // Reopen the most recent answers and result rather than a blank form.
      setForm(screenings[0].inputs);
      setResult(screenings[0].result);
    } else {
      setForm(buildScreeningInputFromAssessment(assessment));
    }
  }, [data]);

  // Measured inputs for the screening models, read from what the Watch synced.
  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    void fetchScreeningSignals(patientId)
      .then((next) => {
        if (!cancelled) setSignals(next);
      })
      .catch((err) => console.error("Could not read Apple Health signals:", err));
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  // Seeded once, and only into fields she has not answered herself. Measured
  // data beats recall, but it does not beat what she just typed.
  const hasSeededSignals = useRef(false);
  useEffect(() => {
    if (!hasSeededForm.current || hasSeededSignals.current) return;
    if (signals.daysOfData === 0) return;
    hasSeededSignals.current = true;

    if (signals.weightKg !== null) setWeightKg((current) => current ?? signals.weightKg);
    // Onboarding height wins: it was entered deliberately, and a stray Health
    // app entry should not silently move the denominator of her BMI.
    if (signals.heightCm !== null) setHeightCm((current) => current ?? signals.heightCm);
    if (signals.sedentary !== null) {
      setForm((current) => ({ ...current, sedentary_lifestyle: signals.sedentary as boolean }));
    }
  }, [signals]);

  const update = <K extends keyof ScreeningInput>(key: K, value: ScreeningInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const selectPreset = (days: number) => {
    setUseCustomRange(false);
    setRangeDays(days);
  };

  const filteredHistory = useMemo(() => {
    if (useCustomRange && customRange?.from) {
      const from = startOfDay(customRange.from).getTime();
      const to = endOfDay(customRange.to ?? customRange.from).getTime();
      return history.filter((entry) => {
        const t = new Date(entry.createdAt).getTime();
        return t >= from && t <= to;
      });
    }
    if (rangeDays === 0) return history;
    const cutoff = Date.now() - rangeDays * 86_400_000;
    return history.filter((entry) => new Date(entry.createdAt).getTime() >= cutoff);
  }, [history, useCustomRange, customRange, rangeDays]);

  // How the active range reads in a sentence, e.g. "the last 30 days".
  const rangeLabel = useMemo(() => {
    if (useCustomRange && customRange?.from) {
      const to = customRange.to ?? customRange.from;
      return isSameDay(customRange.from, to)
        ? format(customRange.from, "MMM d, yyyy")
        : `${format(customRange.from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
    }
    if (rangeDays === 0) return "all your recorded checks";
    if (rangeDays === 1) return "today";
    return `the last ${rangeDays} days`;
  }, [useCustomRange, customRange, rangeDays]);

  /**
   * Record pregnancy (plus optional due date and height) straight from this
   * page and open the check, merging into the existing profile so nothing else
   * is lost. Saves the patient a trip back through the whole questionnaire.
   */
  const savePregnancySetup = async () => {
    if (!patientId) return;
    setSavingSetup(true);
    try {
      const height = Number(setupHeightCm);
      const merged: Record<string, unknown> = {
        ...(assessmentData ?? {}),
        lifeStage: "pregnancy",
        ...(setupDueDate ? { dueDate: setupDueDate } : {}),
        ...(Number.isFinite(height) && height > 0 ? { heightCm: height } : {}),
      };

      const { error } = await supabase
        .from("patients")
        .update({ assessment_data: merged })
        .eq("id", patientId);
      if (error) throw new Error(error.message);

      setAssessmentData(merged);
      setHeightCm(heightCmFromAssessment(merged));
      setForm(buildScreeningInputFromAssessment(merged));
      setIsPregnant(true);
      toast({
        title: "Your health check is ready",
        description: "Fill in your latest measurements to see your results.",
      });
    } catch (error) {
      console.error("Could not save pregnancy details:", error);
      toast({
        title: "Could not save",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingSetup(false);
    }
  };

  const runCheck = async () => {
    // Turn the height captured at onboarding plus today's weight into BMI,
    // so the maternal model gets it without asking the patient for BMI.
    const bmi = computeBmi(heightCm, weightKg) ?? form.bmi ?? null;
    const payload: ScreeningInput = { ...form, bmi };

    // Catch impossible readings here so the patient gets a sentence she can act
    // on, rather than the backend's raw pydantic validation error.
    const problems = validateMeasurements(payload);
    if (problems.length > 0) {
      toast({
        title: "Please check your measurements",
        description: problems.join(" "),
        variant: "destructive",
      });
      return;
    }

    setIsScreening(true);
    try {
      // The three trained models — the rule-only conditions need clinical
      // findings and lab panels this form deliberately does not ask for.
      const screening = await screenPatient(payload, [
        "anaemia",
        "pregnancy_risk",
        "gdm",
        "thyroid",
        "preeclampsia",
      ]);
      setResult(screening);
      setActiveTab("results");

      let persisted = false;
      if (patientId) {
        persisted = await saveScreening({
          patientId,
          submittedBy: "patient",
          inputs: payload,
          result: screening,
        });
        if (persisted) setHistory(await fetchScreenings(patientId));
      }

      toast({
        title: "Health check complete",
        description: persisted
          ? `Overall: ${RISK_STYLES[screening.overall_risk_level].label}. Your doctor can see these answers.`
          : `Overall: ${RISK_STYLES[screening.overall_risk_level].label}. Your results were not saved — please tell your doctor.`,
      });
    } catch (error) {
      console.error("Health check failed:", error);
      toast({
        title: "Could not complete the check",
        description:
          error instanceof Error
            ? error.message
            : "Could not reach the screening service. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsScreening(false);
    }
  };

  // First visit only — a return to this tab renders from the cached snapshot.
  if (isFirstLoad) {
    return (
      <div className="flex-1 p-6">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-9 w-9 animate-spin text-primary" />
            <p className="text-subhead text-foreground-secondary">Getting your health check ready…</p>
          </div>
        </div>
      </div>
    );
  }

  // The whole screening is pregnancy-specific — every score is calibrated on
  // maternal conditions, so offering it outside pregnancy would be misleading.
  // Rather than a dead end, let her confirm she is pregnant (and capture the
  // one-off details) right here so the check opens without re-doing onboarding.
  if (!isPregnant) {
    return (
      <div className="flex-1 p-6 sm:p-10">
        <div className="mx-auto max-w-lg pt-10 text-center sm:pt-16">
          <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-primary">
            <Baby className="h-8 w-8" />
          </span>
          <h1 className="text-title2 text-foreground">Set up your pregnancy health check</h1>
          <p className="mx-auto mt-3 max-w-sm text-body text-foreground-secondary">
            Every risk score here is calibrated for pregnancy. If that's you, confirm
            below to open your check — these details are only asked once.
          </p>

          <div className="mx-auto mt-10 max-w-sm space-y-5 text-left">
            <div className="space-y-1.5">
              <Label htmlFor="setup-due-date">Estimated due date (optional)</Label>
              <Input
                id="setup-due-date"
                type="date"
                value={setupDueDate}
                onChange={(e) => setSetupDueDate(e.target.value)}
              />
              <p className="text-caption1 text-foreground-tertiary">
                Used to work out how many weeks along you are.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="setup-height">Height in cm (optional)</Label>
              <Input
                id="setup-height"
                type="number"
                min={100}
                max={220}
                placeholder="e.g. 160"
                value={setupHeightCm}
                onChange={(e) => setSetupHeightCm(e.target.value)}
              />
              <p className="text-caption1 text-foreground-tertiary">
                Used with your weight to work out BMI.
              </p>
            </div>
            <Button
              onClick={savePregnancySetup}
              disabled={savingSetup}
              size="lg"
              className="w-full gap-2"
            >
              {savingSetup ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Baby className="h-4 w-4" />
                  Yes, I'm pregnant — start my health check
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-8 p-4 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary sm:flex">
          <HeartPulse className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-title1 text-foreground">Pregnancy Health Check</h1>
          <p className="mt-1.5 max-w-2xl text-body text-foreground-secondary">
            A calm, at-your-pace look at your anaemia, pregnancy risk, gestational
            diabetes, thyroid and preeclampsia picture — based on what you share below.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Below `sm`, 3 icon+label tabs don't fit the default inline-flex
            list without crowding — scroll horizontally instead of wrapping
            or truncating labels. */}
        <TabsList className="flex w-full justify-start gap-1 overflow-x-auto sm:inline-flex sm:w-auto sm:justify-center">
          <TabsTrigger value="check" className="shrink-0 gap-1.5 whitespace-nowrap">
            <ClipboardList className="h-4 w-4 shrink-0" />
            Health check
          </TabsTrigger>
          <TabsTrigger value="results" className="shrink-0 gap-1.5 whitespace-nowrap">
            <Activity className="h-4 w-4 shrink-0" />
            My results
          </TabsTrigger>
          <TabsTrigger value="history" className="shrink-0 gap-1.5 whitespace-nowrap">
            <History className="h-4 w-4 shrink-0" />
            Past checks
          </TabsTrigger>
          <TabsTrigger value="watch" className="shrink-0 gap-1.5 whitespace-nowrap">
            <Watch className="h-4 w-4 shrink-0" />
            Apple Watch
          </TabsTrigger>
        </TabsList>

        {/* Passive device data, alongside — not instead of — the symptom entry
            on the other tabs. The two answer different questions: what she is
            feeling, and what her body has been doing. */}
        <TabsContent value="watch" className="space-y-5">
          {/* Risk first, charts underneath: the screening is the answer she
              came for, and the readings behind it are the supporting detail. */}
          <WatchRiskCard signals={signals} assessment={assessmentData} />
          <AppleHealthPanel patientId={patientId} />
        </TabsContent>

        <TabsContent value="check" className="space-y-5">
          <WatchSignalsCard signals={signals} bmi={computeBmi(heightCm, weightKg)} />
          {canReadReports && <ReportUploadCard onApply={update} />}

          <Card>
            <CardHeader>
              <CardTitle className="text-title3">Your latest measurements</CardTitle>
              <CardDescription>
                Enter the readings from your most recent antenatal check-up. Leave
                a field blank if you do not have it — the check still runs on what
                you provide.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MaternalVitalsSection
                form={form}
                update={update}
                weightKg={weightKg}
                onWeightKg={setWeightKg}
                heightCm={heightCm}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-title3">Blood test results</CardTitle>
              <CardDescription>
                Optional — these sharpen your gestational diabetes estimate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BloodResultsSection form={form} update={update} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-title3">Blood pressure &amp; scan</CardTitle>
              <CardDescription>
                Optional — these sharpen your preeclampsia estimate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PreeclampsiaSection form={form} update={update} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-title3">Thyroid</CardTitle>
              <CardDescription>
                Optional — your thyroid blood results and history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ThyroidSection form={form} update={update} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-title3">Diabetes risk factors</CardTitle>
              <CardDescription>
                Tick anything that applies to you. Some may already be filled in
                from your questionnaire.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DiabetesRiskFactorsSection form={form} update={update} />

              <div className="flex justify-end border-t border-border pt-6 mt-6">
                <Button onClick={runCheck} disabled={isScreening} size="lg" className="gap-2">
                  {isScreening ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking…
                    </>
                  ) : (
                    <>
                      <Activity className="h-4 w-4" />
                      See my results
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          {!result ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-primary">
                <Activity className="h-7 w-7" />
              </span>
              <h3 className="text-title3 text-foreground">No results yet</h3>
              <p className="mt-1.5 max-w-sm text-subhead text-foreground-secondary">
                Fill in the health check and your results will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <Card className="border-accent-soft bg-accent-soft/50">
                <CardContent className="p-5 text-footnote leading-relaxed text-accent-soft-foreground">
                  These results are a guide, not a diagnosis. They're based only
                  on what you entered — a blood or urine test can change them.
                  Share them with your doctor, and seek care straight away if you
                  have bleeding, severe pain, a bad headache or blurred vision.
                </CardContent>
              </Card>
              <ScreeningResultsView result={result} audience="patient" />

              {/* What to *do* about the risks above. Kept on the same tab as the
                  results so a flagged condition and its exercises are read
                  together rather than a page apart. */}
              <div className="mt-5">
                <ScreeningExercisePlan
                  result={result}
                  isPregnant={isPregnant}
                  audience="patient"
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-title3 text-foreground">Past Checks</h3>
              <p className="text-footnote text-foreground-secondary">
                Checks you have completed, and screenings your doctor has run.
              </p>
            </div>

            {history.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-border bg-muted/40 p-1">
                {RANGE_PRESETS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    size="sm"
                    variant={!useCustomRange && rangeDays === opt.value ? "default" : "ghost"}
                    onClick={() => selectPreset(opt.value)}
                    className="h-9 px-3"
                  >
                    {opt.label}
                  </Button>
                ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant={useCustomRange ? "default" : "ghost"}
                      className="h-9 px-3 gap-1.5"
                    >
                      <CalendarRange className="w-3.5 h-3.5" />
                      {useCustomRange && customRange?.from ? rangeLabel : "Custom"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="range"
                      selected={customRange}
                      defaultMonth={customRange?.from}
                      onSelect={(range) => {
                        setCustomRange(range);
                        setUseCustomRange(!!range?.from);
                      }}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {history.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-primary">
                <History className="h-7 w-7" />
              </span>
              <h3 className="text-title3 text-foreground">No checks yet</h3>
              <p className="mt-1.5 max-w-sm text-subhead text-foreground-secondary">
                You have not completed a health check yet.
              </p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-primary">
                <History className="h-7 w-7" />
              </span>
              <h3 className="text-title3 text-foreground">Nothing found for {rangeLabel}</h3>
              <p className="mt-1.5 max-w-sm text-subhead text-foreground-secondary">
                You have {history.length} recorded check{history.length === 1 ? "" : "s"},
                just none within this window.
              </p>
              <Button variant="outline" className="mt-5" onClick={() => selectPreset(0)}>
                Show all
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <RiskScoreTrend screenings={filteredHistory} rangeLabel={rangeLabel} />

              <Card>
                <CardHeader>
                  <CardTitle className="text-subhead font-semibold">
                    {filteredHistory.length === history.length
                      ? `All ${history.length} check${history.length === 1 ? "" : "s"}`
                      : `${filteredHistory.length} of ${history.length} checks`}
                  </CardTitle>
                  <CardDescription>
                    Showing {rangeLabel}. Tap any check to reopen its results.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5">
                    {filteredHistory.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => {
                          setResult(entry.result);
                          setForm(entry.inputs);
                          setActiveTab("results");
                        }}
                        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border p-4 text-left transition-colors hover:bg-muted/50"
                      >
                        <div>
                          <p className="text-subhead font-medium text-foreground">
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                          <p className="mt-0.5 text-caption1 text-foreground-tertiary">
                            {entry.submittedBy === "patient"
                              ? "Your health check"
                              : "Screening by your doctor"}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={RISK_STYLES[entry.result.overall_risk_level].badge}
                        >
                          {RISK_STYLES[entry.result.overall_risk_level].label}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HealthRisks;
