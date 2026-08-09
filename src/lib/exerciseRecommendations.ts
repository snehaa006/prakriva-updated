// Condition-driven exercise recommendations for the Lifestyle Tracker.
//
// The tracker used to offer the same three activities (yoga / walk / gym) to
// everyone. Exercise is not one-size-fits-all: what helps anaemia (gentle,
// oxygen-conservative movement) is close to the opposite of what helps PCOS
// (sustained aerobic work plus resistance training), and several conditions
// have movements that are actively unsafe. This module maps the conditions we
// already know about — the maternal screening results and the conditions the
// patient reported in her profile — onto specific exercises and specific
// things to avoid.
//
// Pure and dependency-free so it is unit testable; see
// src/lib/__tests__/exerciseRecommendations.test.ts.
//
// These are general wellness suggestions, not a prescription — the UI shows a
// "check with your doctor" note alongside them.

export type ExerciseIntensity = "gentle" | "moderate" | "brisk";

/** Icon slug; the page maps these onto lucide components. */
export type ExerciseIcon =
  | "walk"
  | "yoga"
  | "breathing"
  | "strength"
  | "swim"
  | "cycle"
  | "stretch"
  | "heart";

export interface Exercise {
  /** Stable id — also the key minutes are logged under in `LifestyleDayLog`. */
  id: string;
  name: string;
  icon: ExerciseIcon;
  intensity: ExerciseIntensity;
  /** Suggested minutes per day. */
  minutes: number;
  /** How to do it. */
  how: string;
  /** YouTube search terms for a how-to video — see `videoUrl` below. */
  videoQuery: string;
}

/**
 * A YouTube link for an exercise's how-to video.
 *
 * Deliberately a *search* URL rather than a hardcoded video id. A specific id
 * can be taken down, go private, or be re-uploaded as something else entirely,
 * and a dead or wrong-content link on a page giving health guidance is worse
 * than no link. A search always resolves and stays current as better videos
 * appear. Swap in `https://www.youtube.com/watch?v=<id>` per exercise if you
 * ever want to curate specific videos.
 */
export const videoUrl = (exercise: Exercise): string =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.videoQuery)}`;

/** The exercises this module can recommend, keyed by id. */
const CATALOG: Record<string, Exercise> = {
  "gentle-walk": {
    id: "gentle-walk",
    name: "Gentle walk",
    icon: "walk",
    intensity: "gentle",
    minutes: 20,
    how: "Easy, conversational pace on flat ground. Stop before you feel breathless.",
    videoQuery: "gentle walking exercise for beginners low intensity",
  },
  "brisk-walk": {
    id: "brisk-walk",
    name: "Brisk walk",
    icon: "walk",
    intensity: "brisk",
    minutes: 30,
    how: "Fast enough that talking takes effort but singing doesn't happen.",
    videoQuery: "brisk walking workout proper form technique",
  },
  "post-meal-walk": {
    id: "post-meal-walk",
    name: "Post-meal walk",
    icon: "walk",
    intensity: "gentle",
    minutes: 15,
    how: "Start 15–30 minutes after each main meal — this is when it blunts the glucose spike.",
    videoQuery: "walking after meals to lower blood sugar",
  },
  "restorative-yoga": {
    id: "restorative-yoga",
    name: "Restorative yoga",
    icon: "yoga",
    intensity: "gentle",
    minutes: 20,
    how: "Supported, held poses — child's pose, supta baddha konasana, legs-up-the-wall.",
    videoQuery: "restorative yoga for beginners supported poses",
  },
  "hatha-yoga": {
    id: "hatha-yoga",
    name: "Hatha yoga",
    icon: "yoga",
    intensity: "moderate",
    minutes: 30,
    how: "Standing and seated asanas held with steady breath. Cat-cow and gentle twists included.",
    videoQuery: "hatha yoga full class for beginners",
  },
  "prenatal-yoga": {
    id: "prenatal-yoga",
    name: "Prenatal yoga",
    icon: "yoga",
    intensity: "gentle",
    minutes: 25,
    how: "A pregnancy-specific sequence — no deep twists, no lying flat on your back after the first trimester.",
    videoQuery: "prenatal yoga safe routine for pregnancy",
  },
  "surya-namaskar": {
    id: "surya-namaskar",
    name: "Surya Namaskar",
    icon: "yoga",
    intensity: "brisk",
    minutes: 15,
    how: "6–12 slow rounds, breath matched to each movement.",
    videoQuery: "surya namaskar step by step with breathing",
  },
  pranayama: {
    id: "pranayama",
    name: "Pranayama & breathing",
    icon: "breathing",
    intensity: "gentle",
    minutes: 10,
    how: "Anulom vilom and slow diaphragmatic breathing, seated and unhurried. Never hold the breath to strain.",
    videoQuery: "anulom vilom pranayama breathing technique for beginners",
  },
  "light-resistance": {
    id: "light-resistance",
    name: "Light resistance work",
    icon: "strength",
    intensity: "gentle",
    minutes: 15,
    how: "Resistance bands or bodyweight, high reps and low load. Breathe out on effort — never hold your breath.",
    videoQuery: "resistance band workout low impact beginners",
  },
  "strength-training": {
    id: "strength-training",
    name: "Strength training",
    icon: "strength",
    intensity: "brisk",
    minutes: 30,
    how: "2–3 sessions a week covering the major muscle groups, with a rest day between them.",
    videoQuery: "beginner full body strength training workout",
  },
  swimming: {
    id: "swimming",
    name: "Swimming",
    icon: "swim",
    intensity: "moderate",
    minutes: 30,
    how: "Steady laps or water walking — the water carries your joints.",
    videoQuery: "swimming technique for beginners low impact exercise",
  },
  "water-aerobics": {
    id: "water-aerobics",
    name: "Water aerobics",
    icon: "swim",
    intensity: "moderate",
    minutes: 30,
    how: "Chest-deep water, continuous movement, no impact through the knees or hips.",
    videoQuery: "water aerobics workout for beginners",
  },
  "stationary-cycling": {
    id: "stationary-cycling",
    name: "Stationary cycling",
    icon: "cycle",
    intensity: "moderate",
    minutes: 25,
    how: "Light resistance, steady cadence, upright posture.",
    videoQuery: "stationary bike workout beginners low resistance",
  },
  "pelvic-floor": {
    id: "pelvic-floor",
    name: "Pelvic floor exercises",
    icon: "heart",
    intensity: "gentle",
    minutes: 10,
    how: "3 sets of 10 slow lifts and releases. Relax fully between reps — the release matters as much as the squeeze.",
    videoQuery: "pelvic floor kegel exercises how to do correctly",
  },
  stretching: {
    id: "stretching",
    name: "Stretching & mobility",
    icon: "stretch",
    intensity: "gentle",
    minutes: 15,
    how: "Hold each stretch 30 seconds, to mild tension only, never to pain.",
    videoQuery: "full body stretching routine for flexibility beginners",
  },
  "core-stability": {
    id: "core-stability",
    name: "Core stability",
    icon: "strength",
    intensity: "moderate",
    minutes: 15,
    how: "Dead bugs, bird dogs and side planks — control over crunches.",
    videoQuery: "core stability exercises dead bug bird dog side plank",
  },
  "tai-chi": {
    id: "tai-chi",
    name: "Tai chi / mindful movement",
    icon: "heart",
    intensity: "gentle",
    minutes: 20,
    how: "Slow weight-shifting sequences; good for balance and for calming a racing mind.",
    videoQuery: "tai chi for beginners slow mindful movement",
  },
};

export const getExercise = (id: string): Exercise | undefined => CATALOG[id];

/** A condition, the exercises that help it, and what to steer clear of. */
export interface ExercisePlan {
  key: string;
  label: string;
  /** Why exercise is prescribed this way for this condition. */
  rationale: string;
  exerciseIds: string[];
  avoid: string[];
}

/**
 * Condition → exercise plan.
 *
 * Keys line up with `ConditionKey` from the maternal screening
 * (src/types/diseaseDetection.ts) where they overlap, so a screening result
 * maps straight through; the rest cover conditions patients report in their
 * profile questionnaire.
 */
const PLANS: Record<string, ExercisePlan> = {
  anaemia: {
    key: "anaemia",
    label: "Anaemia",
    rationale:
      "Low haemoglobin means less oxygen reaching your muscles, so hard efforts leave you dizzy and drained. Short, gentle, oxygen-conservative movement builds stamina back without tipping you into exhaustion.",
    exerciseIds: [
      "gentle-walk",
      "restorative-yoga",
      "pranayama",
      "light-resistance",
      "stretching",
    ],
    avoid: [
      "High-intensity intervals, running and other breathless efforts",
      "Long endurance sessions — keep it to 20–30 minutes and build up slowly",
      "Hot yoga or exercising in the heat (raises the risk of fainting)",
      "Exercising on an empty stomach, or right after your iron tablet",
      "Standing up quickly from the floor — rise in stages",
    ],
  },
  gdm: {
    key: "gdm",
    label: "Gestational diabetes",
    rationale:
      "Muscle pulls glucose out of the blood without needing insulin, so movement timed around meals is the single most effective thing you can do between doses.",
    exerciseIds: [
      "post-meal-walk",
      "brisk-walk",
      "light-resistance",
      "prenatal-yoga",
      "stationary-cycling",
    ],
    avoid: [
      "Exercising when your glucose is very high or very low — test first",
      "Long fasted sessions; carry a fast-acting carbohydrate with you",
      "Contact sports, or anything with a fall risk",
    ],
  },
  diabetes: {
    key: "diabetes",
    label: "Diabetes",
    rationale:
      "Aerobic work improves insulin sensitivity for up to 48 hours, and muscle built through resistance training gives glucose somewhere to go — the two together beat either alone.",
    exerciseIds: [
      "post-meal-walk",
      "brisk-walk",
      "strength-training",
      "stationary-cycling",
      "hatha-yoga",
    ],
    avoid: [
      "Going more than two days without a session — the insulin-sensitivity benefit fades",
      "Exercising with very high or very low blood sugar",
      "Barefoot exercise if you have any numbness in your feet — check them afterwards",
    ],
  },
  preeclampsia: {
    key: "preeclampsia",
    label: "Preeclampsia / high blood pressure",
    rationale:
      "Anything that spikes blood pressure — straining, breath-holding, hanging upside down — is exactly what you're managing against. Gentle, rhythmic movement and slow breathing lower it instead.",
    exerciseIds: ["gentle-walk", "pranayama", "restorative-yoga", "stretching"],
    avoid: [
      "Heavy lifting and any move where you strain or hold your breath",
      "Inversions and head-below-heart poses",
      "Long isometric holds (planks, wall sits)",
      "Hot or humid environments",
      "Stop immediately for headache, visual changes or upper-abdominal pain",
    ],
  },
  hypertension: {
    key: "hypertension",
    label: "High blood pressure",
    rationale:
      "Steady aerobic movement most days lowers resting blood pressure measurably. Straining and breath-holding do the opposite, so load stays light and breathing stays continuous.",
    exerciseIds: ["brisk-walk", "pranayama", "swimming", "light-resistance", "stretching"],
    avoid: [
      "Heavy lifting and the Valsalva manoeuvre (straining against a held breath)",
      "Maximal-effort sprints or intervals",
      "Sudden stops — cool down gradually",
    ],
  },
  thyroid: {
    key: "thyroid",
    label: "Thyroid disorder",
    rationale:
      "An underactive thyroid slows metabolism and saps energy; regular moderate aerobic work plus resistance training helps hold on to muscle and lifts fatigue without overreaching on low-energy days.",
    exerciseIds: [
      "brisk-walk",
      "hatha-yoga",
      "strength-training",
      "pranayama",
      "stretching",
    ],
    avoid: [
      "Pushing through a flat day — scale the session down instead of skipping recovery",
      "Deep neck compression (full shoulder stand) if your thyroid is enlarged or tender",
    ],
  },
  pcos: {
    key: "pcos",
    label: "PCOS / PCOD",
    rationale:
      "PCOS runs on insulin resistance. Sustained aerobic work plus resistance training improves it and helps regulate cycles — but chronic overtraining raises cortisol and works against you.",
    exerciseIds: [
      "brisk-walk",
      "strength-training",
      "stationary-cycling",
      "surya-namaskar",
      "core-stability",
    ],
    avoid: [
      "Daily high-intensity training with no rest days — cortisol works against you here",
      "Very long fasted cardio sessions",
    ],
  },
  mental_health: {
    key: "mental_health",
    label: "Mood, anxiety & stress",
    rationale:
      "Rhythmic aerobic movement and slow breathing both act on the stress response directly — outdoor walking and paced breathing have the strongest evidence of anything here.",
    exerciseIds: ["brisk-walk", "pranayama", "restorative-yoga", "tai-chi", "stretching"],
    avoid: [
      "Vigorous exercise late at night — it delays sleep, which you need most",
      "All-or-nothing targets; ten honest minutes beats a skipped hour",
    ],
  },
  uti: {
    key: "uti",
    label: "Urinary tract infection",
    rationale:
      "Keep moving gently while the infection clears, and build the pelvic floor once it has — weak pelvic floor muscles and incomplete emptying are what invite the next one.",
    exerciseIds: ["gentle-walk", "pelvic-floor", "pranayama", "stretching"],
    avoid: [
      "Long cycling sessions and anything with sustained saddle pressure",
      "Swimming pools while the infection is active",
      "Staying in damp exercise clothes — change straight after",
      "Rest properly if you have fever or back pain; that needs a doctor, not a workout",
    ],
  },
  miscarriage: {
    key: "miscarriage",
    label: "Miscarriage risk",
    rationale:
      "With a higher-risk pregnancy the goal is circulation and calm, not fitness gains. Everything here is low-impact and stops well short of strain — and all of it needs your obstetrician's go-ahead first.",
    exerciseIds: ["gentle-walk", "pranayama", "prenatal-yoga", "pelvic-floor"],
    avoid: [
      "Strenuous exercise of any kind until your doctor clears it",
      "Jumping, running and other high-impact movement",
      "Abdominal work and deep twists",
      "Heavy lifting and contact sports",
      "Stop and call your doctor for bleeding, cramping or fluid loss",
    ],
  },
  pregnancy_risk: {
    key: "pregnancy_risk",
    label: "Higher-risk pregnancy",
    rationale:
      "Several risk factors are stacking up, so movement stays low-impact and moderate — enough to help circulation, blood pressure and sleep, never enough to leave you breathless.",
    exerciseIds: [
      "gentle-walk",
      "prenatal-yoga",
      "pranayama",
      "pelvic-floor",
      "swimming",
    ],
    avoid: [
      "Lying flat on your back for long periods after the first trimester",
      "High-impact, contact or fall-risk activities",
      "Exercising to breathlessness — you should still be able to talk",
      "Overheating; hydrate before, during and after",
    ],
  },
  obesity: {
    key: "obesity",
    label: "Weight management",
    rationale:
      "Start with movement your joints can absorb and can sustain daily — low-impact aerobic work for volume, resistance training so the weight you lose is fat rather than muscle.",
    exerciseIds: [
      "brisk-walk",
      "water-aerobics",
      "stationary-cycling",
      "strength-training",
      "post-meal-walk",
    ],
    avoid: [
      "High-impact jumping or running until your base fitness is built up",
      "Going from nothing to daily hour-long sessions — ramp up over weeks",
    ],
  },
  arthritis: {
    key: "arthritis",
    label: "Arthritis & joint pain",
    rationale:
      "Joints need movement to stay lubricated, but not impact. Water takes the load off entirely, and range-of-motion work keeps stiffness from setting in.",
    exerciseIds: ["water-aerobics", "swimming", "stretching", "tai-chi", "light-resistance"],
    avoid: [
      "Running, jumping and other high-impact loading",
      "Working through sharp joint pain — soreness that lasts past two hours means it was too much",
      "Staying still through a flare; keep gentle range-of-motion going",
    ],
  },
  asthma: {
    key: "asthma",
    label: "Asthma & breathing",
    rationale:
      "Breath training and humid-air exercise improve control without provoking a narrowing airway. Warm up long and start slow — abrupt hard starts are what trigger exercise-induced symptoms.",
    exerciseIds: ["pranayama", "swimming", "gentle-walk", "stretching"],
    avoid: [
      "Cold, dry air and high-pollution or high-pollen days",
      "Starting hard without a 10-minute warm-up",
      "Exercising without your reliever inhaler within reach",
    ],
  },
  back_pain: {
    key: "back_pain",
    label: "Back pain",
    rationale:
      "A stable core and mobile hips take the load off the spine. Controlled stability work beats both bed rest and heavy lifting.",
    exerciseIds: ["core-stability", "stretching", "gentle-walk", "swimming", "hatha-yoga"],
    avoid: [
      "Sit-ups, crunches and heavy deadlifts",
      "Deep forward folds with locked knees",
      "Long unbroken sitting — get up every 30–40 minutes",
    ],
  },
  digestive: {
    key: "digestive",
    label: "Digestive issues",
    rationale:
      "Walking after meals and gentle twisting move things along mechanically; slow breathing settles the gut-brain axis that drives most of the discomfort.",
    exerciseIds: ["post-meal-walk", "hatha-yoga", "pranayama", "brisk-walk"],
    avoid: [
      "Hard exercise straight after a large meal",
      "Deep compressive abdominal poses during a flare",
    ],
  },
  heart_disease: {
    key: "heart_disease",
    label: "Heart health",
    rationale:
      "Steady aerobic work is cardiac rehab's backbone — moderate, continuous and predictable, with load kept light so blood pressure never spikes.",
    exerciseIds: ["gentle-walk", "brisk-walk", "pranayama", "light-resistance", "stretching"],
    avoid: [
      "Heavy lifting and straining against a held breath",
      "Vigorous exercise that your cardiologist hasn't cleared",
      "Stop at once for chest pain, unusual breathlessness or palpitations",
    ],
  },
};

/** Shown when we know of no conditions to tailor to. */
export const GENERAL_PLAN: ExercisePlan = {
  key: "general",
  label: "General wellness",
  rationale:
    "No specific conditions on file, so this is the standard balanced week: aerobic work most days, strength twice a week, and breathing to close it out.",
  exerciseIds: [
    "brisk-walk",
    "hatha-yoga",
    "strength-training",
    "pranayama",
    "stretching",
  ],
  avoid: [],
};

/**
 * Free-text aliases → plan key, so conditions typed or ticked in the profile
 * questionnaire ("Anemia", "PCOD", "high BP") land on the right plan.
 */
const ALIASES: Array<[string, string[]]> = [
  ["anaemia", ["anaemia", "anemia", "low haemoglobin", "low hemoglobin", "iron deficiency"]],
  ["gdm", ["gestational diabetes", "gdm"]],
  ["diabetes", ["diabetes", "diabetic", "type 2", "type ii", "insulin resistance", "prediabetes"]],
  ["preeclampsia", ["preeclampsia", "pre-eclampsia", "pre eclampsia", "eclampsia"]],
  ["hypertension", ["hypertension", "high blood pressure", "high bp", "raised bp"]],
  ["thyroid", ["thyroid", "hypothyroid", "hyperthyroid", "hashimoto", "goitre", "goiter"]],
  ["pcos", ["pcos", "pcod", "polycystic"]],
  [
    "mental_health",
    ["depression", "anxiety", "stress", "mental health", "panic", "insomnia", "mood"],
  ],
  ["uti", ["uti", "urinary tract", "urine infection", "cystitis"]],
  ["miscarriage", ["miscarriage", "pregnancy loss", "recurrent loss"]],
  ["pregnancy_risk", ["high risk pregnancy", "pregnancy risk"]],
  ["obesity", ["obesity", "obese", "overweight", "weight gain", "weight loss"]],
  ["arthritis", ["arthritis", "joint pain", "osteoarthritis", "rheumatoid", "knee pain"]],
  ["asthma", ["asthma", "breathing", "respiratory", "copd", "bronchitis"]],
  ["back_pain", ["back pain", "backache", "spondyl", "slipped disc", "sciatica"]],
  [
    "digestive",
    ["ibs", "constipation", "bloating", "acidity", "reflux", "gerd", "digestive", "indigestion"],
  ],
  [
    "heart_disease",
    ["heart disease", "cardiac", "cardiovascular", "cholesterol", "angina"],
  ],
];

/** The plan key a free-text condition maps to, or `null` if we know of none. */
export const matchConditionKey = (raw: string): string | null => {
  const text = raw.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (!text) return null;
  if (PLANS[raw]) return raw; // already a canonical key (e.g. a screening key)

  for (const [key, needles] of ALIASES) {
    if (needles.some((needle) => text.includes(needle))) return key;
  }
  return null;
};

/** Movements that are unsafe in pregnancy regardless of the condition. */
const PREGNANCY_UNSAFE = new Set([
  "surya-namaskar",
  "core-stability",
  "strength-training",
]);

/** Pregnancy-safe stand-ins for the exercises stripped above. */
const PREGNANCY_SUBSTITUTES: Record<string, string> = {
  "surya-namaskar": "prenatal-yoga",
  "core-stability": "pelvic-floor",
  "strength-training": "light-resistance",
  "hatha-yoga": "prenatal-yoga",
};

const PREGNANCY_AVOID = [
  "Lying flat on your back for long stretches after the first trimester",
  "Deep twists, jumping and contact sports",
  "Getting overheated — skip hot yoga and midday heat",
];

export interface ConditionInput {
  /** Canonical key or free text — both are accepted. */
  condition: string;
  /** Screening risk level, when it came from a screening result. */
  riskLevel?: string;
}

export interface RecommendationOptions {
  conditions: ConditionInput[];
  isPregnant?: boolean;
}

export interface ExerciseRecommendation {
  /** One plan per matched condition, most relevant first. */
  plans: ExercisePlan[];
  /** Every recommended exercise, de-duplicated — what the tracker logs against. */
  exercises: Exercise[];
  /** Combined "avoid" advice, de-duplicated. */
  avoid: string[];
  /** True when nothing matched and `GENERAL_PLAN` is being shown instead. */
  isGeneral: boolean;
}

/** Higher risk sorts first so the most pressing condition leads the list. */
const RISK_ORDER: Record<string, number> = { high: 0, moderate: 1, low: 2 };

/**
 * Exercises tailored to the conditions a patient actually has.
 *
 * Unmatched conditions are dropped rather than guessed at; if nothing matches
 * at all the caller gets `GENERAL_PLAN` with `isGeneral` set.
 */
export const recommendExercises = ({
  conditions,
  isPregnant = false,
}: RecommendationOptions): ExerciseRecommendation => {
  const matched = new Map<string, { plan: ExercisePlan; rank: number }>();

  for (const { condition, riskLevel } of conditions) {
    const key = matchConditionKey(condition);
    if (!key) continue;
    const rank = RISK_ORDER[String(riskLevel).toLowerCase()] ?? 1.5;
    const existing = matched.get(key);
    // Same condition reported twice: keep the more urgent ranking.
    if (!existing || rank < existing.rank) matched.set(key, { plan: PLANS[key], rank });
  }

  const isGeneral = matched.size === 0;
  const plans = isGeneral
    ? [GENERAL_PLAN]
    : [...matched.values()].sort((a, b) => a.rank - b.rank).map((m) => m.plan);

  const exerciseIds: string[] = [];
  const avoid: string[] = [];

  for (const plan of plans) {
    for (const id of plan.exerciseIds) {
      const safeId = isPregnant ? PREGNANCY_SUBSTITUTES[id] ?? id : id;
      if (isPregnant && PREGNANCY_UNSAFE.has(safeId)) continue;
      if (!exerciseIds.includes(safeId)) exerciseIds.push(safeId);
    }
    for (const item of plan.avoid) {
      if (!avoid.includes(item)) avoid.push(item);
    }
  }

  if (isPregnant) {
    for (const item of PREGNANCY_AVOID) {
      if (!avoid.includes(item)) avoid.push(item);
    }
  }

  return {
    plans,
    exercises: exerciseIds.map((id) => CATALOG[id]).filter(Boolean),
    avoid,
    isGeneral,
  };
};
