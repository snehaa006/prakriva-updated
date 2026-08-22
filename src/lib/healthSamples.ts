// Apple Health / Apple Watch samples, as the patient dashboard sees them.
//
// The iOS companion app (health-kit-app) writes `public.health_samples`; this is
// the read side. Pure data shaping only — no Supabase, no React — so the
// aggregation and the analysis can be tested without either.
//
// Metric keys are the `type` column, which is the raw value of the Swift
// `HealthMetric` enum. They are effectively schema: renaming one orphans every
// row already synced under the old name.

export type MetricGroup =
  | "heart"
  | "respiratory"
  | "activity"
  | "sleep"
  | "body"
  | "mobility"
  | "hearing";

export const GROUP_LABELS: Record<MetricGroup, string> = {
  heart: "Heart",
  respiratory: "Respiratory",
  activity: "Activity",
  sleep: "Sleep & Mind",
  body: "Body",
  mobility: "Mobility",
  hearing: "Hearing",
};

/** Group render order — the ones a patient looks at first come first. */
export const GROUP_ORDER: MetricGroup[] = [
  "activity",
  "heart",
  "sleep",
  "respiratory",
  "body",
  "mobility",
  "hearing",
];

export interface MetricMeta {
  label: string;
  group: MetricGroup;
  /** Unit shown to the patient, which is not always the unit stored. */
  unit: string;
  /**
   * `dailyTotal` sums a day into one bar: counts, distances and durations are
   * meaningless as individual samples. `reading` keeps the daily average of a
   * rate or measurement, which summing would destroy — a day of heart rate does
   * not add up to anything a person would recognise.
   */
  kind: "dailyTotal" | "reading";
  /** Stored value is divided by this before display. */
  scale?: number;
  decimals: number;
}

export const METRICS: Record<string, MetricMeta> = {
  // Activity
  stepCount:            { label: "Steps", group: "activity", unit: "steps", kind: "dailyTotal", decimals: 0 },
  distanceWalkingRunning: { label: "Walking + Running", group: "activity", unit: "km", kind: "dailyTotal", scale: 1000, decimals: 2 },
  distanceCycling:      { label: "Cycling", group: "activity", unit: "km", kind: "dailyTotal", scale: 1000, decimals: 2 },
  flightsClimbed:       { label: "Flights Climbed", group: "activity", unit: "flights", kind: "dailyTotal", decimals: 0 },
  activeEnergyBurned:   { label: "Active Energy", group: "activity", unit: "kcal", kind: "dailyTotal", decimals: 0 },
  basalEnergyBurned:    { label: "Resting Energy", group: "activity", unit: "kcal", kind: "dailyTotal", decimals: 0 },
  appleExerciseTime:    { label: "Exercise Time", group: "activity", unit: "min", kind: "dailyTotal", decimals: 0 },
  appleStandTime:       { label: "Stand Time", group: "activity", unit: "min", kind: "dailyTotal", decimals: 0 },
  appleStandHour:       { label: "Stand Hours", group: "activity", unit: "hours", kind: "dailyTotal", decimals: 0 },
  physicalEffort:       { label: "Physical Effort", group: "activity", unit: "MET", kind: "reading", decimals: 1 },
  timeInDaylight:       { label: "Time in Daylight", group: "activity", unit: "min", kind: "dailyTotal", decimals: 0 },
  workout:              { label: "Workouts", group: "activity", unit: "min", kind: "dailyTotal", scale: 60, decimals: 0 },

  // Heart
  heartRate:                  { label: "Heart Rate", group: "heart", unit: "bpm", kind: "reading", decimals: 0 },
  restingHeartRate:           { label: "Resting Heart Rate", group: "heart", unit: "bpm", kind: "reading", decimals: 0 },
  walkingHeartRateAverage:    { label: "Walking Heart Rate", group: "heart", unit: "bpm", kind: "reading", decimals: 0 },
  heartRateVariabilitySDNN:   { label: "Heart Rate Variability", group: "heart", unit: "ms", kind: "reading", decimals: 1 },
  heartRateRecoveryOneMinute: { label: "Heart Rate Recovery", group: "heart", unit: "bpm", kind: "reading", decimals: 0 },
  vo2Max:                     { label: "Cardio Fitness", group: "heart", unit: "ml/kg·min", kind: "reading", decimals: 1 },
  highHeartRateEvent:         { label: "High Heart Rate Events", group: "heart", unit: "events", kind: "dailyTotal", decimals: 0 },
  lowHeartRateEvent:          { label: "Low Heart Rate Events", group: "heart", unit: "events", kind: "dailyTotal", decimals: 0 },
  irregularHeartRhythmEvent:  { label: "Irregular Rhythm Events", group: "heart", unit: "events", kind: "dailyTotal", decimals: 0 },

  // Sleep & mind
  sleepAnalysis:  { label: "Sleep", group: "sleep", unit: "hr", kind: "dailyTotal", scale: 3600, decimals: 1 },
  mindfulSession: { label: "Mindful Minutes", group: "sleep", unit: "min", kind: "dailyTotal", scale: 60, decimals: 0 },

  // Respiratory
  respiratoryRate:  { label: "Respiratory Rate", group: "respiratory", unit: "breaths/min", kind: "reading", decimals: 1 },
  oxygenSaturation: { label: "Blood Oxygen", group: "respiratory", unit: "%", kind: "reading", decimals: 1 },

  // Body
  bodyMass:          { label: "Weight", group: "body", unit: "kg", kind: "reading", decimals: 1 },
  height:            { label: "Height", group: "body", unit: "m", kind: "reading", decimals: 2 },
  bodyMassIndex:     { label: "Body Mass Index", group: "body", unit: "", kind: "reading", decimals: 1 },
  bodyFatPercentage: { label: "Body Fat", group: "body", unit: "%", kind: "reading", decimals: 1 },
  leanBodyMass:      { label: "Lean Body Mass", group: "body", unit: "kg", kind: "reading", decimals: 1 },

  // Mobility
  walkingSpeed:                   { label: "Walking Speed", group: "mobility", unit: "m/s", kind: "reading", decimals: 2 },
  walkingStepLength:              { label: "Step Length", group: "mobility", unit: "m", kind: "reading", decimals: 2 },
  walkingAsymmetryPercentage:     { label: "Walking Asymmetry", group: "mobility", unit: "%", kind: "reading", decimals: 1 },
  walkingDoubleSupportPercentage: { label: "Double Support", group: "mobility", unit: "%", kind: "reading", decimals: 1 },
  stairAscentSpeed:               { label: "Stair Ascent Speed", group: "mobility", unit: "m/s", kind: "reading", decimals: 2 },
  stairDescentSpeed:              { label: "Stair Descent Speed", group: "mobility", unit: "m/s", kind: "reading", decimals: 2 },

  // Hearing
  environmentalAudioExposure: { label: "Environmental Sound", group: "hearing", unit: "dB", kind: "reading", decimals: 0 },
  headphoneAudioExposure:     { label: "Headphone Audio", group: "hearing", unit: "dB", kind: "reading", decimals: 0 },
};

export const metricMeta = (type: string): MetricMeta =>
  METRICS[type] ?? { label: type, group: "activity", unit: "", kind: "reading", decimals: 1 };

// ---------------------------------------------------------------------------
// History windows

export interface HistoryWindow {
  id: string;
  label: string;
  /** `null` means every sample ever synced. */
  days: number | null;
}

export const HISTORY_WINDOWS: HistoryWindow[] = [
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "3m", label: "Last 3 months", days: 90 },
  { id: "6m", label: "Last 6 months", days: 180 },
  { id: "1y", label: "Last year", days: 365 },
  { id: "5y", label: "Last 5 years", days: 365 * 5 },
  { id: "all", label: "All time", days: null },
];

export const windowById = (id: string): HistoryWindow =>
  HISTORY_WINDOWS.find((w) => w.id === id) ?? HISTORY_WINDOWS[0];

/** ISO instant the window starts at, or null for "everything". */
export const windowStart = (window: HistoryWindow, now = new Date()): string | null => {
  if (window.days === null) return null;
  const start = new Date(now);
  start.setDate(start.getDate() - window.days);
  return start.toISOString();
};

// ---------------------------------------------------------------------------
// Series

/** One row of the `health_samples_daily` rollup. */
export interface DailyBucket {
  day: string;
  type: string;
  unit: string | null;
  total: number | null;
  avg_value: number | null;
  min_value: number | null;
  max_value: number | null;
  sample_count: number;
}

export interface SeriesPoint {
  day: string;
  value: number;
}

export interface MetricSeries {
  type: string;
  meta: MetricMeta;
  points: SeriesPoint[];
  sampleCount: number;
  sources: string[];
  /** Total for cumulative metrics; the most recent reading otherwise. */
  headline: number | null;
  headlineCaption: string;
  average: number | null;
  min: number | null;
  max: number | null;
  daysWithData: number;
}

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export const formatValue = (value: number | null, meta: MetricMeta): string => {
  if (value === null || !Number.isFinite(value)) return "—";
  return round(value, meta.decimals).toLocaleString(undefined, {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  });
};

/**
 * Turns rollup rows into one series per metric.
 *
 * A daily-total metric takes the day's `total`; a reading takes the day's
 * average. Mixing the two would report a heart rate of 30,000 bpm.
 */
export const buildSeries = (
  buckets: DailyBucket[],
  sourcesByType: Record<string, string[]> = {}
): MetricSeries[] => {
  const byType = new Map<string, DailyBucket[]>();
  for (const bucket of buckets) {
    const list = byType.get(bucket.type);
    if (list) list.push(bucket);
    else byType.set(bucket.type, [bucket]);
  }

  const series: MetricSeries[] = [];

  for (const [type, rows] of byType) {
    const meta = metricMeta(type);
    const scale = meta.scale ?? 1;

    const points: SeriesPoint[] = rows
      .map((row) => {
        const raw = meta.kind === "dailyTotal" ? row.total : row.avg_value;
        if (raw === null || !Number.isFinite(raw)) return null;
        return { day: row.day, value: raw / scale };
      })
      .filter((p): p is SeriesPoint => p !== null)
      .sort((a, b) => a.day.localeCompare(b.day));

    if (points.length === 0) continue;

    const values = points.map((p) => p.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const sampleCount = rows.reduce((a, row) => a + Number(row.sample_count ?? 0), 0);

    series.push({
      type,
      meta,
      points,
      sampleCount,
      sources: sourcesByType[type] ?? [],
      headline: meta.kind === "dailyTotal" ? sum : points[points.length - 1].value,
      headlineCaption: meta.kind === "dailyTotal" ? "total" : "latest",
      average: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      daysWithData: points.length,
    });
  }

  return series;
};

export const groupSeries = (
  series: MetricSeries[]
): { group: MetricGroup; label: string; series: MetricSeries[] }[] =>
  GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    series: series
      .filter((s) => s.meta.group === group)
      .sort((a, b) => b.sampleCount - a.sampleCount),
  })).filter((entry) => entry.series.length > 0);

// ---------------------------------------------------------------------------
// Analysis

export type InsightTone = "positive" | "attention" | "neutral";

export interface Insight {
  id: string;
  title: string;
  body: string;
  tone: InsightTone;
}

/**
 * Splits a series down the middle and compares the halves.
 *
 * Deliberately not "last 7 days vs the rest": across a five-year window that
 * would compare a week against half a decade and call any ordinary week a
 * trend. Halves stay proportionate to whatever window the patient chose.
 */
const halves = (series: MetricSeries): { earlier: number; recent: number } | null => {
  if (series.points.length < 6) return null;
  const mid = Math.floor(series.points.length / 2);
  const mean = (points: SeriesPoint[]) =>
    points.reduce((a, p) => a + p.value, 0) / points.length;
  return {
    earlier: mean(series.points.slice(0, mid)),
    recent: mean(series.points.slice(mid)),
  };
};

const changePct = (earlier: number, recent: number): number =>
  earlier === 0 ? 0 : ((recent - earlier) / Math.abs(earlier)) * 100;

const describe = (pct: number): string =>
  `${pct > 0 ? "up" : "down"} ${Math.abs(Math.round(pct))}%`;

/**
 * Observations drawn from the patient's own data.
 *
 * These are descriptive, not diagnostic: each one states what the numbers did
 * and, where a widely-published benchmark exists, how they sit against it. The
 * UI carries the caveat that none of it replaces a clinician.
 */
export const buildInsights = (series: MetricSeries[]): Insight[] => {
  const find = (type: string) => series.find((s) => s.type === type);
  const insights: Insight[] = [];

  // Steps — 10,000/day is the familiar target, though benefit accrues well below it.
  const steps = find("stepCount");
  if (steps?.average != null) {
    const avg = Math.round(steps.average);
    const trend = halves(steps);
    const trendText = trend
      ? ` Your recent half of this period is ${describe(changePct(trend.earlier, trend.recent))} on the earlier half.`
      : "";
    insights.push({
      id: "steps",
      title: `${avg.toLocaleString()} steps a day on average`,
      body:
        (avg >= 10000
          ? "That clears the commonly cited 10,000-step mark."
          : avg >= 7000
            ? "That sits in the range where most of the health benefit of walking already shows up, even though it is under 10,000."
            : "That is below the 7,000-step mark where most walking benefit begins to appear.") + trendText,
      tone: avg >= 7000 ? "positive" : "attention",
    });
  }

  // Sleep — 7-9 hours for adults.
  const sleep = find("sleepAnalysis");
  if (sleep?.average != null) {
    const avg = sleep.average;
    insights.push({
      id: "sleep",
      title: `${avg.toFixed(1)} hours of sleep a night`,
      body:
        avg >= 7 && avg <= 9
          ? `Measured across ${sleep.daysWithData} nights, that sits inside the 7–9 hours usually recommended for adults.`
          : avg < 7
            ? `Measured across ${sleep.daysWithData} nights, that is under the 7 hours usually recommended for adults.`
            : `Measured across ${sleep.daysWithData} nights, that is above the usual 7–9 hour range.`,
      tone: avg >= 7 && avg <= 9 ? "positive" : "attention",
    });
  }

  // Resting heart rate — falling is generally the direction of improving fitness.
  const resting = find("restingHeartRate");
  const restingTrend = resting ? halves(resting) : null;
  if (resting?.average != null && restingTrend) {
    const pct = changePct(restingTrend.earlier, restingTrend.recent);
    insights.push({
      id: "restingHeartRate",
      title: `Resting heart rate averaging ${Math.round(resting.average)} bpm`,
      body:
        Math.abs(pct) < 3
          ? "It has held steady across this period."
          : `It is ${describe(pct)} between the first and second half of this period. A falling resting heart rate often tracks improving fitness; a rising one can follow illness, stress or poor sleep.`,
      tone: Math.abs(pct) < 3 ? "neutral" : pct < 0 ? "positive" : "attention",
    });
  }

  // HRV — higher generally indicates better recovery, but it is highly individual.
  const hrv = find("heartRateVariabilitySDNN");
  const hrvTrend = hrv ? halves(hrv) : null;
  if (hrv?.average != null && hrvTrend) {
    const pct = changePct(hrvTrend.earlier, hrvTrend.recent);
    insights.push({
      id: "hrv",
      title: `Heart rate variability averaging ${hrv.average.toFixed(0)} ms`,
      body: `${describe(pct)} across this period. HRV is strongly individual — the direction of your own trend says more than the absolute number, and it falls with stress, illness and short sleep.`,
      tone: pct > 0 ? "positive" : "neutral",
    });
  }

  // Exercise minutes — WHO suggests 150 minutes of moderate activity a week.
  const exercise = find("appleExerciseTime");
  if (exercise?.average != null && exercise.daysWithData >= 7) {
    const weekly = exercise.average * 7;
    insights.push({
      id: "exercise",
      title: `About ${Math.round(weekly)} exercise minutes a week`,
      body:
        weekly >= 150
          ? "That meets the 150 minutes of weekly moderate activity the WHO suggests for adults."
          : `That is under the 150 weekly minutes the WHO suggests for adults — roughly ${Math.max(1, Math.round((150 - weekly) / 7))} more minutes a day would close the gap.`,
      tone: weekly >= 150 ? "positive" : "attention",
    });
  }

  // Walking speed — a well-established mobility marker.
  const speed = find("walkingSpeed");
  if (speed?.average != null) {
    insights.push({
      id: "walkingSpeed",
      title: `Walking at ${speed.average.toFixed(2)} m/s on average`,
      body:
        speed.average >= 1.0
          ? "That is a comfortable everyday walking pace and a reassuring general mobility marker."
          : "That is on the slower side for everyday walking. It is worth mentioning to your doctor if it is a change rather than your norm.",
      tone: speed.average >= 1.0 ? "positive" : "attention",
    });
  }

  // Cardio fitness.
  const vo2 = find("vo2Max");
  if (vo2?.headline != null) {
    insights.push({
      id: "vo2Max",
      title: `Cardio fitness around ${vo2.headline.toFixed(1)} ml/kg·min`,
      body: "Apple estimates this from outdoor walks and runs. It moves slowly, so treat it as a months-long trend rather than something to read week to week.",
      tone: "neutral",
    });
  }

  // Coverage — an honest note about how much the rest rests on.
  const totalDays = Math.max(...series.map((s) => s.daysWithData), 0);
  if (totalDays > 0) {
    insights.push({
      id: "coverage",
      title: `Based on ${totalDays} days with recorded data`,
      body: `Across ${series.length} measurements synced from your Apple Watch and iPhone. Days you did not wear the Watch simply have no data — they are not counted as zeros, so they cannot drag an average down.`,
      tone: "neutral",
    });
  }

  return insights;
};

// ---------------------------------------------------------------------------
// Feeding the screening models

/**
 * Values the existing screening models already accept, derived from measured
 * device data instead of recall.
 *
 * Nothing here is a new medical model — these are inputs `ScreeningInput`
 * already has, sourced from what the Watch recorded rather than from what a
 * patient remembers at the moment she fills the form. Blood pressure is
 * deliberately absent: Apple Watch does not measure it, so those fields stay
 * manual.
 */
export interface ScreeningSignals {
  weightKg: number | null;
  heightCm: number | null;
  /** `null` when there is not enough activity data to judge either way. */
  sedentary: boolean | null;
  avgDailySteps: number | null;
  weeklyExerciseMinutes: number | null;
  restingHeartRate: number | null;
  avgSleepHours: number | null;
  daysOfData: number;
}

export const EMPTY_SIGNALS: ScreeningSignals = {
  weightKg: null,
  heightCm: null,
  sedentary: null,
  avgDailySteps: null,
  weeklyExerciseMinutes: null,
  restingHeartRate: null,
  avgSleepHours: null,
  daysOfData: 0,
};

/**
 * Under 5,000 steps a day is the long-standing Tudor-Locke cut-off for a
 * sedentary adult, which is why the flag uses it rather than a number picked to
 * feel about right. A judgement is only offered with at least a fortnight of
 * days behind it — a handful of days the Watch happened to be worn says more
 * about charging habits than about how active someone is.
 */
const SEDENTARY_STEPS_PER_DAY = 5000;
const MIN_DAYS_FOR_ACTIVITY_JUDGEMENT = 14;

export const deriveScreeningSignals = (series: MetricSeries[]): ScreeningSignals => {
  const find = (type: string) => series.find((s) => s.type === type);
  const latest = (type: string): number | null => {
    const points = find(type)?.points;
    return points && points.length > 0 ? points[points.length - 1].value : null;
  };

  const steps = find("stepCount");
  const exercise = find("appleExerciseTime");
  const sleep = find("sleepAnalysis");

  const avgDailySteps = steps?.average ?? null;
  const stepDays = steps?.daysWithData ?? 0;

  // Height is stored in metres; the screening form works in centimetres.
  const heightMetres = latest("height");

  return {
    weightKg: latest("bodyMass"),
    heightCm: heightMetres !== null ? Math.round(heightMetres * 100) : null,
    sedentary:
      avgDailySteps !== null && stepDays >= MIN_DAYS_FOR_ACTIVITY_JUDGEMENT
        ? avgDailySteps < SEDENTARY_STEPS_PER_DAY
        : null,
    avgDailySteps,
    weeklyExerciseMinutes:
      exercise?.average != null && exercise.daysWithData >= 7
        ? exercise.average * 7
        : null,
    restingHeartRate: latest("restingHeartRate"),
    avgSleepHours: sleep?.average ?? null,
    daysOfData: Math.max(...series.map((s) => s.daysWithData), 0),
  };
};
