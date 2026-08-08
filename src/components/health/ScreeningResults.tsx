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
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { RISK_STYLES } from "@/lib/riskLevels";
import { RiskLevel, ScreeningResult } from "@/types/diseaseDetection";

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

export const ScreeningResultsView: React.FC<{
  result: ScreeningResult;
  audience?: "patient" | "clinician";
}> = ({ result, audience = "clinician" }) => (
  <div className="space-y-4">
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
            <p className="text-sm text-muted-foreground">
              {OVERALL_GUIDANCE[audience][result.overall_risk_level]}
            </p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground text-right max-w-xs">
          <p>Screened {new Date(result.generated_at).toLocaleString()}</p>
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
                <CardTitle className="text-base">{condition.label}</CardTitle>
                {audience === "clinician" && (
                  <CardDescription className="text-xs">
                    Detector: {condition.detector}
                  </CardDescription>
                )}
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

            <div>
              <p className="text-sm font-medium mb-1">
                {audience === "patient" ? "What helps" : "Next steps"}
              </p>
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
  </div>
);
