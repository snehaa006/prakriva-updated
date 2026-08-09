import React, { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Baby, ClipboardList, HeartPulse, History, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  BloodResultsSection,
  computeBmi,
  DiabetesRiskFactorsSection,
  MaternalVitalsSection,
} from "@/components/health/ScreeningFields";
import { ScreeningResultsView } from "@/components/health/ScreeningResults";
import { RISK_STYLES } from "@/lib/riskLevels";
import { validateMeasurements } from "@/lib/screeningValidation";
import {
  AssessmentData,
  buildScreeningInputFromAssessment,
  emptyScreeningInput,
  heightCmFromAssessment,
  isPregnantPatient,
  fetchScreenings,
  saveScreening,
  screenPatient,
} from "@/services/diseaseDetectionService";
import {
  ScreeningInput,
  ScreeningResult,
  StoredScreening,
} from "@/types/diseaseDetection";

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

  const [patientId, setPatientId] = useState<string | null>(null);
  const [form, setForm] = useState<ScreeningInput>(emptyScreeningInput());
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [history, setHistory] = useState<StoredScreening[]>([]);
  const [isPregnant, setIsPregnant] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isScreening, setIsScreening] = useState(false);
  const [activeTab, setActiveTab] = useState("check");

  // Raw profile JSON, kept so the pregnancy setup can merge into it rather than
  // overwrite it. The setup fields below let a patient open the check without
  // going back to the whole onboarding questionnaire.
  const [assessmentData, setAssessmentData] = useState<AssessmentData>(null);
  const [setupDueDate, setSetupDueDate] = useState("");
  const [setupHeightCm, setSetupHeightCm] = useState("");
  const [savingSetup, setSavingSetup] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        setIsLoading(false);
        return;
      }
      if (!cancelled) setPatientId(user.id);

      try {
        const { data: patient } = await supabase
          .from("patients")
          .select("assessment_data")
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) return;
        const assessment = (patient?.assessment_data as AssessmentData) ?? null;
        setAssessmentData(assessment);
        setIsPregnant(isPregnantPatient(assessment));
        const existingHeight = heightCmFromAssessment(assessment);
        setHeightCm(existingHeight);
        if (existingHeight) setSetupHeightCm(String(existingHeight));
        if (typeof assessment?.dueDate === "string") setSetupDueDate(assessment.dueDate);
        setForm(buildScreeningInputFromAssessment(assessment));

        const stored = await fetchScreenings(user.id);
        if (cancelled) return;

        setHistory(stored);
        if (stored.length > 0) {
          // Reopen the most recent answers and result rather than a blank form.
          setForm(stored[0].inputs);
          setResult(stored[0].result);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading health check:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = <K extends keyof ScreeningInput>(key: K, value: ScreeningInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

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

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading your health check...</p>
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
      <div className="flex-1 p-6">
        <Card className="max-w-2xl mx-auto mt-12">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <Baby className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-60" />
              <h3 className="text-xl font-semibold mb-2">
                Set up your pregnancy health check
              </h3>
              <p className="text-muted-foreground">
                Every risk score here is specific to pregnancy. If you are
                pregnant, confirm below to open your health check. These details
                are only asked once.
              </p>
            </div>

            <div className="space-y-4 max-w-sm mx-auto">
              <div className="space-y-1">
                <Label htmlFor="setup-due-date">Estimated due date (optional)</Label>
                <Input
                  id="setup-due-date"
                  type="date"
                  value={setupDueDate}
                  onChange={(e) => setSetupDueDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Used to work out how many weeks along you are.
                </p>
              </div>
              <div className="space-y-1">
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
                <p className="text-xs text-muted-foreground">
                  Used with your weight to work out BMI.
                </p>
              </div>
              <Button
                onClick={savePregnancySetup}
                disabled={savingSetup}
                className="w-full gap-2"
              >
                {savingSetup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Baby className="w-4 h-4" />
                    Yes, I'm pregnant — start my health check
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <HeartPulse className="w-7 h-7" />
          Pregnancy Health Check
        </h1>
        <p className="text-muted-foreground">
          Enter your latest antenatal details to check your anaemia, pregnancy
          risk and gestational diabetes analysis.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="check" className="gap-1">
            <ClipboardList className="w-4 h-4" />
            Health check
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-1">
            <Activity className="w-4 h-4" />
            My results
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <History className="w-4 h-4" />
            Past checks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="check" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your latest measurements</CardTitle>
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
              <CardTitle className="text-lg">Blood test results</CardTitle>
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
              <CardTitle className="text-lg">Diabetes risk factors</CardTitle>
              <CardDescription>
                Tick anything that applies to you. Some may already be filled in
                from your questionnaire.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DiabetesRiskFactorsSection form={form} update={update} />

              <div className="flex justify-end pt-6">
                <Button onClick={runCheck} disabled={isScreening} className="gap-2">
                  {isScreening ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Activity className="w-4 h-4" />
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
            <Card>
              <CardContent className="p-12 text-center">
                <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No results yet</h3>
                <p className="text-muted-foreground">
                  Fill in the health check to see your results.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="mb-4 border-primary/30 bg-primary/5">
                <CardContent className="p-4 text-sm">
                  These results are a guide, not a diagnosis. They are based only
                  on what you entered — a blood or urine test can change them.
                  Share them with your doctor, and seek care straight away if you
                  have bleeding, severe pain, a bad headache or blurred vision.
                </CardContent>
              </Card>
              <ScreeningResultsView result={result} audience="patient" />
            </>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Past Checks</CardTitle>
              <CardDescription>
                Checks you have completed, and screenings your doctor has run.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  You have not completed a health check yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        setResult(entry.result);
                        setForm(entry.inputs);
                        setActiveTab("results");
                      }}
                      className="w-full flex items-center justify-between gap-4 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
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
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HealthRisks;
