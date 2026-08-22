import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity, Info, Loader2, Smartphone, Watch } from "lucide-react";
import { CHART_NEUTRALS, seriesColor } from "@/lib/chartColors";
import {
  buildInsights,
  buildSeries,
  formatValue,
  groupSeries,
  GROUP_ORDER,
  HISTORY_WINDOWS,
  type Insight,
  type MetricSeries,
  windowById,
  windowStart,
} from "@/lib/healthSamples";
import { fetchHealthSamples } from "@/services/healthSampleService";

/** One colour per group, so a metric keeps its hue across every chart. */
const groupColor = (group: string): string =>
  seriesColor(Math.max(0, GROUP_ORDER.indexOf(group as never)));

const TONE_STYLES: Record<Insight["tone"], string> = {
  positive: "border-l-4 border-l-primary",
  attention: "border-l-4 border-l-destructive",
  neutral: "border-l-4 border-l-border",
};

const shortDay = (day: string): string => {
  const parsed = new Date(`${day}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? day
    : parsed.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

interface Props {
  patientId: string | null;
}

/**
 * Apple Watch and iPhone data, read back from Supabase.
 *
 * Charts are drawn from what actually reached the database rather than from a
 * live device query, so they double as a check on the sync: if a chart looks
 * right, the whole watch → phone → Supabase round trip worked.
 */
export const AppleHealthPanel = ({ patientId }: Props) => {
  const [windowId, setWindowId] = useState("6m");
  const [series, setSeries] = useState<MetricSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const window = windowById(windowId);
        const data = await fetchHealthSamples(patientId, windowStart(window));
        if (cancelled) return;
        setUnavailable(data.unavailable);
        setSeries(buildSeries(data.buckets, data.sources));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load your Apple Health data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [patientId, windowId]);

  const grouped = useMemo(() => groupSeries(series), [series]);
  const insights = useMemo(() => buildInsights(series), [series]);

  const windowLabel = windowById(windowId).label.toLowerCase();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-title3 text-foreground">Apple Watch &amp; iPhone</h2>
          <p className="mt-1 text-caption1 text-foreground-secondary">
            Synced automatically from the Health Sync app on your iPhone.
          </p>
        </div>
        <Select value={windowId} onValueChange={setWindowId}>
          <SelectTrigger className="w-[170px]" aria-label="Time range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HISTORY_WINDOWS.map((window) => (
              <SelectItem key={window.id} value={window.id}>
                {window.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      )}

      {!loading && unavailable && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-body text-foreground-secondary">
              Apple Health syncing is not set up on this project yet.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-body text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !unavailable && !error && series.length === 0 && (
        <Card>
          <CardContent className="space-y-2 py-12 text-center">
            <Activity className="mx-auto h-8 w-8 text-foreground-tertiary" />
            <p className="text-body text-foreground-secondary">
              Nothing recorded in the {windowLabel}.
            </p>
            <p className="text-caption1 text-foreground-tertiary">
              Open Health Sync on your iPhone and tap Sync Now, or try a longer range.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && series.length > 0 && (
        <>
          {insights.length > 0 && <InsightList insights={insights} />}

          {grouped.map((group) => (
            <section key={group.group} className="space-y-3">
              <h3 className="text-subhead font-medium text-foreground-secondary">{group.label}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {group.series.map((metric) => (
                  <MetricCard key={metric.type} metric={metric} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
};

const InsightList = ({ insights }: { insights: Insight[] }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-title3">What your data shows</CardTitle>
      <CardDescription>
        Patterns drawn from your own readings over this period.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {insights.map((insight) => (
        <div key={insight.id} className={`rounded-md bg-background-elevated p-3 ${TONE_STYLES[insight.tone]}`}>
          <p className="text-subhead font-medium text-foreground">{insight.title}</p>
          <p className="mt-1 text-caption1 text-foreground-secondary">{insight.body}</p>
        </div>
      ))}
      <p className="flex items-start gap-2 pt-1 text-caption2 text-foreground-tertiary">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          These are observations from consumer-device readings, not a medical
          assessment. Apple Watch measurements are not clinical-grade — discuss
          anything that concerns you with your doctor.
        </span>
      </p>
    </CardContent>
  </Card>
);

const MetricCard = ({ metric }: { metric: MetricSeries }) => {
  const color = groupColor(metric.meta.group);
  const isBar = metric.meta.kind === "dailyTotal";

  // A day per bar stops reading as anything past a few hundred; sampling keeps
  // the shape of a five-year window without handing Recharts 1,800 marks.
  const points = useMemo(() => {
    const max = 180;
    if (metric.points.length <= max) return metric.points;
    const step = Math.ceil(metric.points.length / max);
    return metric.points.filter((_, index) => index % step === 0);
  }, [metric.points]);

  const watchWorn = metric.sources.some((s) => /watch/i.test(s));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-subhead">{metric.meta.label}</CardTitle>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-title2 text-foreground">
                {formatValue(metric.headline, metric.meta)}
              </span>
              <span className="text-caption1 text-foreground-secondary">{metric.meta.unit}</span>
              <span className="text-caption2 text-foreground-tertiary">{metric.headlineCaption}</span>
            </div>
          </div>
          {metric.sources.length > 0 && (
            <Badge variant="secondary" className="shrink-0 gap-1">
              {watchWorn ? <Watch className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
              {watchWorn ? "Watch" : "iPhone"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            {isBar ? (
              <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_NEUTRALS.grid} vertical={false} />
                <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 10, fill: CHART_NEUTRALS.tick }} stroke={CHART_NEUTRALS.axis} minTickGap={24} />
                <YAxis tick={{ fontSize: 10, fill: CHART_NEUTRALS.tick }} stroke={CHART_NEUTRALS.axis} width={44} />
                <Tooltip
                  contentStyle={{ background: CHART_NEUTRALS.tooltipBg, border: `1px solid ${CHART_NEUTRALS.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                  labelFormatter={shortDay}
                  formatter={(value: number) => [`${formatValue(value, metric.meta)} ${metric.meta.unit}`, metric.meta.label]}
                />
                <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_NEUTRALS.grid} vertical={false} />
                <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 10, fill: CHART_NEUTRALS.tick }} stroke={CHART_NEUTRALS.axis} minTickGap={24} />
                {/* Rates never start at zero — anchoring a heart-rate axis to 0
                    squashes the whole range into the top of the plot. */}
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: CHART_NEUTRALS.tick }} stroke={CHART_NEUTRALS.axis} width={44} />
                <Tooltip
                  contentStyle={{ background: CHART_NEUTRALS.tooltipBg, border: `1px solid ${CHART_NEUTRALS.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                  labelFormatter={shortDay}
                  formatter={(value: number) => [`${formatValue(value, metric.meta)} ${metric.meta.unit}`, metric.meta.label]}
                />
                <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-caption2 text-foreground-tertiary">
          {metric.daysWithData} days · {metric.sampleCount.toLocaleString()} samples
          {metric.meta.kind === "reading" && metric.average !== null
            ? ` · avg ${formatValue(metric.average, metric.meta)} ${metric.meta.unit}`
            : ""}
        </p>
      </CardContent>
    </Card>
  );
};

export default AppleHealthPanel;
