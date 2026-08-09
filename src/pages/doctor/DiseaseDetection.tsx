import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import {
  Activity,
  AlertTriangle,
  Baby,
  BarChart3,
  ClipboardList,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { ScreeningResultsView } from "@/components/health/ScreeningResults";
import { ScreeningExercisePlan } from "@/components/wellness/ExercisePlan";
import { RiskScoreTrend } from "@/components/health/RiskScoreTrend";
import {
  AnalysisUnavailableError,
  analyseScreenings,
  isAnalysisEnabled,
} from "@/services/analysisService";
import { RISK_STYLES } from "@/lib/riskLevels";
import { CHART_COLORS, CHART_NEUTRALS } from "@/lib/chartColors";
import {
  AssessmentData,
  fetchScreenings,
  isPregnantPatient,
} from "@/services/diseaseDetectionService";
import { ScreeningInput, StoredScreening } from "@/types/diseaseDetection";

interface PregnantPatient {
  patientId: string;
  name: string;
  email: string;
  patientCode?: string;
  trimester?: string;
  assessmentData: AssessmentData;
}

/** The accepted-consultation row this page reads, with its joined patient. */
interface ConsultationRow {
  patient_id: string;
  patient_name?: string;
  patient_email?: string;
  patients?: {
    patient_code?: string;
    name?: string;
    assessment_data?: AssessmentData;
  } | null;
}

const TRIMESTER_LABELS: Record<string, string> = {
  first: "1st trimester",
  second: "2nd trimester",
  third: "3rd trimester",
  unknown: "Trimester unknown",
};

/** Date-range presets for the trend view. `0` means "all recorded". */
const RANGE_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 15, label: "15 days" },
  { value: 30, label: "30 days" },
  { value: 0, label: "All" },
] as const;

// Chart chrome. Grid/axis are recessive; the vital series and its second line
// (diastolic) come from the shared brand palette rather than fixed hues, so
// this dashboard stays in step with every other chart in the app.
const CHART = {
  grid: CHART_NEUTRALS.grid,
  axis: CHART_NEUTRALS.axis,
  primary: CHART_COLORS.primary,
  secondary: CHART_COLORS.activity,
};

/** Numeric vitals we can trend from a screening's inputs. */
interface VitalMetric {
  key: keyof ScreeningInput;
  label: string;
  unit: string;
  normal: string;
}

const VITAL_METRICS: VitalMetric[] = [
  { key: "hemoglobin", label: "Hemoglobin", unit: "g/dL", normal: "≥ 11 g/dL in pregnancy" },
  { key: "bmi", label: "BMI", unit: "kg/m²", normal: "18.5 – 24.9" },
  { key: "hba1c", label: "HbA1c", unit: "%", normal: "< 5.7 %" },
  { key: "ogtt_1hr", label: "OGTT (1-hour)", unit: "mg/dL", normal: "< 180 mg/dL" },
  { key: "tsh", label: "TSH", unit: "mIU/L", normal: "0.1 – 4.0 mIU/L" },
  { key: "t3", label: "T3", unit: "", normal: "reference-dependent" },
  { key: "t4", label: "T4", unit: "", normal: "reference-dependent" },
  { key: "urine_wbc", label: "Urine WBC", unit: "/hpf", normal: "< 5 /hpf" },
  { key: "phq9_score", label: "PHQ-9 (depression)", unit: "", normal: "< 5" },
  { key: "edinburgh_score", label: "Edinburgh (EPDS)", unit: "", normal: "< 10" },
];

type ChartRow = { t: number; label: string } & Record<string, number | string | null>;

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Shared tooltip styling so every chart reads the same. */
const tooltipProps = {
  contentStyle: {
    borderRadius: 8,
    border: `1px solid ${CHART_NEUTRALS.tooltipBorder}`,
    fontSize: 12,
    padding: "6px 10px",
  },
  labelStyle: { color: CHART_NEUTRALS.tick, fontWeight: 600 },
} as const;

/** A compact stat tile for the headline numbers above the charts. */
const StatTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
}> = ({ icon, label, value, hint }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold mt-1 leading-tight">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </CardContent>
  </Card>
);

const DiseaseDetection: React.FC = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [patients, setPatients] = useState<PregnantPatient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const [history, setHistory] = useState<StoredScreening[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [rangeDays, setRangeDays] = useState<number>(30);

  // Gemini-written read of the history. Kept opt-in per patient rather than
  // generated on load: it is a paid call, and the doctor may only want it for
  // the cases that look unclear.
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.patientId === selectedPatientId) ?? null,
    [patients, selectedPatientId]
  );

  // --- Load the doctor's accepted patients, keeping the pregnant ones -------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setIsLoadingPatients(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("consultation_requests")
          .select(
            `id, patient_id, patient_name, patient_email,
             patients ( patient_code, name, assessment_data )`
          )
          .eq("doctor_id", authData.user.id)
          .eq("status", "accepted");

        if (error) throw error;
        if (cancelled) return;

        const seen = new Set<string>();
        const pregnant: PregnantPatient[] = [];

        for (const row of data ?? []) {
          const record = row as unknown as ConsultationRow;
          const assessment = record.patients?.assessment_data;
          const patientId = record.patient_id;

          if (!patientId || seen.has(patientId)) continue;
          if (!isPregnantPatient(assessment)) continue;

          seen.add(patientId);
          pregnant.push({
            patientId,
            name: record.patients?.name || record.patient_name || "Unknown patient",
            email: record.patient_email || "",
            patientCode: record.patients?.patient_code,
            trimester: assessment?.pregnancyTrimester as string | undefined,
            assessmentData: assessment,
          });
        }

        pregnant.sort((a, b) => a.name.localeCompare(b.name));
        setPatients(pregnant);
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading pregnant patients:", error);
        toast({
          title: "Could not load patients",
          description: "Failed to fetch your accepted patients. Please try again.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setIsLoadingPatients(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  // --- Selecting a patient pulls her recorded screenings ------------------
  const selectPatient = useCallback(
    async (patient: PregnantPatient) => {
      setSelectedPatientId(patient.patientId);
      setSearchParams({ patientId: patient.patientId }, { replace: true });
      setIsLoadingHistory(true);
      try {
        const stored = await fetchScreenings(patient.patientId);
        setHistory(stored);
      } catch (error) {
        console.error("Error loading screening history:", error);
        setHistory([]);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [setSearchParams]
  );

  // Deep link from the Patients page: /doctor/patient-analysis?patientId=...
  useEffect(() => {
    const requested = searchParams.get("patientId");
    if (!requested || selectedPatientId || patients.length === 0) return;

    const match = patients.find((p) => p.patientId === requested);
    if (match) selectPatient(match);
  }, [patients, searchParams, selectedPatientId, selectPatient]);

  const filteredPatients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return patients;
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term) ||
        p.patientCode?.toLowerCase().includes(term)
    );
  }, [patients, searchTerm]);

  // Screenings oldest→newest, so trend lines read left (past) to right (now).
  const sorted = useMemo(
    () =>
      [...history].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [history]
  );

  const screeningsInRange = useMemo(() => {
    if (rangeDays === 0) return sorted;
    const cutoff = Date.now() - rangeDays * 86_400_000;
    return sorted.filter((s) => new Date(s.createdAt).getTime() >= cutoff);
  }, [sorted, rangeDays]);

  const latest = screeningsInRange.length
    ? screeningsInRange[screeningsInRange.length - 1]
    : null;

  // Flatten each screening's inputs into one chart row.
  const chartRows = useMemo<ChartRow[]>(
    () =>
      screeningsInRange.map((s) => {
        const i = s.inputs;
        const row: ChartRow = { t: new Date(s.createdAt).getTime(), label: dayLabel(s.createdAt) };
        for (const m of VITAL_METRICS) {
          const v = i[m.key];
          row[m.key as string] = typeof v === "number" ? v : null;
        }
        row.bp_systolic = typeof i.bp_systolic === "number" ? i.bp_systolic : null;
        row.bp_diastolic = typeof i.bp_diastolic === "number" ? i.bp_diastolic : null;
        return row;
      }),
    [screeningsInRange]
  );

  const hasData = (key: string) => chartRows.some((r) => r[key] != null);
  const availableVitals = VITAL_METRICS.filter((m) => hasData(m.key as string));
  const hasBP = hasData("bp_systolic") || hasData("bp_diastolic");

  const rangeLabel = rangeDays === 0 ? "all recorded screenings" : `the last ${rangeDays} days`;

  // Hide the panel entirely when the backend has no Gemini key, rather than
  // offering a button that can only fail.
  useEffect(() => {
    let cancelled = false;
    isAnalysisEnabled().then((enabled) => {
      if (!cancelled) setAiEnabled(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A written analysis belongs to one patient over one range; showing a stale
  // one against different data would be worse than showing none.
  useEffect(() => {
    setAiAnalysis(null);
    setAiError(null);
  }, [selectedPatientId, rangeDays]);

  const generateAnalysis = async () => {
    setIsAnalysing(true);
    setAiError(null);
    try {
      setAiAnalysis(await analyseScreenings(screeningsInRange, rangeLabel));
    } catch (error) {
      const message =
        error instanceof AnalysisUnavailableError
          ? "The analysis service is not available right now. Your charts and risk scores are unaffected."
          : error instanceof Error
            ? error.message
            : "Could not generate the analysis.";
      setAiError(message);
    } finally {
      setIsAnalysing(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-7 h-7" />
            Patient Analysis
          </h1>
          <p className="text-muted-foreground">
            Trends from each patient's maternal screenings — vitals, labs and
            wellbeing scores over time, with the detected conditions and their
            risk. Read-only: the data comes from what the patient submits in her
            Health Check.
          </p>
        </div>
        <Badge variant="outline" className="gap-1 shrink-0">
          <Baby className="w-3 h-3" />
          {patients.length} pregnant patient{patients.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {/*
        Patient selection takes the full width as a browsable list until a
        patient is chosen, then collapses to a horizontal strip above the
        analysis. A fixed sidebar would squeeze the charts into a narrow column
        and leave the doctor scrolling for everything below the fold.
      */}
      {!selectedPatient ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pregnant Patients</CardTitle>
            <CardDescription>
              Patients you have accepted whose questionnaire marks them pregnant.
              Pick one to see her screening trends and detected risks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or ID..."
                className="pl-10"
              />
            </div>

            {isLoadingPatients ? (
              <div className="py-8 text-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading patients...
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {patients.length === 0
                  ? "No pregnant patients yet. They appear here once you accept a consultation request from a patient whose questionnaire life stage is pregnancy."
                  : "No patients match your search."}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredPatients.map((patient) => (
                  <button
                    key={patient.patientId}
                    type="button"
                    onClick={() => selectPatient(patient)}
                    className="text-left rounded-lg border p-3 transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    <p className="font-medium truncate">{patient.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {patient.patientCode ? `${patient.patientCode} · ` : ""}
                      {TRIMESTER_LABELS[patient.trimester ?? "unknown"] ??
                        "Trimester unknown"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {patients.map((patient) => (
            <button
              key={patient.patientId}
              type="button"
              onClick={() => selectPatient(patient)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors ${
                patient.patientId === selectedPatientId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted/50"
              }`}
            >
              <span className="font-medium">{patient.name}</span>
              <span
                className={`ml-2 text-xs ${
                  patient.patientId === selectedPatientId
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground"
                }`}
              >
                {patient.patientCode ?? ""}
              </span>
            </button>
          ))}
        </div>
      )}

      {selectedPatient && (
          <div className="space-y-6">
            {/* Header + range selector */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{selectedPatient.name}</h2>
                <p className="text-sm text-muted-foreground">{selectedPatient.email}</p>
              </div>
              <div className="flex items-center gap-1 rounded-lg border p-1">
                {RANGE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={rangeDays === opt.value ? "default" : "ghost"}
                    onClick={() => setRangeDays(opt.value)}
                    className="h-8 px-3"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {isLoadingHistory ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading screening history...
                </CardContent>
              </Card>
            ) : history.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-semibold mb-2">No screenings yet</h3>
                  <p className="text-muted-foreground">
                    This analysis fills in once {selectedPatient.name.split(" ")[0]}{" "}
                    completes a Health Check. Each submission adds a point to every
                    trend below.
                  </p>
                </CardContent>
              </Card>
            ) : screeningsInRange.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-semibold mb-2">
                    Nothing in {rangeLabel}
                  </h3>
                  <p className="text-muted-foreground">
                    She has {history.length} recorded screening
                    {history.length === 1 ? "" : "s"}, but none within this window.
                    Switch to a wider range to see them.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setRangeDays(0)}
                  >
                    Show all
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* --- Headline stats --- */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatTile
                    icon={
                      latest?.result.overall_risk_level === "low" ? (
                        <ShieldCheck className="w-4 h-4" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )
                    }
                    label="Overall risk"
                    value={
                      latest ? (
                        <span
                          className={
                            RISK_STYLES[latest.result.overall_risk_level].badge +
                            " px-2 py-0.5 rounded-md text-base"
                          }
                        >
                          {RISK_STYLES[latest.result.overall_risk_level].label}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                    hint="From the most recent screening"
                  />
                  <StatTile
                    icon={<BarChart3 className="w-4 h-4" />}
                    label="Screenings"
                    value={screeningsInRange.length}
                    hint={`Within ${rangeLabel}`}
                  />
                  <StatTile
                    icon={<AlertTriangle className="w-4 h-4" />}
                    label="Highest risk"
                    value={
                      <span className="text-lg">
                        {latest?.result.highest_risk_condition
                          ? latest.result.conditions.find(
                              (c) => c.condition === latest.result.highest_risk_condition
                            )?.label ?? "—"
                          : "None"}
                      </span>
                    }
                    hint="Leading condition now"
                  />
                  <StatTile
                    icon={<TrendingUp className="w-4 h-4" />}
                    label="Last screening"
                    value={
                      <span className="text-lg">
                        {latest ? dayLabel(latest.createdAt) : "—"}
                      </span>
                    }
                    hint={
                      latest
                        ? new Date(latest.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : undefined
                    }
                  />
                </div>

                {/* --- Written analysis (Gemini) --- */}
                {aiEnabled && (
                  <Card>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Sparkles className="w-5 h-5" />
                            Written analysis
                          </CardTitle>
                          <CardDescription>
                            An AI read of the screenings below over {rangeLabel} —
                            what the trend shows and what to consider next. The
                            risk scores themselves are unchanged.
                          </CardDescription>
                        </div>
                        <Button
                          onClick={generateAnalysis}
                          disabled={isAnalysing}
                          variant={aiAnalysis ? "outline" : "default"}
                          className="gap-2 shrink-0"
                        >
                          {isAnalysing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Analysing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              {aiAnalysis ? "Regenerate" : "Analyse this history"}
                            </>
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    {(aiAnalysis || aiError) && (
                      <CardContent>
                        {aiError ? (
                          <p className="text-sm text-muted-foreground">{aiError}</p>
                        ) : (
                          <>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">
                              {aiAnalysis}
                            </div>
                            <p className="text-xs text-muted-foreground mt-4 pt-3 border-t">
                              AI-generated from this patient's recorded screenings.
                              Clinical judgement remains yours.
                            </p>
                          </>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* --- Vital / lab trends --- */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      Vitals &amp; lab trends
                    </CardTitle>
                    <CardDescription>
                      Each measurement the patient has recorded over {rangeLabel}.
                      Charts only appear for values that were actually measured.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {availableVitals.length === 0 && !hasBP ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No numeric measurements recorded in this window — the
                        patient's Health Check does not ask for lab values, so
                        these fill in when a clinician records them.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Blood pressure — two same-axis series */}
                        {hasBP && (
                          <div className="rounded-lg border p-4">
                            <div className="flex items-baseline justify-between mb-1">
                              <h4 className="font-medium">Blood pressure</h4>
                              <span className="text-xs text-muted-foreground">mmHg</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3">
                              Normal &lt; 140 / 90
                            </p>
                            <ResponsiveContainer width="100%" height={180}>
                              <LineChart
                                data={chartRows}
                                margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke={CHART.grid}
                                  vertical={false}
                                />
                                <XAxis
                                  dataKey="label"
                                  tick={{ fontSize: 11, fill: CHART.axis }}
                                  tickLine={false}
                                  axisLine={{ stroke: CHART.grid }}
                                />
                                <YAxis
                                  tick={{ fontSize: 11, fill: CHART.axis }}
                                  tickLine={false}
                                  axisLine={false}
                                  width={44}
                                />
                                <Tooltip {...tooltipProps} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Line
                                  name="Systolic"
                                  type="monotone"
                                  dataKey="bp_systolic"
                                  stroke={CHART.primary}
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                  connectNulls
                                />
                                <Line
                                  name="Diastolic"
                                  type="monotone"
                                  dataKey="bp_diastolic"
                                  stroke={CHART.secondary}
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                  connectNulls
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        {availableVitals.map((m) => (
                          <div key={m.key as string} className="rounded-lg border p-4">
                            <div className="flex items-baseline justify-between mb-1">
                              <h4 className="font-medium">{m.label}</h4>
                              {m.unit && (
                                <span className="text-xs text-muted-foreground">
                                  {m.unit}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-3">
                              Normal {m.normal}
                            </p>
                            <ResponsiveContainer width="100%" height={180}>
                              <LineChart
                                data={chartRows}
                                margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke={CHART.grid}
                                  vertical={false}
                                />
                                <XAxis
                                  dataKey="label"
                                  tick={{ fontSize: 11, fill: CHART.axis }}
                                  tickLine={false}
                                  axisLine={{ stroke: CHART.grid }}
                                />
                                <YAxis
                                  tick={{ fontSize: 11, fill: CHART.axis }}
                                  tickLine={false}
                                  axisLine={false}
                                  width={44}
                                  domain={["auto", "auto"]}
                                />
                                <Tooltip {...tooltipProps} />
                                <Line
                                  name={m.label}
                                  type="monotone"
                                  dataKey={m.key as string}
                                  stroke={CHART.primary}
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                  connectNulls
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* --- Risk score trend (small multiples) --- */}
                <RiskScoreTrend screenings={screeningsInRange} rangeLabel={rangeLabel} />

                {/* --- Detected conditions & risk (latest screening) --- */}
                {latest && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <ClipboardList className="w-5 h-5" />
                        Detected conditions &amp; risk
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        From the most recent screening on{" "}
                        {new Date(latest.createdAt).toLocaleString()} (
                        {latest.submittedBy === "patient"
                          ? "self-reported by the patient"
                          : "recorded by a clinician"}
                        ).
                      </p>
                    </div>
                    <ScreeningResultsView result={latest.result} audience="clinician" />

                    {/* Movement is the intervention the doctor hands over at the
                        end of the consultation, so the plan for the conditions
                        just flagged sits with them. Every patient on this page
                        is pregnant, so the pregnancy-safe substitutions apply. */}
                    <ScreeningExercisePlan
                      result={latest.result}
                      isPregnant
                      audience="clinician"
                    />
                  </div>
                )}
              </>
            )}
          </div>
      )}
    </div>
  );
};

export default DiseaseDetection;
