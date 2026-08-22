import {
  Activity,
  Baby,
  BookOpenCheck,
  CalendarHeart,
  ClipboardList,
  Droplets,
  Flame,
  HeartPulse,
  Leaf,
  MessageSquareHeart,
  Salad,
  Microscope,
  ScanFace,
  Soup,
  Sparkles,
  Stethoscope,
  Users,
  Wind,
} from "lucide-react";

/**
 * Every word and figure on the landing page, in one file.
 *
 * Kept out of the section components for two reasons. Copy on a marketing
 * page gets edited far more often than its layout, and whoever is editing it
 * should not have to read JSX to do so. And it makes one rule enforceable at a
 * glance: **nothing here may claim something the product does not do.** Each
 * feature below maps to a route that exists in `App.tsx`, and the figures are
 * counts of what is in the repository, not invented traction numbers.
 */

export const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Demo", href: "#demo" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
] as const;

/** The strip under the hero. Care pathways, not customer logos. */
export const CARE_TRACKS = [
  { icon: Baby, label: "Pregnancy" },
  { icon: CalendarHeart, label: "PCOD / PCOS" },
  { icon: Leaf, label: "General wellness" },
  { icon: HeartPulse, label: "Cycle tracking" },
  { icon: ScanFace, label: "Skin & acne logs" },
  { icon: Activity, label: "Weight & lifestyle" },
  { icon: Soup, label: "Meal compatibility" },
  { icon: Users, label: "Verified practitioners" },
] as const;

/** The stacked cards. Four steps, in the order a patient actually meets them. */
export const JOURNEY_STEPS = [
  {
    step: "01",
    eyebrow: "Prakriti",
    title: "We find your constitution before we find your calories",
    body:
      "A short profile — body frame, skin, appetite, sleep, temperament — resolves your vata, pitta and kapha balance. Nothing is prescribed off a body-weight formula alone, because two women at the same weight do not digest the same way.",
    points: ["Dosha profile in about four minutes", "Life stage and conditions captured up front", "Re-run it whenever your body changes"],
    icon: Wind,
  },
  {
    step: "02",
    eyebrow: "Ahara",
    title: "A plan you could actually cook this evening",
    body:
      "Targets come from your stage of life, not a generic deficit — pregnancy raises them, PCOS shifts them toward low-glycaemic. The meals underneath are real Indian dishes, matched to your dosha and screened against your allergies.",
    points: ["Breakfast, lunch, snack and dinner — all swappable", "Every dish carries its Ayurvedic reasoning", "Your kitchen and your budget, not a stock plan"],
    icon: Salad,
  },
  {
    step: "03",
    eyebrow: "Vichara",
    title: "Log what happened, not what should have",
    body:
      "Tick meals off as you eat them and say how each one sat. Cycles, weight, skin and sleep are logged in the same place — and only the trackers your care pathway calls for ever appear.",
    points: ["Meal, cycle, weight, skin and lifestyle logs", "Trackers appear per pathway, never all at once", "Reminders you set, on your schedule"],
    icon: ClipboardList,
  },
  {
    step: "04",
    eyebrow: "Chikitsa",
    title: "Your practitioner is reading the same record",
    body:
      "What you log is what your doctor opens. She adjusts the chart, flags a risk, or messages you inside the platform — no screenshots, no re-typing your history at every appointment.",
    points: ["Shared record, one source of truth", "Risk screening surfaced to your doctor", "Messaging and appointments in-platform"],
    icon: Stethoscope,
  },
] as const;

/** The bento grid. `span` is the desktop column span inside a 6-column grid. */
export const FEATURES = [
  {
    icon: Sparkles,
    title: "Diet charts, generated then edited",
    body:
      "The generator drafts from dosha, life stage, conditions and allergies. Your practitioner edits before it ever reaches you — nothing ships raw.",
    span: "lg:col-span-3",
    tone: "feature" as const,
  },
  {
    icon: Microscope,
    title: "Screening that reaches the right person",
    body:
      "Trained models score PCOS and pregnancy-related risk from what has been logged, and put the result in front of a practitioner rather than in front of the patient alone.",
    span: "lg:col-span-3",
    tone: "feature" as const,
  },
  {
    icon: Soup,
    title: "A food database that knows Indian kitchens",
    body:
      "Eight thousand dishes, Kerala sadhya to Punjabi staples, each carrying how it moves vata, pitta and kapha alongside its macros — so a recommendation can explain itself in both languages.",
    span: "lg:col-span-2",
    tone: "quiet" as const,
  },
  {
    icon: Droplets,
    title: "Compatibility, checked before the plate",
    body:
      "Viruddha ahara — the combinations Ayurveda warns against — flagged as you build a meal, not after you have eaten it.",
    span: "lg:col-span-2",
    tone: "quiet" as const,
  },
  {
    icon: MessageSquareHeart,
    title: "A companion that stays in scope",
    body:
      "An in-app assistant that answers from your plan and your logs, and hands you to your doctor the moment a question stops being about food.",
    span: "lg:col-span-2",
    tone: "quiet" as const,
  },
  {
    icon: BookOpenCheck,
    title: "Twenty-six languages, interface included",
    body:
      "Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, Sanskrit and Urdu, plus twelve more — translated in the chrome, not only in the content.",
    span: "lg:col-span-3",
    tone: "feature" as const,
  },
  {
    icon: Users,
    title: "Built for a practice, not a single doctor",
    body:
      "Patient lists, appointments, alerts, feedback and team management — so a clinic can run on this rather than bolting it onto something else.",
    span: "lg:col-span-3",
    tone: "feature" as const,
  },
] as const;

/**
 * The three doshas. These are the app's domain colours (`--vata`/`--pitta`/
 * `--kapha`) and they carry clinical meaning, so each card names its dosha in
 * words as well — the distinction can never rest on hue alone.
 */
export const DOSHAS = [
  {
    name: "Vata",
    element: "Air · Space",
    body: "Light, dry, mobile. Settled by warm, moist, grounding food and a steady daily rhythm.",
    swatch: "bg-vata",
    text: "text-vata",
    icon: Wind,
    favours: ["Warm cooked grains", "Ghee and sesame", "Sweet, sour, salty"],
  },
  {
    name: "Pitta",
    element: "Fire · Water",
    body: "Sharp, hot, intense. Cooled by sweet, bitter and astringent tastes and by not skipping meals.",
    swatch: "bg-pitta",
    text: "text-pitta",
    icon: Flame,
    favours: ["Coconut and cucumber", "Bitter greens", "Sweet, bitter, astringent"],
  },
  {
    name: "Kapha",
    element: "Earth · Water",
    body: "Heavy, cool, stable. Lifted by light, warm, spiced food and by eating less than feels natural.",
    swatch: "bg-kapha",
    text: "text-kapha",
    icon: Leaf,
    favours: ["Millets and legumes", "Ginger and black pepper", "Pungent, bitter, astringent"],
  },
] as const;

/**
 * Illustrative care scenarios, in the visual rhythm a testimonial section
 * would occupy.
 *
 * They are **not** quotes, and they carry no names or photographs, because
 * this product has no users to quote yet and a landing page that invents them
 * is lying to the person reading it. Each one describes what the platform
 * actually does on that pathway, which is the thing a visitor is trying to
 * work out anyway.
 */
export const SCENARIOS = [
  {
    tag: "Second trimester",
    title: "Iron, protein and no restriction",
    body:
      "Pregnancy overrides every other rule in the platform. Targets rise, restrictive PCOS logic is suppressed outright, and weight is left to her obstetrician rather than scored by an app.",
    icon: Baby,
  },
  {
    tag: "PCOS, six months in",
    title: "A cycle history worth reading",
    body:
      "Cycle length, weight and skin logged side by side become a trend her practitioner can act on — and the questionnaire is offered rather than demanded, so logging can start on day one.",
    icon: CalendarHeart,
  },
  {
    tag: "General wellness",
    title: "Just the food, kept honest",
    body:
      "No trackers she has no use for. A dosha-matched plan, a compatibility check before she cooks, and a shop that compares prices instead of picking her basket for her.",
    icon: Leaf,
  },
] as const;

/** Figures on the About section. Each one is countable in this repository. */
export const STATS = [
  { value: 8000, suffix: "", label: "dishes mapped to their dosha effects" },
  { value: 26, suffix: "", label: "languages, interface included" },
  { value: 3, suffix: "", label: "doshas kept first-class throughout" },
  { value: 1, suffix: "", label: "record, shared by patient and doctor" },
] as const;

export const FAQS = [
  {
    q: "Is this a replacement for seeing a doctor?",
    a: "No, and it is built so that it cannot become one. Every diet chart is drafted by the generator and then edited by a registered practitioner before a patient sees it, screening results go to a doctor rather than to the patient alone, and the in-app assistant hands off as soon as a question stops being about food.",
  },
  {
    q: "How is a plan actually personalised?",
    a: "Four inputs: your dosha profile, your life stage, any diagnosed conditions, and your allergies. Life stage takes precedence over everything else — a pregnant patient never receives the calorie deficit or the exclusions a PCOS plan would apply, even if both apply to her.",
  },
  {
    q: "Do I have to fill in the questionnaire before I can use it?",
    a: "Not on the PCOD/PCOS pathway. Cycle tracking is only useful if you start logging early, so the questionnaire is offered rather than demanded — your profile then shows what a completed Ayurvedic profile would add, instead of blocking the door until you finish it.",
  },
  {
    q: "Who can see what I log?",
    a: "You and the practitioner treating you. The database is row-level secured, so a record is reachable only by the patient it belongs to and the doctor connected to her. Service-role keys are backend-only and never reach the browser.",
  },
  {
    q: "What do practitioners get?",
    a: "A patient list, an appointment scheduler, risk alerts, a food explorer and recipe builder, diet-chart editing, patient feedback and team management. Doctor accounts are verified against a medical-council licence before they can take patients.",
  },
  {
    q: "Which languages are supported?",
    a: "Twenty-six. Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, Sanskrit, Nepali and Urdu on the Indian side, and English, Arabic, Chinese, French, German, Indonesian, Japanese, Korean, Portuguese, Russian, Spanish and Swahili internationally. The app chrome is hand-translated; everything else is translated at runtime, and language names always appear in their own script.",
  },
] as const;

export const FOOTER_COLUMNS = [
  {
    heading: "Platform",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Live demo", href: "#demo" },
      { label: "The three doshas", href: "#doshas" },
    ],
  },
  {
    heading: "For patients",
    links: [
      { label: "Create an account", href: "/auth/patient" },
      { label: "Care pathways", href: "#scenarios" },
      { label: "Questions", href: "#faq" },
    ],
  },
  {
    heading: "For practitioners",
    links: [
      { label: "Join as a doctor", href: "/auth/doctor" },
      { label: "What you get", href: "#roles" },
      { label: "Talk to us", href: "#contact" },
    ],
  },
] as const;
