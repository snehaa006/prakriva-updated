// Per-condition risk-score trend, as small multiples — one mini line chart
// per screened condition. Shared by the doctor's Patient Analysis page and
// the patient's own Past Checks history, so both read the same trend the
// same way.

import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { RISK_STYLES } from "@/lib/riskLevels";
import { CHART_NEUTRALS, CHART_RISK } from "@/lib/chartColors";
import { RiskLevel, StoredScreening } from "@/types/diseaseDetection";

const CHART = {
  grid: CHART_NEUTRALS.grid,
  axis: CHART_NEUTRALS.axis,
};

/** Risk hues for the trend lines, matching the badges in `RISK_STYLES`. */
const RISK_HEX: Record<RiskLevel, string> = CHART_RISK;

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

export interface RiskScoreTrendProps {
  /** Screenings for one patient, any order — sorted oldest→newest internally. */
  screenings: StoredScreening[];
  /** How the active date range reads in a sentence, e.g. "the last 30 days". */
  rangeLabel: string;
}

/**
 * How each screened condition's 0-100 risk score has moved, one small
 * multiple per condition. Renders nothing when fewer than two screenings are
 * given — a single point has no trend to show.
 */
export const RiskScoreTrend: React.FC<RiskScoreTrendProps> = ({
  screenings,
  rangeLabel,
}) => {
  const sorted = useMemo(
    () =>
      [...screenings].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [screenings]
  );

  const latest = sorted.length ? sorted[sorted.length - 1] : null;

  // Needs ≥2 points to trend; the series list itself comes from the latest
  // screening so a condition dropped from more recent panels doesn't linger.
  const riskSeries = useMemo(() => {
    if (!latest || sorted.length < 2) return [];
    return latest.result.conditions.map((c) => ({
      condition: c.condition,
      label: c.label,
      riskLevel: c.risk_level,
      currentScore: c.score,
      data: sorted.map((s) => ({
        label: dayLabel(s.createdAt),
        score: s.result.conditions.find((x) => x.condition === c.condition)?.score ?? null,
      })),
    }));
  }, [latest, sorted]);

  if (riskSeries.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Risk score trend
        </CardTitle>
        <CardDescription>
          How each condition's 0–100 risk score has moved over {rangeLabel}. Line
          colour is the latest risk level.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {riskSeries.map((s) => (
            <div key={s.condition} className="rounded-2xl border p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">{s.label}</h4>
                <Badge variant="outline" className={RISK_STYLES[s.riskLevel].badge}>
                  {s.currentScore}%
                </Badge>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={s.data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: CHART.axis }}
                    tickLine={false}
                    axisLine={{ stroke: CHART.grid }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: CHART.axis }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip {...tooltipProps} />
                  <Line
                    name="Risk score"
                    type="monotone"
                    dataKey="score"
                    stroke={RISK_HEX[s.riskLevel]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
