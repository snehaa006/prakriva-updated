// Rendering for a completed screening run, shared by the doctor's screening
// page and the patient's own results view.

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  Baby,
  Brain,
  HeartCrack,
  HeartPulse,
  Lightbulb,
  Scale,
  ShieldCheck,
  Syringe,
  Thermometer,
  Droplet,
} from "lucide-react";
import { RISK_STYLES } from "@/lib/riskLevels";
import { ConditionKey, RiskLevel, ScreeningResult } from "@/types/diseaseDetection";

/** What the overall banner should tell this audience to do next. */
const OVERALL_GUIDANCE: Record<"patient" | "clinician", Record<RiskLevel, string>> = {
  patient: {
    low: "Nothing here needs urgent attention. Keep up your routine antenatal visits.",
    moderate: "Please share this with your doctor at your next appointment.",
    high: "Please contact your doctor soon — do not wait for your next scheduled visit.",
  },
  clinician: {
    low: "No condition crossed the moderate threshold on the entered data.",
    moderate: "At least one condition warrants follow-up testing.",
    high: "At least one condition needs prompt clinical attention.",
  },
};

/** So the most urgent finding always sorts first, ties keeping their order. */
const RISK_ORDER: Record<RiskLevel, number> = { high: 0, moderate: 1, low: 2 };

/** A small icon per condition, purely for scannability — the label is what identifies it. */
const CONDITION_ICONS: Record<ConditionKey, typeof Droplet> = {
  anaemia: Droplet,
  pregnancy_risk: Baby,
  gdm: Syringe,
  preeclampsia: HeartPulse,
  uti: Thermometer,
  thyroid: Scale,
  miscarriage: HeartCrack,
  mental_health: Brain,
};

/**
 * Severity treatment for a card: a left accent border, a faint background
 * wash (a tint, never a saturated block), and a slightly stronger circle
 * behind the overall banner's icon. Kept in step with `RISK_STYLES`.
 */
const RISK_CARD_STYLES: Record<RiskLevel, { border: string; wash: string; iconBg: string }> = {
  low: { border: "border-l-rose-300", wash: "bg-rose-50/60", iconBg: "bg-rose-100" },
  moderate: { border: "border-l-coral-500", wash: "bg-coral-50/70", iconBg: "bg-coral-100" },
  high: { border: "border-l-red-600", wash: "bg-red-50/70", iconBg: "bg-red-100" },
};

export const ScreeningResultsView: React.FC<{
  result: ScreeningResult;
  audience?: "patient" | "clinician";
}> = ({ result, audience = "clinician" }) => {
  const overallStyle = RISK_CARD_STYLES[result.overall_risk_level];
  // Most urgent finding first — the reader's attention should go there before
  // anything else, not wherever the backend happened to list it.
  const sortedConditions = [...result.conditions].sort(
    (a, b) => RISK_ORDER[a.risk_level] - RISK_ORDER[b.risk_level]
  );

  return (
    <div className="space-y-4">
      <Card className={`border-l-4 ${overallStyle.border} ${overallStyle.wash}`}>
        <CardContent className="p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${overallStyle.iconBg}`}
            >
              {result.overall_risk_level === "low" ? (
                <ShieldCheck className="w-7 h-7 text-rose-600" />
              ) : (
                <AlertTriangle
                  className={
                    result.overall_risk_level === "high"
                      ? "w-7 h-7 text-red-600"
                      : "w-7 h-7 text-coral-600"
                  }
                />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Overall</p>
              <p className="text-2xl font-bold leading-tight">
                {RISK_STYLES[result.overall_risk_level].label}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {OVERALL_GUIDANCE[audience][result.overall_risk_level]}
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground text-right max-w-xs">
            <p>Screened {new Date(result.generated_at).toLocaleString()}</p>
            <p className="text-xs mt-1 opacity-80">{result.disclaimer}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {sortedConditions.map((condition) => {
          const style = RISK_CARD_STYLES[condition.risk_level];
          const Icon = CONDITION_ICONS[condition.condition] ?? HeartPulse;

          return (
            <Card key={condition.condition} className={`border-l-4 ${style.border} ${style.wash}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70" />
                    <div>
                      <CardTitle className="text-base">{condition.label}</CardTitle>
                      {audience === "clinician" && (
                        <CardDescription className="text-xs">
                          Detector: {condition.detector}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={RISK_STYLES[condition.risk_level].badge}>
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
                    {audience === "patient" ? "Why" : "Contributing factors"}
                  </p>
                  {condition.reasons.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nothing in the answers given points to this condition.
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

                {/* Actionable guidance gets its own tinted block so it stands
                    apart from the "why" list above it — this is the part a
                    reader should walk away remembering. */}
                <div className="rounded-2xl border border-plum-100 bg-plum-50/60 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Lightbulb className="h-4 w-4 text-plum-600 shrink-0" />
                    <p className="text-sm font-medium text-plum-900">
                      {audience === "patient" ? "What helps" : "Next steps"}
                    </p>
                  </div>
                  <ul className="text-sm space-y-1 text-plum-900/80">
                    {condition.recommendations.map((rec, index) => (
                      <li key={index} className="flex gap-2">
                        <span aria-hidden>→</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
