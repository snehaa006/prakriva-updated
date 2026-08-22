import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Watch } from "lucide-react";
import type { ScreeningSignals } from "@/lib/healthSamples";

interface Props {
  signals: ScreeningSignals;
  /** BMI as the form currently computes it, so she sees the figure the model will score. */
  bmi: number | null;
}

/**
 * What the screening is taking from her Apple Watch rather than asking for.
 *
 * Shown above the manual measurements so the substitution is visible: every
 * value here has already been written into a field she can still change, and
 * saying so is the difference between "prefilled from your data" and a number
 * appearing in her form for no stated reason.
 *
 * Blood pressure and haemoglobin are absent because no watch measures them —
 * those stay hers to enter.
 */
export const WatchSignalsCard = ({ signals, bmi }: Props) => {
  if (signals.daysOfData === 0) return null;

  const rows: { label: string; value: string; note?: string }[] = [];

  if (signals.weightKg !== null) {
    rows.push({
      label: "Weight",
      value: `${signals.weightKg.toFixed(1)} kg`,
      note: bmi !== null ? `BMI ${bmi}` : undefined,
    });
  }

  if (signals.sedentary !== null && signals.avgDailySteps !== null) {
    rows.push({
      label: "Activity level",
      value: signals.sedentary ? "Sedentary" : "Active",
      note: `${Math.round(signals.avgDailySteps).toLocaleString()} steps a day`,
    });
  }

  if (signals.weeklyExerciseMinutes !== null) {
    rows.push({
      label: "Exercise",
      value: `${Math.round(signals.weeklyExerciseMinutes)} min a week`,
    });
  }

  if (signals.restingHeartRate !== null) {
    rows.push({
      label: "Resting heart rate",
      value: `${Math.round(signals.restingHeartRate)} bpm`,
    });
  }

  if (signals.avgSleepHours !== null) {
    rows.push({
      label: "Sleep",
      value: `${signals.avgSleepHours.toFixed(1)} hr a night`,
    });
  }

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-title3">From your Apple Watch</CardTitle>
            <CardDescription>
              Filled in from what your Watch recorded over the last 90 days, so you
              do not have to estimate it. Every value below is editable — change
              anything that looks wrong before running your check.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0 gap-1">
            <Watch className="h-3 w-3" />
            Synced
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-caption1 text-foreground-secondary">{row.label}</dt>
              <dd className="text-right">
                <span className="text-subhead font-medium text-foreground">{row.value}</span>
                {row.note && (
                  <span className="ml-1.5 text-caption2 text-foreground-tertiary">{row.note}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="pt-1 text-caption2 text-foreground-tertiary">
          Based on {signals.daysOfData} days with recorded data. Blood pressure and
          blood results are not measured by a watch, so those remain yours to enter
          below.
        </p>
      </CardContent>
    </Card>
  );
};

export default WatchSignalsCard;
