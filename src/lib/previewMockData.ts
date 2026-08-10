// Realistic, Ayurveda/pregnancy/PCOS-appropriate mock content shown only when
// `isPreviewMode()` is true (see `src/lib/previewMode.ts`). Kept in one place
// so every preview-only data short-circuit pulls from the same believable
// "preview patient" — Priya, second-trimester, following a Vata-Pitta plan.
//
// Nothing here ever touches Supabase or localStorage — it is generated fresh
// on every load, exactly like LifestyleTracker's existing demo-data pattern.

export const PREVIEW_BANNER_TEXT =
  "Preview data — you're viewing sample content so the redesign can be reviewed without a real account.";

/* ----------------------------- Dashboard: meals ----------------------------- */

export interface PreviewMeal {
  id: string;
  name: string;
  type: "breakfast" | "lunch" | "snack" | "dinner";
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  status: "eaten" | "pending" | "skipped";
  region?: string;
  cookTime?: string;
}

/** Today's meals for the Patient Dashboard "Today" tab — varied statuses so
 * the progress bar, calorie summary and upcoming-meals list all have something
 * to show. */
export const PREVIEW_TODAY_MEALS: PreviewMeal[] = [
  {
    id: "preview_meal_1",
    name: "Moong Dal Cheela with Mint Chutney",
    type: "breakfast",
    time: "8:00 AM",
    calories: 320,
    protein: 16,
    carbs: 42,
    fat: 9,
    status: "eaten",
    region: "Indian",
    cookTime: "20",
  },
  {
    id: "preview_meal_2",
    name: "Ginger-Tulsi Tea with Soaked Almonds",
    type: "snack",
    time: "10:30 AM",
    calories: 110,
    protein: 4,
    carbs: 9,
    fat: 7,
    status: "eaten",
    region: "Indian",
    cookTime: "10",
  },
  {
    id: "preview_meal_3",
    name: "Khichdi with Ghee and Steamed Vegetables",
    type: "lunch",
    time: "12:30 PM",
    calories: 480,
    protein: 18,
    carbs: 66,
    fat: 14,
    status: "pending",
    region: "Indian",
    cookTime: "35",
  },
  {
    id: "preview_meal_4",
    name: "Roasted Makhana with Rock Salt",
    type: "snack",
    time: "4:00 PM",
    calories: 140,
    protein: 5,
    carbs: 18,
    fat: 6,
    status: "pending",
    region: "Indian",
    cookTime: "15",
  },
  {
    id: "preview_meal_5",
    name: "Palak Dal with Jeera Rice",
    type: "dinner",
    time: "7:30 PM",
    calories: 420,
    protein: 17,
    carbs: 58,
    fat: 11,
    status: "skipped",
    region: "Indian",
    cookTime: "30",
  },
];

/** A doctor-assigned diet plan summary, in the same `days[]` shape the real
 * loader expects from `diet_plans.meals.days`. */
export const PREVIEW_DIET_PLAN_DOC = {
  id: "preview-plan-1",
  patientName: "Priya Sharma",
  planDuration: "Weekly",
  planType: "personalized-diet-chart",
  source: "personalized-diet-chart",
  createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  totalMeals: PREVIEW_TODAY_MEALS.length,
  activeFilter: "Daily",
  meals: {},
  days: [
    {
      dayLabel: new Date().toLocaleDateString("en-US", { weekday: "long" }),
      meals: PREVIEW_TODAY_MEALS.map((m) => ({
        mealType: m.type,
        recipeName: m.name,
        time: m.time,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        region: m.region,
        cookTime: m.cookTime,
      })),
    },
  ],
};

export const PREVIEW_ALL_PLANS = [PREVIEW_DIET_PLAN_DOC];

export const PREVIEW_PROFILE = {
  name: "Priya Sharma",
  lifeStage: "pregnancy",
  pregnancyTrimester: "2",
  dietaryPreferences: "ovo_lacto_vegetarian",
  allergies: ["peanuts"],
  healthGoals: ["Balanced Vata-Pitta diet", "Healthy weight gain"],
  currentConditions: [],
  isBreastfeeding: undefined,
  menopauseStage: undefined,
};

/* ----------------------------- Meal Logging: history ----------------------------- */

export interface PreviewMealLogDay {
  dateLabel: string;
  meals: {
    id: string;
    type: "breakfast" | "lunch" | "snack" | "dinner";
    name: string;
    time: string;
    calories: number;
    status: "eaten" | "skipped" | "pending";
    preparation?: string;
    benefits?: string;
    doshaBalance?: string;
    quantity?: string;
  }[];
}

/** Today's meals in the Meal Logging shape, plus a short history for the last
 * few days so the page reads as lived-in rather than freshly created. */
export const PREVIEW_MEAL_LOGGING_TODAY: PreviewMealLogDay["meals"] = [
  {
    id: "1",
    type: "breakfast",
    name: "Moong Dal Cheela with Mint Chutney",
    time: "08:00 AM",
    calories: 320,
    status: "eaten",
    preparation: "Soak split moong dal overnight, blend with ginger and cumin, cook on a hot tawa with a little ghee.",
    benefits: "16g protein, 9g fat, 42g carbs — light on digestion, good for morning nausea.",
    doshaBalance: "Vata Balancing",
    quantity: "2 cheelas",
  },
  {
    id: "2",
    type: "snack",
    name: "Ginger-Tulsi Tea with Soaked Almonds",
    time: "10:30 AM",
    calories: 110,
    status: "eaten",
    preparation: "Boil fresh ginger and tulsi leaves in water for 5 minutes; serve with 5 soaked almonds.",
    benefits: "Settles the stomach and supports digestion.",
    doshaBalance: "Tridoshic",
    quantity: "1 cup + 5 almonds",
  },
  {
    id: "3",
    type: "lunch",
    name: "Khichdi with Ghee and Steamed Vegetables",
    time: "12:30 PM",
    calories: 480,
    status: "pending",
    preparation: "Cook rice and moong dal together with turmeric; top with a spoon of ghee and steamed seasonal vegetables.",
    benefits: "18g protein, 14g fat, 66g carbs — easy to digest, warming and grounding.",
    doshaBalance: "Vata Balancing",
    quantity: "1 bowl",
  },
  {
    id: "4",
    type: "snack",
    name: "Roasted Makhana with Rock Salt",
    time: "04:00 PM",
    calories: 140,
    status: "pending",
    preparation: "Dry roast fox nuts in a pan with a touch of ghee and rock salt until crisp.",
    benefits: "Light snack, good calcium source for pregnancy.",
    doshaBalance: "Kapha Balancing",
    quantity: "1 cup",
  },
  {
    id: "5",
    type: "dinner",
    name: "Palak Dal with Jeera Rice",
    time: "07:30 PM",
    calories: 420,
    status: "skipped",
    preparation: "Cook toor dal with fresh spinach and cumin-mustard tempering; serve with jeera-flavoured rice.",
    benefits: "17g protein, iron-rich from spinach — supports pregnancy nutrition.",
    doshaBalance: "Pitta Balancing",
    quantity: "1 bowl + 1 cup rice",
  },
];

export const PREVIEW_SAVED_DIET_PLAN = {
  id: "preview-plan-1",
  patientName: "Priya Sharma",
  planDuration: "Weekly",
  planType: "personalized-diet-chart",
  meals: {},
  totalMeals: PREVIEW_MEAL_LOGGING_TODAY.length,
  activeFilter: "Daily",
  createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
};

/* ----------------------------- Community ----------------------------- */

import type {
  CommunityGroup,
  CommunityMembership,
  CommunityMessage,
} from "@/types/community";
import type { CommunityOverview } from "@/services/communityService";

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();

export const PREVIEW_COMMUNITY_GROUPS: CommunityGroup[] = [
  {
    id: "preview-group-pregnancy",
    slug: "second-trimester",
    name: "Second Trimester Circle",
    description: "Women in weeks 14–27, comparing notes on nausea, cravings and check-ups.",
    whoItsFor: "For anyone currently in their second trimester.",
    matches: ["pregnancy"],
    memberCount: 214,
  },
  {
    id: "preview-group-pcos",
    slug: "pcos-support",
    name: "PCOS Support Circle",
    description: "Cycle tracking, skin, and food swaps that actually helped.",
    whoItsFor: "For anyone managing PCOS/PCOD.",
    matches: ["pcos"],
    memberCount: 178,
  },
  {
    id: "preview-group-newmoms",
    slug: "new-mothers",
    name: "New Mothers Circle",
    description: "Postpartum recovery, breastfeeding nutrition and sleep survival tips.",
    whoItsFor: "For mothers in their first year postpartum.",
    matches: ["postpartum"],
    memberCount: 132,
  },
];

export const PREVIEW_COMMUNITY_MEMBERSHIPS: CommunityMembership[] = [
  {
    id: "preview-membership-1",
    groupId: "preview-group-pregnancy",
    patientId: "preview-patient",
    displayName: "Priya S.",
    intro: "22 weeks with my first, looking for people at the same stage.",
    status: "approved",
    requestedAt: daysAgo(10),
    decidedAt: daysAgo(10),
  },
];

export const PREVIEW_COMMUNITY_MESSAGES: CommunityMessage[] = [
  {
    id: "preview-msg-1",
    groupId: "preview-group-pregnancy",
    authorId: "preview-other-1",
    authorName: "Ananya R.",
    body: "Found this ginger-tulsi tea recipe helps with morning nausea — steep fresh ginger and a few tulsi leaves for 5 minutes, sip slowly. Saved me most mornings this week.",
    createdAt: hoursAgo(20),
  },
  {
    id: "preview-msg-2",
    groupId: "preview-group-pregnancy",
    authorId: "preview-other-2",
    authorName: "Meera K.",
    body: "Anyone else craving sour foods constantly? My doctor said a little amla or lemon in warm water first thing helps settle it.",
    createdAt: hoursAgo(14),
  },
  {
    id: "preview-msg-3",
    groupId: "preview-group-pregnancy",
    authorId: "preview-patient",
    authorName: "Priya S.",
    body: "Yes! Amla candy has become my go-to. Also switched to smaller, more frequent meals — khichdi with ghee has been so easy on my stomach.",
    createdAt: hoursAgo(9),
  },
  {
    id: "preview-msg-4",
    groupId: "preview-group-pregnancy",
    authorId: "preview-other-3",
    authorName: "Fatima A.",
    body: "Just had my 24-week check-up, all good! Doctor mentioned soaked almonds + walnuts in the morning for the baby's brain development. Anyone else doing this?",
    createdAt: hoursAgo(2),
  },
];

export const PREVIEW_COMMUNITY_OVERVIEW: CommunityOverview = {
  groups: PREVIEW_COMMUNITY_GROUPS,
  memberships: PREVIEW_COMMUNITY_MEMBERSHIPS,
  pendingRequests: [],
  matchKeys: ["pregnancy"],
  accountName: "Priya Sharma",
};

/* ----------------------------- Pantry ----------------------------- */

import type { PantryItem } from "@/services/pantryService";

const pantryItem = (
  id: string,
  foodName: string,
  category: string,
  availability: "at_home" | "to_buy",
  quantity: string,
  notes = ""
): PantryItem => ({
  id,
  patientId: "preview-patient",
  foodName,
  searchTerm: foodName.toLowerCase(),
  category,
  quantity,
  availability,
  notes,
  createdAt: daysAgo(3),
  updatedAt: daysAgo(1),
});

export const PREVIEW_PANTRY_ITEMS: PantryItem[] = [
  pantryItem("preview-pantry-1", "Turmeric powder", "Spices", "at_home", "200 g"),
  pantryItem("preview-pantry-2", "Ghee", "Dairy", "at_home", "500 ml", "Homemade, from cow's milk"),
  pantryItem("preview-pantry-3", "Moong dal", "Grains & Pulses", "at_home", "1 kg"),
  pantryItem("preview-pantry-4", "Cumin seeds", "Spices", "at_home", "100 g"),
  pantryItem("preview-pantry-5", "Fresh ginger", "Vegetables", "at_home", "250 g"),
  pantryItem("preview-pantry-6", "Spinach", "Vegetables", "at_home", "1 bunch"),
  pantryItem("preview-pantry-7", "Basmati rice", "Grains & Pulses", "at_home", "2 kg"),
  pantryItem("preview-pantry-8", "Almonds", "Nuts & Seeds", "at_home", "250 g"),
  pantryItem("preview-pantry-9", "Fox nuts (makhana)", "Snacks", "to_buy", "200 g"),
  pantryItem("preview-pantry-10", "Fresh amla", "Fruits", "to_buy", "500 g", "For morning amla-honey"),
  pantryItem("preview-pantry-11", "Tulsi leaves", "Herbs", "to_buy", "1 bunch"),
  pantryItem("preview-pantry-12", "Coconut oil", "Oils", "to_buy", "500 ml"),
];

/* ----------------------------- Patient Profile ----------------------------- */

/** Dosha balance shown wherever the patient's constitution is summarised —
 * a Vata-Pitta leaning profile, consistent with the pregnancy plan above. */
export const PREVIEW_DOSHA_BALANCE = { vata: 45, pitta: 30, kapha: 25 };

/** Matches the `AssessmentData` shape `PatientProfile.tsx` reads out of
 * `patients.assessment_data` — the fields the questionnaire collects. */
export const PREVIEW_ASSESSMENT_DATA = {
  name: "Priya Sharma",
  dob: "1996-04-12",
  gender: "female",
  location: "Pune, Maharashtra",

  allergies: ["peanuts"],
  allergiesOther: "",
  foodAvoidances: "Avoids raw papaya and sesame seeds during pregnancy",

  dietaryPreferences: "Vegetarian",

  familyHistory: ["diabetes"],
  familyHistoryOther: "",

  bodyFrame: "medium",
  skinType: "combination",
  hairType: "wavy",
  appetitePattern: "variable",
  personalityTraits: ["creative", "energetic-in-bursts"],
  weatherPreference: "warm-dry",

  additionalNotes: "Currently in second trimester (week 22). Prefers home-cooked Ayurvedic meals, mild nausea in mornings that ginger tea has been helping with.",
};

export const PREVIEW_PATIENT_DATA = {
  patientId: "PRK-2024-0142",
  name: "Priya Sharma",
  email: "preview@example.com",
  uid: "preview-patient",
  role: "patient",
  questionnaireCompleted: true,
  createdAt: daysAgo(96),
  profileCompleted: true,
  registrationDate: daysAgo(96),
  status: "active",
  assessmentData: PREVIEW_ASSESSMENT_DATA,
  updatedAt: daysAgo(3),
};
