// src/services/dietChartService.ts
// Personalized diet chart service with medical guidelines, dosha integration,
// and FoodOScope API recipe fetching

import {
  getRecipesByDiet,
  getRecipesByCalories,
  getRecipesByIngredientsCategoriesTitle,
  getRecipesByRegionAndDiet,
  searchRecipeById,
  getInstructionsByRecipeId,
  getIngredientsByFlavor,
  RecipeBasic,
} from "./foodoscopeApi";

// --- Medical Guidelines by Life Stage ---

export interface NutritionalTargets {
  calories: { min: number; max: number; label: string };
  protein: { min: number; max: number; unit: string };
  iron: { min: number; unit: string };
  calcium: { min: number; unit: string };
  folate: { min: number; unit: string };
  vitaminD: { min: number; unit: string };
  fiber: { min: number; unit: string };
  omega3: { min: number; unit: string };
  notes: string[];
  avoidIngredients: string[];
  focusIngredients: string[];
  focusCategories: string[];
}

export type LifeStage =
  | "not_applicable"
  | "pregnancy"
  | "postpartum"
  | "menopause"
  // Not a life stage in the strict sense, but it enters the generator the same
  // way the others do: a standing condition that decides the calorie band, the
  // macro split and the ingredient focus for every meal in the plan.
  | "pcos";

export interface PatientProfile {
  name: string;
  gender: string;
  dob: string;
  lifeStage: LifeStage;
  pregnancyTrimester?: string;
  isBreastfeeding?: string;
  menopauseStage?: string;
  allergies: string[];
  allergiesOther?: string;
  foodAvoidances?: string;
  dietaryPreferences: string;
  currentConditions: string[];
  healthGoals: string[];
  bodyFrame: string;
  skinType: string;
  hairType: string;
  appetitePattern: string;
  personalityTraits: string[];
  weatherPreference: string;
  digestionIssues: string[];
  energyLevels: number;
  stressLevels: number;
  physicalActivity: string;
  sleepDuration: string;
}

// --- Dosha Determination (from ayurnutrigenomics) ---

export function determinePrimaryDosha(data: PatientProfile): {
  primary: string;
  scores: { vata: number; pitta: number; kapha: number };
} {
  const scores = { vata: 0, pitta: 0, kapha: 0 };

  if (data.bodyFrame === "thin") scores.vata += 3;
  else if (data.bodyFrame === "medium") scores.pitta += 3;
  else if (data.bodyFrame === "large") scores.kapha += 3;

  if (data.skinType === "dry") scores.vata += 2;
  else if (data.skinType === "oily") scores.pitta += 2;
  else if (data.skinType === "normal") scores.kapha += 2;

  if (data.hairType === "dry") scores.vata += 2;
  else if (data.hairType === "fine") scores.pitta += 2;
  else if (data.hairType === "thick") scores.kapha += 2;

  if (data.appetitePattern === "variable") scores.vata += 2;
  else if (data.appetitePattern === "strong") scores.pitta += 2;
  else if (data.appetitePattern === "slow") scores.kapha += 2;

  if (data.physicalActivity === "sedentary") scores.kapha += 1;
  else if (data.physicalActivity === "active") scores.pitta += 1;

  if (data.energyLevels <= 2) scores.vata += 1;
  else if (data.energyLevels >= 4) scores.pitta += 1;

  if (data.personalityTraits) {
    if (
      data.personalityTraits.includes("creative") ||
      data.personalityTraits.includes("anxious")
    )
      scores.vata += 1;
    if (
      data.personalityTraits.includes("ambitious") ||
      data.personalityTraits.includes("focused")
    )
      scores.pitta += 1;
    if (
      data.personalityTraits.includes("calm") ||
      data.personalityTraits.includes("steady")
    )
      scores.kapha += 1;
  }

  if (data.weatherPreference === "warm") scores.vata += 1;
  else if (data.weatherPreference === "cool") scores.pitta += 1;

  if (data.digestionIssues) {
    if (
      data.digestionIssues.includes("gas") ||
      data.digestionIssues.includes("constipation")
    )
      scores.vata += 2;
    if (data.digestionIssues.includes("acidity")) scores.pitta += 2;
    if (data.digestionIssues.includes("bloating")) scores.kapha += 1;
  }

  const primary = (Object.keys(scores) as Array<keyof typeof scores>).reduce(
    (a, b) => (scores[a] > scores[b] ? a : b)
  );

  return { primary, scores };
}

// --- Medical Nutritional Guidelines ---

export function getNutritionalTargets(
  lifeStage: LifeStage,
  pregnancyTrimester?: string,
  isBreastfeeding?: string,
  menopauseStage?: string
): NutritionalTargets {
  // Base adult female targets
  const base: NutritionalTargets = {
    calories: { min: 1800, max: 2200, label: "General Adult" },
    protein: { min: 46, max: 56, unit: "g/day" },
    iron: { min: 18, unit: "mg/day" },
    calcium: { min: 1000, unit: "mg/day" },
    folate: { min: 400, unit: "mcg/day" },
    vitaminD: { min: 600, unit: "IU/day" },
    fiber: { min: 25, unit: "g/day" },
    omega3: { min: 1.1, unit: "g/day" },
    notes: [],
    avoidIngredients: [],
    focusIngredients: [],
    focusCategories: [],
  };

  switch (lifeStage) {
    case "pregnancy": {
      // ACOG Guidelines
      const extraCal =
        pregnancyTrimester === "first"
          ? 0
          : pregnancyTrimester === "second"
          ? 340
          : 450;
      return {
        calories: {
          min: 1800 + extraCal,
          max: 2400 + extraCal,
          label: `Pregnancy (${
            pregnancyTrimester === "first"
              ? "1st"
              : pregnancyTrimester === "second"
              ? "2nd"
              : "3rd"
          } Trimester)`,
        },
        protein: { min: 71, max: 100, unit: "g/day" },
        iron: { min: 27, unit: "mg/day" },
        calcium: { min: 1000, unit: "mg/day" },
        folate: { min: 600, unit: "mcg/day" },
        vitaminD: { min: 600, unit: "IU/day" },
        fiber: { min: 28, unit: "g/day" },
        omega3: { min: 1.4, unit: "g/day (DHA 200-300mg)" },
        notes: [
          "Increase protein-rich foods: lentils, beans, dairy, lean meats",
          "Iron-rich foods: spinach, fortified cereals, legumes, dried fruits",
          "Folate sources: leafy greens, citrus, beans, fortified grains",
          "Calcium: dairy, fortified plant milk, sesame seeds, almonds",
          "DHA/Omega-3: walnuts, flaxseeds, chia seeds",
          "Small frequent meals to manage nausea",
          "Stay well hydrated (8-12 cups water/day)",
        ],
        avoidIngredients: [
          "alcohol",
          "raw fish",
          "raw egg",
          "liver",
          "unpasteurized",
          "high mercury fish",
          "swordfish",
          "shark",
          "mackerel",
          "raw sprouts",
          "deli meat",
        ],
        focusIngredients: [
          "spinach",
          "lentil",
          "bean",
          "chickpea",
          "yogurt",
          "milk",
          "almond",
          "walnut",
          "oat",
          "sweet potato",
          "broccoli",
          "egg",
          "quinoa",
          "banana",
          "avocado",
        ],
        focusCategories: [
          "Vegetable",
          "Legume",
          "Cereal",
          "Dairy",
          "Nut",
          "Fruit",
        ],
      };
    }

    case "postpartum": {
      // WHO Postpartum & Breastfeeding Guidelines
      const bfExtra = isBreastfeeding === "yes" ? 500 : 200;
      return {
        calories: {
          min: 1800 + bfExtra,
          max: 2400 + bfExtra,
          label: `Postpartum${
            isBreastfeeding === "yes" ? " (Breastfeeding)" : ""
          }`,
        },
        protein: { min: 71, max: 100, unit: "g/day" },
        iron: { min: 9, unit: "mg/day (replenishing)" },
        calcium: { min: 1000, unit: "mg/day" },
        folate: { min: 500, unit: "mcg/day" },
        vitaminD: { min: 600, unit: "IU/day" },
        fiber: { min: 25, unit: "g/day" },
        omega3: { min: 1.3, unit: "g/day (DHA 200mg)" },
        notes: [
          "Focus on recovery: iron-rich foods to replenish blood stores",
          isBreastfeeding === "yes"
            ? "Extra 500 kcal/day for breastfeeding"
            : "Gradual calorie normalization",
          "Galactagogues: oats, fenugreek, moringa, garlic, fennel seeds",
          "Anti-inflammatory foods: turmeric, ginger, berries",
          "Adequate hydration: 12+ cups water/day if breastfeeding",
          "Include bone broth, warm soups for healing",
          "Calcium-rich foods: dairy, sesame, leafy greens",
        ],
        avoidIngredients:
          isBreastfeeding === "yes"
            ? [
                "alcohol",
                "excessive caffeine",
                "high mercury fish",
                "peppermint",
                "sage",
              ]
            : ["alcohol"],
        focusIngredients: [
          "oat",
          "fenugreek",
          "garlic",
          "ginger",
          "turmeric",
          "spinach",
          "lentil",
          "almond",
          "sesame",
          "date",
          "fennel",
          "carrot",
          "sweet potato",
          "egg",
          "yogurt",
        ],
        focusCategories: [
          "Vegetable",
          "Legume",
          "Cereal",
          "Dairy",
          "Spice",
          "Herb",
        ],
      };
    }

    case "pcos": {
      // PCOS nutrition guidance (Rotterdam / international evidence-based
      // guideline for PCOS). The condition runs on insulin resistance, so the
      // shape of the plan matters more than the calorie count: a modest
      // deficit, a low glycaemic load, protein and fibre at every meal, and
      // enough iron to cover heavy or frequent bleeding.
      //
      // The band below is a *starting* point for a sedentary adult. The
      // cycle, weight and activity logs adjust it per patient — see
      // `src/lib/pcosInsights.ts`.
      return {
        calories: { min: 1600, max: 1900, label: "PCOD / PCOS" },
        protein: { min: 60, max: 90, unit: "g/day (1.2-1.5g/kg)" },
        // Frequent or heavy bleeding is the norm rather than the exception
        // here, so iron stays at the menstruating-adult level rather than
        // dropping to the general one.
        iron: { min: 18, unit: "mg/day" },
        calcium: { min: 1000, unit: "mg/day" },
        folate: { min: 400, unit: "mcg/day" },
        vitaminD: { min: 800, unit: "IU/day" },
        // Fibre is the lever, not an afterthought: it is what flattens the
        // glucose curve that everything else here is trying to flatten.
        fiber: { min: 30, unit: "g/day" },
        omega3: { min: 1.5, unit: "g/day" },
        notes: [
          "Low glycaemic index carbohydrates: millets, barley, whole dals, steel-cut oats — not white rice, maida or sugary drinks",
          "Protein and fibre at every meal; never eat a carbohydrate on its own",
          "30g+ fibre daily — vegetables, whole pulses, fruit with the skin on",
          "Anti-inflammatory fats: flaxseed, chia, walnuts, olive oil",
          "Iron with vitamin C (lemon on greens, amla, citrus) if periods are heavy or frequent",
          "Vitamin D and magnesium both improve insulin sensitivity — sunlight, nuts, seeds, leafy greens",
          "Spread food across regular meals; long fasts followed by large meals worsen insulin swings",
          "Limit refined sugar, fried food and processed carbohydrate — the biggest single change for PCOS",
        ],
        avoidIngredients: [
          "sugar",
          "refined flour",
          "white bread",
          "white rice",
          "maida",
          "fried",
          "sweetened beverage",
          "corn syrup",
          "processed meat",
          "excessive caffeine",
          "alcohol",
        ],
        focusIngredients: [
          "millet",
          "barley",
          "oat",
          "quinoa",
          "lentil",
          "chickpea",
          "rajma",
          "spinach",
          "broccoli",
          "flaxseed",
          "chia",
          "walnut",
          "almond",
          "pumpkin seed",
          "fenugreek",
          "cinnamon",
          "turmeric",
          "berry",
          "guava",
          "yogurt",
          "paneer",
          "egg",
          "green tea",
        ],
        focusCategories: ["Vegetable", "Legume", "Cereal", "Nut", "Fruit", "Spice"],
      };
    }

    case "menopause": {
      // Menopause Nutrition Guidelines (NAMS/Endocrine Society)
      return {
        calories: {
          min: 1600,
          max: 2000,
          label: `Menopause${
            menopauseStage ? ` (${menopauseStage})` : ""
          }`,
        },
        protein: { min: 50, max: 75, unit: "g/day (1.0-1.2g/kg)" },
        iron: { min: 8, unit: "mg/day" },
        calcium: { min: 1200, unit: "mg/day" },
        folate: { min: 400, unit: "mcg/day" },
        vitaminD: { min: 800, unit: "IU/day" },
        fiber: { min: 25, unit: "g/day" },
        omega3: { min: 1.5, unit: "g/day" },
        notes: [
          "Calcium: 1200mg/day for bone health — dairy, fortified foods, leafy greens",
          "Vitamin D: 800-1000 IU/day — sunlight, fortified foods, fatty fish",
          "Phytoestrogens: soy, flaxseeds, sesame, whole grains",
          "Omega-3: walnuts, flaxseeds, chia, fatty fish for heart health",
          "High fiber: whole grains, vegetables, fruits for digestive health",
          "Limit sodium to <2300mg/day for blood pressure",
          "Adequate protein: prevents muscle & bone loss",
          "Antioxidant-rich foods: berries, green tea, dark leafy greens",
          "Reduce refined sugars and processed foods",
        ],
        avoidIngredients: [
          "excessive sugar",
          "excessive salt",
          "excessive caffeine",
          "alcohol",
          "processed meat",
        ],
        focusIngredients: [
          "soy",
          "flaxseed",
          "sesame",
          "walnut",
          "almond",
          "broccoli",
          "kale",
          "spinach",
          "yogurt",
          "milk",
          "tofu",
          "oat",
          "quinoa",
          "berry",
          "salmon",
          "sardine",
          "turmeric",
          "green tea",
        ],
        focusCategories: [
          "Vegetable",
          "Legume",
          "Nut",
          "Dairy",
          "Cereal",
          "Fruit",
        ],
      };
    }

    default:
      return base;
  }
}

// --- Dosha-specific food preferences ---

export const DOSHA_FOOD_PREFERENCES: Record<
  string,
  {
    favorableCategories: string[];
    favorableIngredients: string[];
    avoidIngredients: string[];
    spices: string[];
    cookingMethods: string[];
    description: string;
  }
> = {
  vata: {
    favorableCategories: ["Cereal", "Dairy", "Nut", "Vegetable-Root", "Fruit"],
    favorableIngredients: [
      "rice",
      "quinoa",
      "sweet potato",
      "carrot",
      "beet",
      "avocado",
      "banana",
      "date",
      "almond",
      "walnut",
      "milk",
      "ghee",
      "sesame",
      "mung",
      "ginger",
    ],
    avoidIngredients: [
      "raw salad",
      "carbonated",
      "dried fruit",
      "corn",
      "raw broccoli",
    ],
    spices: ["ginger", "cinnamon", "cardamom", "cumin", "fennel", "asafoetida"],
    cookingMethods: ["steaming", "sautéing with ghee", "slow cooking"],
    description:
      "Warm, moist, grounding foods. Avoid cold, dry, raw foods.",
  },
  pitta: {
    favorableCategories: [
      "Cereal",
      "Vegetable-Fruit",
      "Fruit",
      "Dairy",
      "Vegetable-Root",
    ],
    favorableIngredients: [
      "rice",
      "barley",
      "cucumber",
      "spinach",
      "zucchini",
      "apple",
      "pear",
      "coconut",
      "sunflower seed",
      "milk",
      "coconut oil",
      "chickpea",
      "mint",
    ],
    avoidIngredients: [
      "chili",
      "hot pepper",
      "vinegar",
      "tomato",
      "fried",
      "citrus",
      "fermented",
    ],
    spices: ["coriander", "fennel", "mint", "coconut", "cardamom", "turmeric"],
    cookingMethods: ["steaming", "light sautéing", "cooling preparations"],
    description:
      "Cool, sweet, and bitter foods. Avoid spicy, sour, fried foods.",
  },
  kapha: {
    favorableCategories: [
      "Vegetable-Bulb",
      "Vegetable-Root",
      "Legume",
      "Spice",
      "Fruit",
    ],
    favorableIngredients: [
      "millet",
      "buckwheat",
      "broccoli",
      "cauliflower",
      "spinach",
      "apple",
      "berry",
      "pomegranate",
      "pumpkin seed",
      "mustard oil",
      "black bean",
      "lentil",
      "honey",
    ],
    avoidIngredients: [
      "heavy cream",
      "butter",
      "cheese",
      "excess sugar",
      "white bread",
      "deep fried",
      "ice cream",
    ],
    spices: [
      "ginger",
      "black pepper",
      "turmeric",
      "mustard seed",
      "fenugreek",
      "cloves",
    ],
    cookingMethods: ["roasting", "grilling", "dry sautéing"],
    description:
      "Light, warm, spicy foods. Avoid heavy, oily, sweet, cold foods.",
  },
};

// --- Allergy to ingredient mapping ---

export const ALLERGY_INGREDIENT_MAP: Record<string, string[]> = {
  dairy: ["milk", "cheese", "cream", "butter", "yogurt", "whey", "casein", "ghee"],
  gluten: ["wheat", "barley", "rye", "bread", "pasta", "flour", "semolina"],
  nuts: ["almond", "walnut", "cashew", "pecan", "pistachio", "hazelnut", "macadamia"],
  peanuts: ["peanut", "groundnut"],
  soy: ["soy", "tofu", "tempeh", "edamame", "soy sauce", "miso"],
  eggs: ["egg", "mayonnaise", "meringue"],
  shellfish: ["shrimp", "crab", "lobster", "prawn", "mussel", "oyster", "clam"],
  fish: ["salmon", "tuna", "cod", "sardine", "anchovy", "mackerel", "tilapia"],
};

// --- Build exclude ingredients list from patient profile ---

export function buildExcludeIngredients(profile: PatientProfile): string[] {
  const excludes: string[] = [];

  // From allergies
  if (profile.allergies && !profile.allergies.includes("none")) {
    for (const allergy of profile.allergies) {
      const mapped = ALLERGY_INGREDIENT_MAP[allergy];
      if (mapped) excludes.push(...mapped);
    }
  }

  // From allergiesOther
  if (profile.allergiesOther) {
    excludes.push(
      ...profile.allergiesOther
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
  }

  // From food avoidances
  if (profile.foodAvoidances) {
    excludes.push(
      ...profile.foodAvoidances
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
  }

  // From life stage medical guidelines
  const targets = getNutritionalTargets(
    profile.lifeStage as LifeStage,
    profile.pregnancyTrimester,
    profile.isBreastfeeding,
    profile.menopauseStage
  );
  excludes.push(...targets.avoidIngredients);

  // From dosha
  const { primary } = determinePrimaryDosha(profile);
  const doshaPrefs = DOSHA_FOOD_PREFERENCES[primary];
  if (doshaPrefs) {
    excludes.push(...doshaPrefs.avoidIngredients);
  }

  return [...new Set(excludes)];
}

// --- Build include ingredients list from patient profile ---

export function buildIncludeIngredients(profile: PatientProfile): string[] {
  const includes: string[] = [];

  // From life stage guidelines
  const targets = getNutritionalTargets(
    profile.lifeStage as LifeStage,
    profile.pregnancyTrimester,
    profile.isBreastfeeding,
    profile.menopauseStage
  );
  includes.push(...targets.focusIngredients);

  // From dosha
  const { primary } = determinePrimaryDosha(profile);
  const doshaPrefs = DOSHA_FOOD_PREFERENCES[primary];
  if (doshaPrefs) {
    includes.push(...doshaPrefs.favorableIngredients);
  }

  // Remove any that are also in the exclude list
  const excludes = new Set(buildExcludeIngredients(profile));
  return [...new Set(includes)].filter((i) => !excludes.has(i));
}

// --- Map dietary preference to API diet parameter ---

export function mapDietaryPreference(
  pref: string
): string | null {
  switch (pref) {
    case "vegan":
      return "vegan";
    case "vegetarian":
      return "lacto_vegetarian";
    default:
      return null;
  }
}

// --- Meal type targets as fraction of daily calories ---

export interface MealTargets {
  mealType: string;
  label: string;
  time: string;
  caloriePercent: number;
}

export const MEAL_STRUCTURE: MealTargets[] = [
  {
    mealType: "breakfast",
    label: "Breakfast",
    time: "7:30 AM",
    caloriePercent: 0.25,
  },
  {
    mealType: "mid_morning",
    label: "Mid-Morning Snack",
    time: "10:30 AM",
    caloriePercent: 0.1,
  },
  { mealType: "lunch", label: "Lunch", time: "12:30 PM", caloriePercent: 0.3 },
  {
    mealType: "afternoon_snack",
    label: "Afternoon Snack",
    time: "4:00 PM",
    caloriePercent: 0.1,
  },
  {
    mealType: "dinner",
    label: "Dinner",
    time: "7:30 PM",
    caloriePercent: 0.25,
  },
];

// --- Rate limit helper ---

const RATE_LIMIT_DELAY = 3500; // ms between API calls to avoid 429

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 5000
): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (retries > 0 && message.includes("429")) {
      console.log(`Rate limited, waiting ${delayMs}ms before retry (${retries} left)...`);
      await delay(delayMs);
      return fetchWithRetry(fn, retries - 1, delayMs * 2);
    }
    throw err;
  }
}

// --- Estimate macros from calories when API doesn't return them ---

function ensureMacros(recipe: RecipeBasic): RecipeBasic {
  const cal = Number(recipe.Calories || recipe["Energy (kcal)"] || 0);
  const hasProtein = recipe["Protein (g)"] && Number(recipe["Protein (g)"]) > 0;
  const hasCarbs = recipe["Carbohydrate, by difference (g)"] && Number(recipe["Carbohydrate, by difference (g)"]) > 0;
  const hasFat = recipe["Total lipid (fat) (g)"] && Number(recipe["Total lipid (fat) (g)"]) > 0;

  if (!hasProtein && !hasCarbs && !hasFat && cal > 0) {
    // Standard macro distribution: 20% protein, 50% carbs, 30% fat
    return {
      ...recipe,
      "Protein (g)": String(Math.round((cal * 0.20 / 4) * 10) / 10),
      "Carbohydrate, by difference (g)": String(Math.round((cal * 0.50 / 4) * 10) / 10),
      "Total lipid (fat) (g)": String(Math.round((cal * 0.30 / 9) * 10) / 10),
    };
  }

  return recipe;
}

// --- Fetch recipes for a single meal slot ---

export async function fetchRecipesForMeal(
  mealTargets: MealTargets,
  dailyCalories: number,
  dietPref: string | null,
  excludeIngredients: string[],
  includeIngredients: string[],
  focusCategories: string[]
): Promise<RecipeBasic[]> {
  const targetCal = dailyCalories * mealTargets.caloriePercent;
  const minCal = Math.max(0, targetCal - 150);
  const maxCal = targetCal + 200;

  try {
    // Strategy: use ingredient/category filtering for best personalization
    if (includeIngredients.length > 0 || excludeIngredients.length > 0) {
      // Pick 2-3 random include ingredients to search
      const shuffled = [...includeIngredients].sort(
        () => 0.5 - Math.random()
      );
      const searchIncludes = shuffled.slice(0, 3).join(",");
      const searchExcludes = excludeIngredients.slice(0, 5).join(",");
      const searchCategories = focusCategories.slice(0, 3).join(",");

      const results = await fetchWithRetry(() =>
        getRecipesByIngredientsCategoriesTitle({
          includeIngredients: searchIncludes || undefined,
          excludeIngredients: searchExcludes || undefined,
          includeCategories: searchCategories || undefined,
          page: Math.floor(Math.random() * 5) + 1,
          limit: 20,
        })
      );

      if (results && results.length > 0) {
        // Filter by calorie range client-side
        const filtered = results.filter((r) => {
          const cal = Number(r.Calories || r["Energy"] || 0);
          return cal >= minCal && cal <= maxCal;
        });
        if (filtered.length > 0) return filtered;
        return results.slice(0, 5); // fallback: return unfiltered
      }
    }

    // Fallback: use diet filter + calorie range
    await delay(RATE_LIMIT_DELAY + 1500);
    if (dietPref) {
      const res = await fetchWithRetry(() =>
        getRecipesByDiet(dietPref, 20, Math.floor(Math.random() * 10) + 1)
      );
      if (res.data && res.data.length > 0) {
        const filtered = res.data.filter((r) => {
          const cal = Number(r.Calories || 0);
          return cal >= minCal && cal <= maxCal;
        });
        if (filtered.length > 0) return filtered;
        return res.data.slice(0, 5);
      }
    }

    // Last fallback: just calorie range
    await delay(RATE_LIMIT_DELAY + 1500);
    const res = await fetchWithRetry(() =>
      getRecipesByCalories(minCal, maxCal, 10)
    );
    return res.data || [];
  } catch (err) {
    console.error(
      `Error fetching recipes for ${mealTargets.label}:`,
      err
    );
    return [];
  }
}

// --- Generate complete personalized diet chart ---

export interface DietChartMeal {
  mealType: string;
  label: string;
  time: string;
  recipe: RecipeBasic;
  targetCalories: number;
  actualCalories: number;
}

export interface DietChartDay {
  dayNumber: number;
  dayLabel: string;
  meals: DietChartMeal[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface GeneratedDietChart {
  patientName: string;
  primaryDosha: string;
  doshaScores: { vata: number; pitta: number; kapha: number };
  lifeStage: string;
  lifeStageLabel: string;
  nutritionalTargets: NutritionalTargets;
  days: DietChartDay[];
  doshaRecommendations: {
    description: string;
    spices: string[];
    cookingMethods: string[];
    avoidFoods: string[];
  };
  medicalNotes: string[];
  excludedIngredients: string[];
  generatedAt: string;
  /** Which generator produced this chart. */
  source: "gemini" | "foodoscope";
  /** How the disease screening results shaped the plan (Gemini only). */
  clinicalFocus?: string[];
  /** Ingredients the plan needs that aren't in the patient's kitchen yet. */
  pantryGaps?: string[];
  /** Meals dropped because they named an excluded ingredient. */
  rejectedMeals?: string[];
  /** A short read of the plan for the doctor (Gemini only). */
  summary?: string;
}

/**
 * Per-patient tuning applied on top of the life-stage targets.
 *
 * The life-stage guidelines are population-level: they know a PCOS patient
 * needs a low-glycaemic plan, but not that *this* patient has gained 4 kg in
 * two months and hasn't had a period since March. The PCOS track derives that
 * from her own logs (`src/lib/pcosInsights.ts`) and passes it in here, which is
 * what stands in for the disease analysis a pregnant patient's plan is built
 * from.
 */
export interface PlanAdjustment {
  /** kcal/day added to (or taken off) the target band. */
  calorieDelta: number;
  /** Ingredients to weight up, on top of the life-stage focus list. */
  focusIngredients: string[];
  /** Ingredients to steer away from, on top of the life-stage avoid list. */
  avoidIngredients: string[];
  /** Notes appended to the plan's medical notes, explaining the tuning. */
  notes: string[];
}

export const emptyPlanAdjustment = (): PlanAdjustment => ({
  calorieDelta: 0,
  focusIngredients: [],
  avoidIngredients: [],
  notes: [],
});

/**
 * The life-stage targets with a patient's own adjustment folded in.
 *
 * Shared by both generation paths — the Gemini one and the FoodOScope
 * fallback — so a PCOS patient's plan is tuned the same way whichever composes
 * it. A chart that quietly dropped her calorie deficit because the backend was
 * unreachable would be the worst kind of fallback.
 */
export function applyPlanAdjustment(
  base: NutritionalTargets,
  adjustment: PlanAdjustment
): NutritionalTargets {
  // A floor of 1200 kcal: below that a plan cannot reliably carry the protein,
  // iron and calcium these guidelines call for, and no adjustment computed
  // from a tracker should be able to push a patient there.
  const adjustedMin = Math.max(1200, base.calories.min + adjustment.calorieDelta);

  return {
    ...base,
    calories: {
      ...base.calories,
      min: adjustedMin,
      max: Math.max(adjustedMin + 200, base.calories.max + adjustment.calorieDelta),
    },
    notes: [...base.notes, ...adjustment.notes],
    focusIngredients: [
      ...new Set([...base.focusIngredients, ...adjustment.focusIngredients]),
    ],
    avoidIngredients: [
      ...new Set([...base.avoidIngredients, ...adjustment.avoidIngredients]),
    ],
  };
}

/**
 * Exclude and focus lists with the adjustment folded in.
 *
 * The adjustment's avoid list wins over its focus list, so a food ruled out for
 * one reason cannot be pulled back in by another.
 */
export function applyIngredientAdjustment(
  profile: PatientProfile,
  adjustment: PlanAdjustment
): { excludeIngredients: string[]; includeIngredients: string[] } {
  const excludeIngredients = [
    ...new Set([...buildExcludeIngredients(profile), ...adjustment.avoidIngredients]),
  ];
  const includeIngredients = [
    ...new Set([...buildIncludeIngredients(profile), ...adjustment.focusIngredients]),
  ].filter((i) => !excludeIngredients.includes(i));

  return { excludeIngredients, includeIngredients };
}

async function generateDietChartFromRecipes(
  profile: PatientProfile,
  numDays: number = 7,
  adjustment: PlanAdjustment = emptyPlanAdjustment()
): Promise<GeneratedDietChart> {
  const dosha = determinePrimaryDosha(profile);
  const baseTargets = getNutritionalTargets(
    profile.lifeStage as LifeStage,
    profile.pregnancyTrimester,
    profile.isBreastfeeding,
    profile.menopauseStage
  );

  const targets = applyPlanAdjustment(baseTargets, adjustment);

  const dietPref = mapDietaryPreference(profile.dietaryPreferences);
  const { excludeIngredients, includeIngredients } = applyIngredientAdjustment(
    profile,
    adjustment
  );
  const doshaPrefs = DOSHA_FOOD_PREFERENCES[dosha.primary] || DOSHA_FOOD_PREFERENCES.vata;

  const dailyCalories = Math.round((targets.calories.min + targets.calories.max) / 2);

  const days: DietChartDay[] = [];
  const dayNames = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  // Fetch a pool of recipes per meal type ONCE, then pick from the pool for each day.
  // This drastically reduces API calls: 5 calls total instead of 5 x numDays.
  const mealRecipePools: Map<string, RecipeBasic[]> = new Map();

  // Initial cooldown to avoid rate limit from any prior API usage
  await delay(2000);

  for (let i = 0; i < MEAL_STRUCTURE.length; i++) {
    const mealSlot = MEAL_STRUCTURE[i];
    // Wait between meal type fetches (skip before the first one)
    if (i > 0) {
      await delay(RATE_LIMIT_DELAY);
    }
    try {
      const candidates = await fetchRecipesForMeal(
        mealSlot,
        dailyCalories,
        dietPref,
        excludeIngredients,
        includeIngredients,
        targets.focusCategories
      );
      mealRecipePools.set(mealSlot.mealType, candidates);
    } catch (err) {
      console.error(`Error fetching recipe pool for ${mealSlot.label}:`, err);
      mealRecipePools.set(mealSlot.mealType, []);
    }
  }

  for (let d = 0; d < numDays; d++) {
    const meals: DietChartMeal[] = [];
    let dayTotalCal = 0;
    let dayTotalProtein = 0;
    let dayTotalCarbs = 0;
    let dayTotalFat = 0;

    for (const mealSlot of MEAL_STRUCTURE) {
      const targetCal = Math.round(dailyCalories * mealSlot.caloriePercent);
      const pool = mealRecipePools.get(mealSlot.mealType) || [];

      if (pool.length > 0) {
        // Pick a random recipe from the pool for variety across days
        const recipe = ensureMacros(pool[Math.floor(Math.random() * pool.length)]);
        const actualCal = Number(recipe.Calories || 0);

        meals.push({
          mealType: mealSlot.mealType,
          label: mealSlot.label,
          time: mealSlot.time,
          recipe,
          targetCalories: targetCal,
          actualCalories: actualCal,
        });

        dayTotalCal += actualCal;
        dayTotalProtein += Number(recipe["Protein (g)"] || recipe["Protein"] || 0);
        dayTotalCarbs += Number(
          recipe["Carbohydrate, by difference (g)"] || recipe["Carbohydrate"] || 0
        );
        dayTotalFat += Number(recipe["Total lipid (fat) (g)"] || recipe["Fat"] || 0);
      }
    }

    days.push({
      dayNumber: d + 1,
      dayLabel: dayNames[d % 7],
      meals,
      totalCalories: Math.round(dayTotalCal),
      totalProtein: Math.round(dayTotalProtein * 10) / 10,
      totalCarbs: Math.round(dayTotalCarbs * 10) / 10,
      totalFat: Math.round(dayTotalFat * 10) / 10,
    });
  }

  const lifeStageLabels: Record<string, string> = {
    not_applicable: "General",
    pregnancy: `Pregnancy${
      profile.pregnancyTrimester
        ? ` (${profile.pregnancyTrimester} trimester)`
        : ""
    }`,
    postpartum: `Postpartum${
      profile.isBreastfeeding === "yes" ? " (Breastfeeding)" : ""
    }`,
    menopause: `Menopause${
      profile.menopauseStage ? ` (${profile.menopauseStage})` : ""
    }`,
    pcos: "PCOD / PCOS",
  };

  return {
    patientName: profile.name,
    primaryDosha: dosha.primary,
    doshaScores: dosha.scores,
    lifeStage: profile.lifeStage,
    lifeStageLabel: lifeStageLabels[profile.lifeStage] || "General",
    nutritionalTargets: targets,
    days,
    doshaRecommendations: {
      description: doshaPrefs.description,
      spices: doshaPrefs.spices,
      cookingMethods: doshaPrefs.cookingMethods,
      avoidFoods: doshaPrefs.avoidIngredients,
    },
    medicalNotes: targets.notes,
    excludedIngredients: excludeIngredients,
    generatedAt: new Date().toISOString(),
    source: "foodoscope",
  };
}

// --- Gemini-backed generation (preferred) ---
//
// The recipe-database path above can only shuffle whatever FoodOScope returns:
// it cannot look at what the patient has in her kitchen, and it cannot react to
// a disease screening. Gemini can do both, so it is tried first and the recipe
// path becomes the fallback for when the backend is down or has no key.
//
// The key itself is server-side (a VITE_ variable ends up in the browser
// bundle), so this posts the context to Flask rather than calling Gemini.

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

/** What the patient has at home and what she already plans to buy. */
export interface PantryContext {
  atHome: { name: string; quantity?: string; category?: string }[];
  toBuy: { name: string; quantity?: string; category?: string }[];
}

/** The disease screening rows the caller already holds for this patient. */
export interface ScreeningContext {
  createdAt: string;
  result: unknown;
}

export interface DietChartContext {
  pantry?: PantryContext;
  screenings?: ScreeningContext[];
  /**
   * Per-patient tuning on top of the life-stage targets.
   *
   * For a pregnant patient the clinical input is `screenings` above. A
   * PCOD/PCOS patient has no screening to run, so this carries the equivalent
   * derived from her own cycle, weight and exercise logs — see
   * `src/lib/pcosInsights.ts`. Applied on both generation paths, so the
   * fallback does not quietly drop it.
   */
  adjustment?: PlanAdjustment;
}

interface AiPlanResponse {
  days: DietChartDay[];
  clinicalFocus?: string[];
  pantryGaps?: string[];
  rejectedMeals?: string[];
  summary?: string;
  dailyCalorieTarget?: number;
}

/** Age in whole years, or null when no usable date of birth is on file. */
function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDelta = now.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/**
 * Ask the backend to compose the chart with Gemini.
 *
 * Deliberately sends no name, email or patient id — the prompt gets clinical and
 * dietary values only, and the caller re-attaches the name to the result.
 */
export async function generateDietChartWithAI(
  profile: PatientProfile,
  numDays: number,
  context: DietChartContext = {}
): Promise<GeneratedDietChart> {
  const dosha = determinePrimaryDosha(profile);
  const baseTargets = getNutritionalTargets(
    profile.lifeStage as LifeStage,
    profile.pregnancyTrimester,
    profile.isBreastfeeding,
    profile.menopauseStage
  );
  const doshaPrefs =
    DOSHA_FOOD_PREFERENCES[dosha.primary] || DOSHA_FOOD_PREFERENCES.vata;
  const adjustment = context.adjustment ?? emptyPlanAdjustment();
  const targets = applyPlanAdjustment(baseTargets, adjustment);
  const { excludeIngredients, includeIngredients } = applyIngredientAdjustment(
    profile,
    adjustment
  );

  const lifeStageLabels: Record<string, string> = {
    not_applicable: "General",
    pregnancy: `Pregnancy${
      profile.pregnancyTrimester ? ` (${profile.pregnancyTrimester} trimester)` : ""
    }`,
    postpartum: `Postpartum${profile.isBreastfeeding === "yes" ? " (Breastfeeding)" : ""}`,
    menopause: `Menopause${profile.menopauseStage ? ` (${profile.menopauseStage})` : ""}`,
    pcos: "PCOD / PCOS",
  };
  const lifeStageLabel = lifeStageLabels[profile.lifeStage] || "General";

  const response = await fetch(`${API_BASE}/diet-chart/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      days: numDays,
      profile: {
        ageYears: ageFromDob(profile.dob),
        lifeStage: profile.lifeStage,
        lifeStageLabel,
        dietaryPreferences: profile.dietaryPreferences,
        healthGoals: profile.healthGoals,
        currentConditions: profile.currentConditions,
        digestionIssues: profile.digestionIssues,
        appetitePattern: profile.appetitePattern,
        physicalActivity: profile.physicalActivity,
        sleepDuration: profile.sleepDuration,
      },
      dosha: {
        primary: dosha.primary,
        scores: dosha.scores,
        description: doshaPrefs.description,
        spices: doshaPrefs.spices,
        cookingMethods: doshaPrefs.cookingMethods,
      },
      targets,
      excludeIngredients,
      focusIngredients: includeIngredients,
      pantry: context.pantry ?? { atHome: [], toBuy: [] },
      screenings: context.screenings ?? [],
      mealStructure: MEAL_STRUCTURE,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: AiPlanResponse;
    error?: string;
  } | null;

  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error ?? `Diet chart generation failed (${response.status})`);
  }

  return {
    patientName: profile.name,
    primaryDosha: dosha.primary,
    doshaScores: dosha.scores,
    lifeStage: profile.lifeStage,
    lifeStageLabel,
    nutritionalTargets: targets,
    days: payload.data.days,
    doshaRecommendations: {
      description: doshaPrefs.description,
      spices: doshaPrefs.spices,
      cookingMethods: doshaPrefs.cookingMethods,
      avoidFoods: doshaPrefs.avoidIngredients,
    },
    medicalNotes: targets.notes,
    excludedIngredients: excludeIngredients,
    generatedAt: new Date().toISOString(),
    source: "gemini",
    clinicalFocus: payload.data.clinicalFocus ?? [],
    pantryGaps: payload.data.pantryGaps ?? [],
    rejectedMeals: payload.data.rejectedMeals ?? [],
    summary: payload.data.summary ?? "",
  };
}

/**
 * The one entry point callers should use.
 *
 * Gemini first — it is the only path that can use the patient's kitchen and her
 * screening results. If the backend is unreachable, has no Gemini key, or every
 * key is exhausted, this falls back to the FoodOScope recipe path so the doctor
 * still gets a chart rather than an error.
 */
export async function generateDietChart(
  profile: PatientProfile,
  numDays: number = 7,
  context: DietChartContext = {}
): Promise<GeneratedDietChart> {
  try {
    return await generateDietChartWithAI(profile, numDays, context);
  } catch (err) {
    console.warn("Gemini diet chart unavailable, falling back to FoodOScope:", err);
    // The adjustment goes with it — a chart that quietly dropped a patient's
    // calorie deficit because the backend was unreachable would be worse than
    // the error it replaced.
    return generateDietChartFromRecipes(profile, numDays, context.adjustment);
  }
}
