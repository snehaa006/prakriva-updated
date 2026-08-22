import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, Watch } from "lucide-react";
import { ScreeningResultsView } from "@/components/health/ScreeningResults";
import { computeBmi } from "@/components/health/ScreeningFields";
import {
  buildScreeningInputFromAssessment,
  heightCmFromAssessment,
  screenPatient,
  type AssessmentData,
} from "@/services/diseaseDetectionService";
import type { ScreeningInput, ScreeningResult } from "@/types/diseaseDetection";
import type { ScreeningSignals } from "@/lib/healthSamples";

interface Props {
  signals: ScreeningSignals;
  assessment: AssessmentData;
}

/**
 * The same screening models, run on measured data instead of a filled-in form.
 *
 * This is not a second risk engine. It calls `screenPatient` — the identical
 * backend model the Health check tab uses — with a `ScreeningInput` whose
 * measurable fields come from the Watch: BMI from synced weight and height, and
 * the sedentary flag from her actual step counts.
 *
 * What a watch cannot measure stays absent rather than guessed. Blood pressure
 * and haemoglobin drive the preeclampsia and anaemia models heavily, and no
 * consumer watch records either, so those conditions score on history alone
 * here. The card says so plainly: a risk level built from half the inputs
 * should never be mistaken for the full check.
 */
export const WatchRiskCard = ({ signals, assessment }: Props) => {
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputs = useMemo<ScreeningInput | null>(() => {
    if (signals.daysOfData === 0) return null;

    const base = buildScreeningInputFromAssessment(assessment);
    // Onboarding height is the deliberate one; a synced value only fills a gap.
    const heightCm = heightCmFromAssessment(assessment) ?? signals.heightCm;
    const bmi = computeBmi(heightCm, signals.weightKg) ?? base.bmi ?? null;

    return {
      ...base,
      bmi,
      ...(signals.sedentary !== null ? { sedentary_lifestyle: signals.sedentary } : {}),
    };
  }, [signals, assessment]);

  useEffect(() => {
    if (!inputs) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    screenPatient(inputs)
      .then((next) => {
        if (!cancelled) setResult(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not run the screening on your Apple Watch data."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [inputs]);

  if (!inputs) return null;

  /** Named so she can see exactly which numbers the risk levels rest on. */
  const measured = [
    inputs.bmi !== null && inputs.bmi !== undefined ? `BMI ${inputs.bmi}` : null,
    signals.weightKg !== null ? `weight ${signals.weightKg.toFixed(1)} kg` : null,
    signals.sedentary !== null
      ? `activity ${signals.sedentary ? "sedentary" : "active"}`
      : null,
    signals.restingHeartRate !== null
      ? `resting heart rate ${Math.round(signals.restingHeartRate)} bpm`
      : null,
  ].filter(Boolean) as string[];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-title3">Risk prediction from your Apple Watch</CardTitle>
            <CardDescription>
              The same anaemia, gestational diabetes, thyroid and preeclampsia
              models as your health check — run automatically on what your Watch
              measured, with nothing for you to fill in.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0 gap-1">
            <Watch className="h-3 w-3" />
            Automatic
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {measured.length > 0 && (
          <p className="text-caption1 text-foreground-secondary">
            Using {measured.join(", ")} from the last 90 days.
          </p>
        )}

        {loading && (
          <div className="flex items-center gap-2 py-6 text-foreground-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-subhead">Running your screening…</span>
          </div>
        )}

        {!loading && error && (
          <p className="text-caption1 text-destructive">{error}</p>
        )}

        {!loading && result && <ScreeningResultsView result={result} audience="patient" />}

        {/* The honest limit of this card. A watch measures movement and pulse;
            it does not measure the bloodwork these models lean on hardest. */}
        <div className="flex items-start gap-2 rounded-md bg-background-elevated p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-foreground-tertiary" />
          <p className="text-caption2 text-foreground-secondary">
            This runs on what a watch can measure. Blood pressure and blood
            results are not among them, and they matter most to the preeclampsia
            and anaemia scores — so treat this as an early read, and fill in the{" "}
            <strong className="font-medium">Health check</strong> tab for the
            complete picture.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default WatchRiskCard;
