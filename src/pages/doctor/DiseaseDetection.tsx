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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Activity,
  Baby,
  ClipboardList,
  History,
  Loader2,
  Search,
  Stethoscope,
  UserCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  BasicsSection,
  HistorySection,
  LabsSection,
  ScalesSection,
  SymptomsSection,
} from "@/components/health/ScreeningFields";
import { ScreeningResultsView } from "@/components/health/ScreeningResults";
import { RISK_STYLES } from "@/lib/riskLevels";
import {
  AssessmentData,
  buildScreeningInputFromAssessment,
  fetchScreenings,
  isPregnantPatient,
  saveScreening,
  screenPatient,
} from "@/services/diseaseDetectionService";
import {
  ScreeningInput,
  ScreeningResult,
  StoredScreening,
} from "@/types/diseaseDetection";

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

const DiseaseDetection: React.FC = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [patients, setPatients] = useState<PregnantPatient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const [form, setForm] = useState<ScreeningInput | null>(null);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [history, setHistory] = useState<StoredScreening[]>([]);
  const [selfReport, setSelfReport] = useState<StoredScreening | null>(null);
  const [isScreening, setIsScreening] = useState(false);
  const [activeTab, setActiveTab] = useState("assessment");

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

  // --- Selecting a patient prefills the form and pulls her history ---------
  const selectPatient = useCallback(
    async (patient: PregnantPatient) => {
      setSelectedPatientId(patient.patientId);
      setResult(null);
      setSelfReport(null);
      setActiveTab("assessment");
      setSearchParams({ patientId: patient.patientId }, { replace: true });

      // Fall back to the onboarding questionnaire until we know whether the
      // patient has submitted a self-report.
      setForm(buildScreeningInputFromAssessment(patient.assessmentData));

      try {
        const stored = await fetchScreenings(patient.patientId);
        setHistory(stored);

        const latestSelfReport = stored.find((entry) => entry.submittedBy === "patient");
        if (latestSelfReport) {
          // The patient's own answers are the better starting point — the
          // doctor only has to add the labs on top.
          setSelfReport(latestSelfReport);
          setForm(latestSelfReport.inputs);
        }
        if (stored.length > 0) setResult(stored[0].result);
      } catch (error) {
        console.error("Error loading screening history:", error);
        setHistory([]);
      }
    },
    [setSearchParams]
  );

  // Deep link from the Patients page: /doctor/disease-detection?patientId=...
  useEffect(() => {
    const requested = searchParams.get("patientId");
    if (!requested || selectedPatientId || patients.length === 0) return;

    const match = patients.find((p) => p.patientId === requested);
    if (match) selectPatient(match);
  }, [patients, searchParams, selectedPatientId, selectPatient]);

  const update = <K extends keyof ScreeningInput>(key: K, value: ScreeningInput[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const runScreening = async () => {
    if (!form || !selectedPatient) return;

    setIsScreening(true);
    try {
      const screening = await screenPatient(form);
      setResult(screening);
      setActiveTab("results");

      const { data: authData } = await supabase.auth.getUser();
      let persisted = false;
      if (authData.user) {
        persisted = await saveScreening({
          patientId: selectedPatient.patientId,
          doctorId: authData.user.id,
          submittedBy: "doctor",
          inputs: form,
          result: screening,
        });
        if (persisted) setHistory(await fetchScreenings(selectedPatient.patientId));
      }

      toast({
        title: "Screening complete",
        description: persisted
          ? `Overall risk: ${RISK_STYLES[screening.overall_risk_level].label}. Saved to the patient record.`
          : `Overall risk: ${RISK_STYLES[screening.overall_risk_level].label}. Not saved — the disease_screenings table is missing.`,
      });
    } catch (error) {
      console.error("Screening failed:", error);
      toast({
        title: "Screening failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not reach the screening service.",
        variant: "destructive",
      });
    } finally {
      setIsScreening(false);
    }
  };

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

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Stethoscope className="w-7 h-7" />
            Disease Detection
          </h1>
          <p className="text-muted-foreground">
            Maternal risk screening across anaemia, gestational diabetes,
            preeclampsia, UTI, thyroid, miscarriage risk and perinatal mental
            health.
          </p>
        </div>
        <Badge variant="outline" className="gap-1 shrink-0">
          <Baby className="w-3 h-3" />
          {patients.length} pregnant patient{patients.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Patient picker */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Pregnant Patients</CardTitle>
            <CardDescription>
              Patients you have accepted whose questionnaire marks them pregnant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
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
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {filteredPatients.map((patient) => (
                  <button
                    key={patient.patientId}
                    type="button"
                    onClick={() => selectPatient(patient)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      patient.patientId === selectedPatientId
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
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

        {/* Screening workspace */}
        {!selectedPatient || !form ? (
          <Card>
            <CardContent className="p-12 text-center">
              <ClipboardList className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">Select a patient</h3>
              <p className="text-muted-foreground">
                Pick a pregnant patient to review her screening inputs and risk
                results.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{selectedPatient.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedPatient.email}
                </p>
              </div>
              <TabsList>
                <TabsTrigger value="assessment" className="gap-1">
                  <ClipboardList className="w-4 h-4" />
                  Assessment
                </TabsTrigger>
                <TabsTrigger value="results" className="gap-1">
                  <Activity className="w-4 h-4" />
                  Results
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-1">
                  <History className="w-4 h-4" />
                  History
                </TabsTrigger>
              </TabsList>
            </div>

            {/* --- Assessment form --- */}
            <TabsContent value="assessment" className="space-y-4">
              {selfReport && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4 flex items-start gap-3">
                    <UserCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium">
                        Prefilled from the patient's own submission
                      </p>
                      <p className="text-muted-foreground">
                        She reported her symptoms, history and wellbeing scales on{" "}
                        {new Date(selfReport.createdAt).toLocaleString()}. Add the
                        clinical measurements and labs below, then re-run.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Screening Inputs</CardTitle>
                  <CardDescription>
                    Laboratory values left blank are treated as "not performed",
                    not as normal.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion
                    type="multiple"
                    defaultValue={["basics", "labs"]}
                    className="w-full"
                  >
                    <AccordionItem value="basics">
                      <AccordionTrigger>Basic information</AccordionTrigger>
                      <AccordionContent className="pt-2">
                        <BasicsSection form={form} update={update} />
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="labs">
                      <AccordionTrigger>
                        Clinical measurements &amp; laboratory values
                      </AccordionTrigger>
                      <AccordionContent className="pt-2">
                        <LabsSection form={form} update={update} />
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="symptoms">
                      <AccordionTrigger>Symptoms &amp; signs</AccordionTrigger>
                      <AccordionContent className="pt-2">
                        <SymptomsSection form={form} update={update} />
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="history">
                      <AccordionTrigger>History &amp; risk factors</AccordionTrigger>
                      <AccordionContent className="pt-2">
                        <HistorySection form={form} update={update} />
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="mental">
                      <AccordionTrigger>Mental health scales</AccordionTrigger>
                      <AccordionContent className="pt-4">
                        <ScalesSection form={form} update={update} />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <div className="flex justify-end pt-6">
                    <Button onClick={runScreening} disabled={isScreening} className="gap-2">
                      {isScreening ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Running screening...
                        </>
                      ) : (
                        <>
                          <Activity className="w-4 h-4" />
                          Run screening
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* --- Results --- */}
            <TabsContent value="results">
              {!result ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <h3 className="text-xl font-semibold mb-2">No results yet</h3>
                    <p className="text-muted-foreground">
                      Run a screening from the Assessment tab to see risk scores.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <ScreeningResultsView result={result} audience="clinician" />
              )}
            </TabsContent>

            {/* --- History --- */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Previous Screenings</CardTitle>
                  <CardDescription>
                    The last 20 screening runs recorded for this patient, whether
                    she submitted them herself or you ran them.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      No stored screenings for this patient yet.
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
                                ? "Self-reported by patient"
                                : "Run by clinician"}
                              {" · Highest risk: "}
                              {entry.result.highest_risk_condition
                                ? entry.result.conditions.find(
                                    (c) =>
                                      c.condition ===
                                      entry.result.highest_risk_condition
                                  )?.label ?? entry.result.highest_risk_condition
                                : "—"}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              RISK_STYLES[entry.result.overall_risk_level].badge
                            }
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
        )}
      </div>
    </div>
  );
};

export default DiseaseDetection;
