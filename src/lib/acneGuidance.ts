// Turning an acne log into nutrition changes and skincare steps.
//
// Acne is the PCOS symptom patients act on first, and it is genuinely
// diet-responsive: the androgen excess behind PCOS acne is driven by insulin,
// so the levers are the same ones the rest of the PCOS diet plan pulls —
// glycaemic load, dairy, omega-3 — just weighted differently depending on how
// bad it is and which way it is going.
//
// What this module does *not* do is diagnose from a photo. The photo is a
// record the patient (and her doctor) can look back at, and optionally a
// second opinion from the vision model on the backend; the severity that
// drives the recommendations below is whichever is available — her own rating
// takes precedence, because she is the one who can see it in daylight.
//
// Everything here is general nutrition and skincare guidance. Anything that
// needs a prescription — isotretinoin, spironolactone, combined pills — is
// deliberately absent and pointed at a doctor instead.
//
// Pure and dependency-free; see src/lib/__tests__/acneGuidance.test.ts.

export type AcneSeverity = "clear" | "mild" | "moderate" | "severe";

export const ACNE_SEVERITIES: AcneSeverity[] = ["clear", "mild", "moderate", "severe"];

export const ACNE_SEVERITY_LABELS: Record<AcneSeverity, string> = {
  clear: "Clear or nearly clear",
  mild: "Mild — a few spots",
  moderate: "Moderate — inflamed spots most days",
  severe: "Severe — painful, deep or scarring",
};

/** Ordinal value, so trends can be compared without a lookup table. */
export const SEVERITY_SCORE: Record<AcneSeverity, number> = {
  clear: 0,
  mild: 1,
  moderate: 2,
  severe: 3,
};

export type AcneRegion = "forehead" | "cheeks" | "jawline" | "chin" | "neck" | "back";

export const ACNE_REGIONS: { value: AcneRegion; label: string }[] = [
  { value: "forehead", label: "Forehead" },
  { value: "cheeks", label: "Cheeks" },
  { value: "jawline", label: "Jawline" },
  { value: "chin", label: "Chin" },
  { value: "neck", label: "Neck" },
  { value: "back", label: "Back / chest" },
];

/** One dated skin check-in, with or without a photo. */
export interface AcneEntry {
  id: string;
  /** Calendar date, "YYYY-MM-DD". */
  date: string;
  /** How the patient rated it herself. */
  severity: AcneSeverity;
  regions: AcneRegion[];
  notes: string;
  /** Storage path of the uploaded photo, if any. */
  photoPath: string | null;
  /** What the vision model reported, when the backend has Gemini configured. */
  aiSeverity: AcneSeverity | null;
  aiObservations: string | null;
}

export type AcneTrend = "improving" | "worsening" | "steady" | "unknown";

export const ACNE_TREND_LABELS: Record<AcneTrend, string> = {
  improving: "Improving",
  worsening: "Getting worse",
  steady: "About the same",
  unknown: "Not enough check-ins yet",
};

/** Entries oldest first, with unusable rows dropped. */
export const sortAcneEntries = (entries: AcneEntry[]): AcneEntry[] =>
  entries
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

export interface AcneAnalysis {
  latest: AcneEntry | null;
  entryCount: number;
  /** Severity the recommendations are built from. */
  severity: AcneSeverity | null;
  trend: AcneTrend;
  /** Average severity score across the compared window, latest half. */
  recentScore: number | null;
  /** Regions appearing in at least half the recent entries. */
  persistentRegions: AcneRegion[];
  /**
   * True when the breakouts are concentrated along the jaw, chin and neck.
   * That distribution is the classic hormonal pattern, and it is the one that
   * responds to the insulin-facing dietary changes rather than to washing more.
   */
  isHormonalPattern: boolean;
}

/** How many recent entries the trend and region analysis look at. */
const WINDOW = 3;

const average = (values: number[]): number | null =>
  values.length === 0
    ? null
    : Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;

export const analyseAcne = (entries: AcneEntry[]): AcneAnalysis => {
  const sorted = sortAcneEntries(entries);
  const latest = sorted.length ? sorted[sorted.length - 1] : null;

  const recent = sorted.slice(-WINDOW);
  const earlier = sorted.slice(-WINDOW * 2, -WINDOW);

  const recentScore = average(recent.map((e) => SEVERITY_SCORE[e.severity]));
  const earlierScore = average(earlier.map((e) => SEVERITY_SCORE[e.severity]));

  let trend: AcneTrend = "unknown";
  if (recentScore !== null && earlierScore !== null) {
    const delta = recentScore - earlierScore;
    // Half a severity band: below that, two people rating the same face would
    // disagree anyway, so calling it a direction would be noise.
    if (delta <= -0.5) trend = "improving";
    else if (delta >= 0.5) trend = "worsening";
    else trend = "steady";
  }

  const regionCounts = new Map<AcneRegion, number>();
  for (const entry of recent) {
    for (const region of entry.regions ?? []) {
      regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
    }
  }
  const persistentRegions = [...regionCounts.entries()]
    .filter(([, count]) => count >= Math.ceil(recent.length / 2))
    .map(([region]) => region)
    .sort();

  const hormonalRegions: AcneRegion[] = ["jawline", "chin", "neck"];
  const isHormonalPattern =
    persistentRegions.length > 0 &&
    persistentRegions.filter((r) => hormonalRegions.includes(r)).length >=
      Math.ceil(persistentRegions.length / 2);

  return {
    latest,
    entryCount: sorted.length,
    severity: latest?.severity ?? null,
    trend,
    recentScore,
    persistentRegions,
    isHormonalPattern,
  };
};

export interface AcneRecommendation {
  key: string;
  title: string;
  detail: string;
}

export interface AcneGuidance {
  nutrition: AcneRecommendation[];
  skincare: AcneRecommendation[];
  /** Ingredients to weight up in the generated diet plan. */
  focusIngredients: string[];
  /** Ingredients the plan should steer away from. */
  avoidIngredients: string[];
  /** True when this warrants a dermatology referral rather than a diet tweak. */
  seeADoctor: boolean;
}

// Baseline advice, true at any severity — the things that help skin and happen
// to be the same things that help insulin resistance.
const BASE_NUTRITION: AcneRecommendation[] = [
  {
    key: "low-gi",
    title: "Swap high-glycaemic carbs for low-GI ones",
    detail:
      "White rice, maida and sugary drinks spike insulin, which raises androgens, which raises sebum. Millets, whole dals, barley and steel-cut oats do the same job without the spike — this is the single biggest dietary lever for PCOS acne.",
  },
  {
    key: "omega3",
    title: "Add omega-3 every day",
    detail:
      "Flaxseed, chia, walnuts and (if you eat fish) sardines or salmon. Omega-3 is directly anti-inflammatory, which is what takes the redness out of an inflamed spot.",
  },
  {
    key: "zinc",
    title: "Get zinc from food",
    detail:
      "Pumpkin seeds, chana, rajma, cashews and sesame. Zinc has the best evidence of any micronutrient for inflammatory acne.",
  },
];

const BASE_SKINCARE: AcneRecommendation[] = [
  {
    key: "gentle-cleanse",
    title: "Cleanse twice a day, gently",
    detail:
      "A mild, non-foaming cleanser morning and night. Scrubbing harder makes inflammatory acne worse, not better — you are not washing off dirt, you are managing oil and inflammation.",
  },
  {
    key: "moisturise",
    title: "Moisturise, even if you're oily",
    detail:
      "A light, non-comedogenic gel moisturiser. Stripped skin overproduces oil to compensate, which is how a drying routine ends up causing more spots.",
  },
  {
    key: "sunscreen",
    title: "Sunscreen every morning",
    detail:
      "Post-acne marks darken and last far longer with sun exposure. A non-comedogenic SPF 30+ is what stops today's spot becoming next year's scar.",
  },
];

/**
 * Nutrition and skincare guidance for a skin history.
 *
 * The recommendations escalate with severity rather than being a fixed list:
 * the dairy trial and the low-GI push are worth the effort at moderate and
 * above, and at severe the honest answer is that food alone will not be enough.
 */
export const buildAcneGuidance = (analysis: AcneAnalysis): AcneGuidance => {
  const severity = analysis.severity ?? "clear";
  const nutrition = [...BASE_NUTRITION];
  const skincare = [...BASE_SKINCARE];

  const focusIngredients = [
    "flaxseed",
    "chia",
    "walnut",
    "pumpkin seed",
    "spinach",
    "broccoli",
    "turmeric",
    "green tea",
    "berry",
    "oat",
    "chickpea",
    "lentil",
  ];
  const avoidIngredients = ["sugar", "refined flour", "white bread", "fried"];

  if (severity === "clear") {
    return {
      nutrition: nutrition.slice(0, 2),
      skincare,
      focusIngredients,
      avoidIngredients,
      seeADoctor: false,
    };
  }

  if (severity === "moderate" || severity === "severe") {
    nutrition.push({
      key: "dairy-trial",
      title: "Try three weeks without milk",
      detail:
        "Skim and low-fat milk in particular are linked with acne; curd and paneer usually are not. Cut milk for three weeks and note whether it changes anything — if it doesn't, put it back rather than losing the calcium for nothing.",
    });
    avoidIngredients.push("milk", "whey", "skim milk");

    skincare.push({
      key: "actives",
      title: "Add one active, not three",
      detail:
        "Salicylic acid (BHA) for blackheads and congestion, or benzoyl peroxide for inflamed spots. Start every other night. Layering several actives at once irritates the skin barrier, and irritated skin breaks out.",
    });
  }

  if (analysis.isHormonalPattern) {
    nutrition.push({
      key: "hormonal-pattern",
      title: "Your pattern is the insulin-facing one",
      detail:
        "Breakouts sitting along the jaw, chin and neck are the hormonal distribution. That is the pattern that responds to the low-GI, high-fibre, resistance-training side of PCOS management — worth being consistent with those rather than changing face washes.",
    });
    focusIngredients.push("cinnamon", "fenugreek", "barley", "millet");
  }

  if (analysis.trend === "worsening") {
    nutrition.push({
      key: "worsening",
      title: "Track what changed",
      detail:
        "Your last few check-ins are worse than the ones before. Note anything that shifted — a new supplement, more sugar, a stressful stretch, a new product — before changing several things at once.",
    });
  }

  if (analysis.trend === "improving") {
    skincare.push({
      key: "stay-the-course",
      title: "Don't change anything yet",
      detail:
        "It's improving. Acne routines take 8–12 weeks to show their full effect, so the most useful thing you can do now is keep going and keep logging.",
    });
  }

  const seeADoctor =
    severity === "severe" ||
    (severity === "moderate" && analysis.trend === "worsening");

  if (seeADoctor) {
    skincare.push({
      key: "see-a-doctor",
      title: "This needs a doctor, not a diet change",
      detail:
        "Painful, deep or scarring acne responds to prescription treatment, and scarring is far easier to prevent than to fix. Keep the nutrition changes going — they help — but book an appointment rather than waiting them out.",
    });
  }

  return {
    nutrition,
    skincare,
    focusIngredients: [...new Set(focusIngredients)],
    avoidIngredients: [...new Set(avoidIngredients)],
    seeADoctor,
  };
};
