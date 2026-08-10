// Upload or photograph a lab report and let Gemini fill in the screening form.
//
// The extracted values are shown for confirmation rather than written straight
// into the form. OCR's characteristic failure is a lost decimal point — a
// haemoglobin of 11.9 read as 119 — and a wrong number reaching a risk model
// silently is worse than typing it by hand. The patient sees exactly what was
// read, and nothing is applied until she says so.

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Camera, Check, FileUp, Loader2, X } from "lucide-react";
import {
  AnalysisUnavailableError,
  extractReport,
  type ExtractedValues,
} from "@/services/analysisService";
import type { ScreeningInput } from "@/types/diseaseDetection";

/** Field label and unit, for the confirmation list. */
const FIELD_LABELS: Record<keyof ExtractedValues, { label: string; unit?: string }> = {
  hemoglobin: { label: "Haemoglobin", unit: "g/dL" },
  hba1c: { label: "HbA1c", unit: "%" },
  hdl: { label: "HDL cholesterol", unit: "mg/dL" },
  triglycerides: { label: "Triglycerides", unit: "mg/dL" },
  tsh: { label: "TSH", unit: "mIU/L" },
  t3: { label: "T3" },
  tt4: { label: "Total T4", unit: "µg/dL" },
  t4u: { label: "T4 uptake" },
  fti: { label: "Free thyroxine index" },
  fetal_weight_kg: { label: "Baby's estimated weight", unit: "kg" },
  amniotic_fluid_cm: { label: "Amniotic fluid index", unit: "cm" },
  bp_systolic: { label: "Systolic BP", unit: "mmHg" },
  bp_diastolic: { label: "Diastolic BP", unit: "mmHg" },
};

interface ReportUploadCardProps {
  /** Applies one confirmed value to the screening form. */
  onApply: <K extends keyof ScreeningInput>(key: K, value: ScreeningInput[K]) => void;
}

export const ReportUploadCard: React.FC<ReportUploadCardProps> = ({ onApply }) => {
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [isReading, setIsReading] = useState(false);
  const [found, setFound] = useState<ExtractedValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setIsReading(true);
    setError(null);
    setFound(null);
    setApplied(false);
    try {
      setFound(await extractReport(file));
    } catch (err) {
      setError(
        err instanceof AnalysisUnavailableError
          ? "Reading reports is not available right now — please type the values in below."
          : err instanceof Error
            ? err.message
            : "Could not read that report."
      );
    } finally {
      setIsReading(false);
    }
  };

  const applyAll = () => {
    if (!found) return;
    for (const [key, value] of Object.entries(found)) {
      if (typeof value === "number") {
        onApply(key as keyof ScreeningInput, value as never);
      }
    }
    setApplied(true);
  };

  const entries = Object.entries(found ?? {}).filter(
    ([, value]) => typeof value === "number"
  ) as [keyof ExtractedValues, number][];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileUp className="w-5 h-5" />
          Fill from your report
        </CardTitle>
        <CardDescription>
          Upload or photograph your latest lab report and we will read the values
          into the form. You can check and change anything before it is used.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={uploadRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {/* `capture` asks a phone for the camera directly; desktops ignore it
            and fall back to the file picker. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="gap-2"
            disabled={isReading}
            onClick={() => uploadRef.current?.click()}
          >
            {isReading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileUp className="w-4 h-4" />
            )}
            {isReading ? "Reading..." : "Upload a report"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={isReading}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="w-4 h-4" />
            Take a photo
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {found && entries.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">
            Nothing recognisable was found in that image. Try a clearer, straight-on
            photo of the results page — or just type the values in below.
          </p>
        )}

        {entries.length > 0 && (
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">
              Found {entries.length} value{entries.length === 1 ? "" : "s"} — check
              these match your report:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {entries.map(([key, value]) => (
                <li key={key} className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {FIELD_LABELS[key].label}
                  </span>
                  <span className="font-medium">
                    {value}
                    {FIELD_LABELS[key].unit ? ` ${FIELD_LABELS[key].unit}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button size="sm" className="gap-2" onClick={applyAll} disabled={applied}>
                <Check className="w-4 h-4" />
                {applied ? "Filled in below" : "Use these values"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-2"
                onClick={() => {
                  setFound(null);
                  setApplied(false);
                }}
              >
                <X className="w-4 h-4" />
                Discard
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anything read incorrectly can be corrected in the fields below before
              you run the check.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
