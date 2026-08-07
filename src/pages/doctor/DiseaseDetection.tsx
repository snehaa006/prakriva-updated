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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Activity,
  AlertTriangle,
  Baby,
  ClipboardList,
  History,
  Loader2,
  Search,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  AssessmentData,
  buildScreeningInputFromAssessment,
  fetchScreenings,
  isPregnantPatient,
  saveScreening,
  screenPatient,
} from "@/services/diseaseDetectionService";
import {
  RiskLevel,
  ScreeningInput,
  ScreeningResult,
  StoredScreening,
  SYMPTOM_LABELS,
  SymptomKey,
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

const RISK_STYLES: Record<RiskLevel, { badge: string; bar: string; label: string }> = {
  low: {
    badge: "bg-green-100 text-green-800 border-green-200",
    bar: "bg-green-500",
    label: "Low risk",
  },
  moderate: {
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    bar: "bg-amber-500",
    label: "Moderate risk",
  },
  high: {
    badge: "bg-red-100 text-red-800 border-red-200",
    bar: "bg-red-500",
    label: "High risk",
  },
};

const TRIMESTER_LABELS: Record<string, string> = {
  first: "1st trimester",
  second: "2nd trimester",
  third: "3rd trimester",
  unknown: "Trimester unknown",
};

/** Checkbox bound to a boolean field on the screening form. */
const BoolField: React.FC<{
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}> = ({ id, label, checked, onChange }) => (
  <div className="flex items-center space-x-2">
    <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
    <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
      {label}
    </Label>
  </div>
);

/** Numeric input that keeps "not measured" distinct from zero. */
const NumberField: React.FC<{
  id: string;
  label: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  step?: string;
  placeholder?: string;
}> = ({ id, label, value, onChange, step = "1", placeholder = "Not measured" }) => (
  <div className="space-y-1">
    <Label htmlFor={id} className="text-xs text-muted-foreground">
      {label}
    </Label>
    <Input
      id={id}
      type="number"
      step={step}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    />
  </div>
);

/** Slider bound to one of the mental-health scales. */
const ScaleField: React.FC<{
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  hint?: string;
}> = ({ label, value, max, onChange, hint }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <span className="text-sm font-medium">
        {value}/{max}
      </span>
    </div>
    <Slider
      value={[value]}
      min={0}
      max={max}
      step={1}
      onValueChange={([v]) => onChange(v)}
    />
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

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

  // --- Selecting a patient prefills the form and pulls their history -------
  const selectPatient = useCallback(
    async (patient: PregnantPatient) => {
      setSelectedPatientId(patient.patientId);
      setForm(buildScreeningInputFromAssessment(patient.assessmentData));
      setResult(null);
      setActiveTab("assessment");
      setSearchParams({ patientId: patient.patientId }, { replace: true });

      try {
        const stored = await fetchScreenings(patient.patientId);
        setHistory(stored);
        if (stored.length > 0) {
          // Show the last verdict straight away — the common case is a doctor
          // reopening results rather than running a fresh screening.
          setResult(stored[0].result);
        }
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

  const toggleSymptom = (symptom: SymptomKey, checked: boolean) =>
    setForm((current) => {
      if (!current) return current;
      const symptoms = checked
        ? [...current.symptoms, symptom]
        : current.symptoms.filter((s) => s !== symptom);
      return { ...current, symptoms };
    });

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
        persisted = await saveScreening(
          selectedPatient.patientId,
          authData.user.id,
          form,
          screening
        );
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Screening Inputs</CardTitle>
                  <CardDescription>
                    Prefilled from the patient's questionnaire. Laboratory values
                    left blank are treated as "not performed", not as normal.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion
                    type="multiple"
                    defaultValue={["basics", "symptoms"]}
                    className="w-full"
                  >
                    <AccordionItem value="basics">
                      <AccordionTrigger>Basic information</AccordionTrigger>
                      <AccordionContent className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                        <NumberField
                          id="age"
                          label="Age (years)"
                          value={form.age}
                          onChange={(v) => update("age", (v ?? 28) as number)}
                          placeholder="28"
                        />
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Trimester
                          </Label>
                          <Select
                            value={form.trimester}
                            onValueChange={(v) =>
                              update("trimester", v as ScreeningInput["trimester"])
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="first">First</SelectItem>
                              <SelectItem value="second">Second</SelectItem>
                              <SelectItem value="third">Third</SelectItem>
                              <SelectItem value="unknown">Unknown</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <NumberField
                          id="bmi"
                          label="BMI"
                          step="0.1"
                          value={form.bmi}
                          onChange={(v) => update("bmi", v)}
                        />
                        <NumberField
                          id="gravida"
                          label="Gravida (pregnancies)"
                          value={form.gravida}
                          onChange={(v) => update("gravida", (v ?? 0) as number)}
                          placeholder="1"
                        />
                        <NumberField
                          id="parity"
                          label="Parity (births)"
                          value={form.parity}
                          onChange={(v) => update("parity", (v ?? 0) as number)}
                          placeholder="0"
                        />
                        <div />
                        <NumberField
                          id="bp_systolic"
                          label="Systolic BP (mmHg)"
                          value={form.bp_systolic}
                          onChange={(v) => update("bp_systolic", v)}
                        />
                        <NumberField
                          id="bp_diastolic"
                          label="Diastolic BP (mmHg)"
                          value={form.bp_diastolic}
                          onChange={(v) => update("bp_diastolic", v)}
                        />
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="symptoms">
                      <AccordionTrigger>Symptoms &amp; signs</AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {(
                            Object.keys(SYMPTOM_LABELS) as SymptomKey[]
                          ).map((symptom) => (
                            <BoolField
                              key={symptom}
                              id={`symptom-${symptom}`}
                              label={SYMPTOM_LABELS[symptom]}
                              checked={form.symptoms.includes(symptom)}
                              onChange={(v) => toggleSymptom(symptom, v)}
                            />
                          ))}
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <BoolField
                            id="weight_gain"
                            label="Unexplained weight gain"
                            checked={form.weight_gain}
                            onChange={(v) => update("weight_gain", v)}
                          />
                          <BoolField
                            id="hair_loss"
                            label="Hair loss"
                            checked={form.hair_loss}
                            onChange={(v) => update("hair_loss", v)}
                          />
                          <BoolField
                            id="cold_intolerance"
                            label="Cold intolerance"
                            checked={form.cold_intolerance}
                            onChange={(v) => update("cold_intolerance", v)}
                          />
                          <BoolField
                            id="constipation"
                            label="Constipation"
                            checked={form.constipation}
                            onChange={(v) => update("constipation", v)}
                          />
                          <BoolField
                            id="menstrual_irregularity"
                            label="Menstrual irregularity (pre-pregnancy)"
                            checked={form.menstrual_irregularity}
                            onChange={(v) => update("menstrual_irregularity", v)}
                          />
                          <BoolField
                            id="excessive_thirst"
                            label="Excessive thirst"
                            checked={form.excessive_thirst}
                            onChange={(v) => update("excessive_thirst", v)}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="history">
                      <AccordionTrigger>History &amp; risk factors</AccordionTrigger>
                      <AccordionContent className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                        <BoolField
                          id="family_history"
                          label="Family history (any)"
                          checked={form.family_history}
                          onChange={(v) => update("family_history", v)}
                        />
                        <BoolField
                          id="pcos"
                          label="PCOS"
                          checked={form.pcos}
                          onChange={(v) => update("pcos", v)}
                        />
                        <BoolField
                          id="previous_miscarriage"
                          label="Previous miscarriage"
                          checked={form.previous_miscarriage}
                          onChange={(v) => update("previous_miscarriage", v)}
                        />
                        <BoolField
                          id="anaemia_history"
                          label="History of anaemia"
                          checked={form.anaemia_history}
                          onChange={(v) => update("anaemia_history", v)}
                        />
                        <BoolField
                          id="previous_uti"
                          label="Previous UTI"
                          checked={form.previous_uti}
                          onChange={(v) => update("previous_uti", v)}
                        />
                        <BoolField
                          id="previous_complications"
                          label="Previous pregnancy complications"
                          checked={form.previous_complications}
                          onChange={(v) => update("previous_complications", v)}
                        />
                        <BoolField
                          id="gestational_diabetes_previous"
                          label="Previous gestational diabetes"
                          checked={form.gestational_diabetes_previous}
                          onChange={(v) => update("gestational_diabetes_previous", v)}
                        />
                        <BoolField
                          id="large_baby_previous"
                          label="Previous large baby"
                          checked={form.large_baby_previous}
                          onChange={(v) => update("large_baby_previous", v)}
                        />
                        <BoolField
                          id="unexplained_prenatal_loss"
                          label="Unexplained prenatal loss"
                          checked={form.unexplained_prenatal_loss}
                          onChange={(v) => update("unexplained_prenatal_loss", v)}
                        />
                        <BoolField
                          id="sedentary_lifestyle"
                          label="Sedentary lifestyle"
                          checked={form.sedentary_lifestyle}
                          onChange={(v) => update("sedentary_lifestyle", v)}
                        />
                        <BoolField
                          id="smoking"
                          label="Smoking"
                          checked={form.smoking}
                          onChange={(v) => update("smoking", v)}
                        />
                        <BoolField
                          id="alcohol"
                          label="Alcohol use"
                          checked={form.alcohol}
                          onChange={(v) => update("alcohol", v)}
                        />
                        <BoolField
                          id="history_depression"
                          label="History of depression"
                          checked={form.history_depression}
                          onChange={(v) => update("history_depression", v)}
                        />
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="mental">
                      <AccordionTrigger>Mental health scales</AccordionTrigger>
                      <AccordionContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <ScaleField
                          label="Stress level"
                          value={form.stress_level}
                          max={3}
                          onChange={(v) => update("stress_level", v)}
                          hint="0 minimal · 3 severe"
                        />
                        <ScaleField
                          label="Sleep disturbance"
                          value={form.sleep_disturbance}
                          max={3}
                          onChange={(v) => update("sleep_disturbance", v)}
                          hint="0 none · 3 severe"
                        />
                        <ScaleField
                          label="Mood symptoms"
                          value={form.mood_symptoms}
                          max={7}
                          onChange={(v) => update("mood_symptoms", v)}
                        />
                        <ScaleField
                          label="Social support"
                          value={form.social_support}
                          max={5}
                          onChange={(v) => update("social_support", v)}
                          hint="0 low · 5 high"
                        />
                        <ScaleField
                          label="Edinburgh Postnatal Depression Scale"
                          value={form.edinburgh_score}
                          max={30}
                          onChange={(v) => update("edinburgh_score", v)}
                        />
                        <ScaleField
                          label="PHQ-9"
                          value={form.phq9_score}
                          max={27}
                          onChange={(v) => update("phq9_score", v)}
                        />
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="labs">
                      <AccordionTrigger>Laboratory values (optional)</AccordionTrigger>
                      <AccordionContent className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                        <NumberField
                          id="hemoglobin"
                          label="Haemoglobin (g/dL)"
                          step="0.1"
                          value={form.hemoglobin}
                          onChange={(v) => update("hemoglobin", v)}
                        />
                        <NumberField
                          id="hba1c"
                          label="HbA1c (%)"
                          step="0.1"
                          value={form.hba1c}
                          onChange={(v) => update("hba1c", v)}
                        />
                        <NumberField
                          id="ogtt_1hr"
                          label="OGTT 1-hour (mg/dL)"
                          step="1"
                          value={form.ogtt_1hr}
                          onChange={(v) => update("ogtt_1hr", v)}
                        />
                        <NumberField
                          id="tsh"
                          label="TSH (mIU/L)"
                          step="0.01"
                          value={form.tsh}
                          onChange={(v) => update("tsh", v)}
                        />
                        <NumberField
                          id="t3"
                          label="T3"
                          step="0.01"
                          value={form.t3}
                          onChange={(v) => update("t3", v)}
                        />
                        <NumberField
                          id="t4"
                          label="T4"
                          step="0.01"
                          value={form.t4}
                          onChange={(v) => update("t4", v)}
                        />
                        <NumberField
                          id="urine_wbc"
                          label="Urine WBC count"
                          value={form.urine_wbc}
                          onChange={(v) => update("urine_wbc", v)}
                        />
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Urine nitrite
                          </Label>
                          <Select
                            value={form.urine_nitrite}
                            onValueChange={(v) =>
                              update("urine_nitrite", v as ScreeningInput["urine_nitrite"])
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unknown">Not performed</SelectItem>
                              <SelectItem value="positive">Positive</SelectItem>
                              <SelectItem value="negative">Negative</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Proteinuria
                          </Label>
                          <Select
                            value={form.proteinuria}
                            onValueChange={(v) =>
                              update("proteinuria", v as ScreeningInput["proteinuria"])
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unknown">Not performed</SelectItem>
                              <SelectItem value="positive">Positive</SelectItem>
                              <SelectItem value="negative">Negative</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
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
            <TabsContent value="results" className="space-y-4">
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
                <>
                  <Card>
                    <CardContent className="p-6 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {result.overall_risk_level === "low" ? (
                          <ShieldCheck className="w-8 h-8 text-green-600" />
                        ) : (
                          <AlertTriangle
                            className={
                              result.overall_risk_level === "high"
                                ? "w-8 h-8 text-red-600"
                                : "w-8 h-8 text-amber-600"
                            }
                          />
                        )}
                        <div>
                          <p className="text-sm text-muted-foreground">Overall</p>
                          <p className="text-xl font-semibold">
                            {RISK_STYLES[result.overall_risk_level].label}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground text-right">
                        <p>
                          Screened{" "}
                          {new Date(result.generated_at).toLocaleString()}
                        </p>
                        <p>{result.disclaimer}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {result.conditions.map((condition) => (
                      <Card key={condition.condition}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-base">
                                {condition.label}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                Detector: {condition.detector}
                              </CardDescription>
                            </div>
                            <Badge
                              variant="outline"
                              className={RISK_STYLES[condition.risk_level].badge}
                            >
                              {RISK_STYLES[condition.risk_level].label}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Risk score</span>
                              <span className="font-semibold">{condition.score}%</span>
                            </div>
                            <Progress
                              value={condition.score}
                              indicatorClassName={RISK_STYLES[condition.risk_level].bar}
                            />
                          </div>

                          {typeof condition.details?.thyroid_type === "string" && (
                            <p className="text-sm">
                              <span className="text-muted-foreground">Pattern: </span>
                              {condition.details.thyroid_type as string}
                            </p>
                          )}

                          <div>
                            <p className="text-sm font-medium mb-1">
                              Contributing factors
                            </p>
                            {condition.reasons.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No risk factors detected from the entered data.
                              </p>
                            ) : (
                              <ul className="text-sm space-y-1">
                                {condition.reasons.map((reason, index) => (
                                  <li key={index} className="flex gap-2">
                                    <span className="text-muted-foreground">•</span>
                                    <span>{reason}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div>
                            <p className="text-sm font-medium mb-1">Next steps</p>
                            <ul className="text-sm space-y-1">
                              {condition.recommendations.map((rec, index) => (
                                <li key={index} className="flex gap-2">
                                  <span className="text-muted-foreground">→</span>
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* --- History --- */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Previous Screenings</CardTitle>
                  <CardDescription>
                    The last 20 screening runs recorded for this patient.
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
                              Highest risk:{" "}
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
