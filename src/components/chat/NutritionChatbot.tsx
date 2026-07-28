import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getRecipesByDiet,
  getRecipesByCalories,
  getRecipesByIngredientsCategoriesTitle,
  type RecipeBasic,
} from "@/services/foodoscopeApi";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "bot" | "user";
  text: string;
  options?: QuickOption[];
  recipe?: FormattedRecipe | null;
  timestamp: number;
}

interface QuickOption {
  label: string;
  value: string;
}

interface UserProfile {
  lifeStage: string;
  trimester?: string;
  diet: string;
  allergies: string[];
  mealType: string;
  cookingTime: string;
}

interface FormattedRecipe {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  cookTime: string;
  region: string;
  servings: string;
  recipeId: string;
  safetyNotes: string[];
  substitutions: string[];
  healthTips: string[];
}

type ConversationStep =
  | "idle"
  | "life_stage"
  | "trimester"
  | "diet"
  | "allergies"
  | "meal_type"
  | "cooking_time"
  | "fetching"
  | "done"
  | "free_chat";

const STORAGE_KEY = "nourish_chatbot_history";
const PROFILE_KEY = "nourish_chatbot_profile";

// ──────────────────────────────────────────────
// Medical safety data
// ──────────────────────────────────────────────

const UNSAFE_PREGNANCY_FOODS = [
  "alcohol", "wine", "beer", "spirits", "raw fish", "sushi", "sashimi",
  "raw eggs", "unpasteurized", "soft cheese", "brie", "camembert",
  "deli meat", "liver", "pate", "raw meat", "shark", "swordfish",
  "king mackerel", "tilefish", "raw sprouts",
];

const SAFETY_TIPS: Record<string, string[]> = {
  pregnancy_1: [
    "Folic acid (600mcg/day) is critical in the first trimester for neural tube development.",
    "Avoid raw/undercooked meat, fish, and eggs.",
    "Limit caffeine to under 200mg/day (about 1 cup of coffee).",
    "Stay hydrated — aim for 8-10 glasses of water daily.",
  ],
  pregnancy_2: [
    "Iron needs increase — include lentils, spinach, and fortified cereals.",
    "Calcium (1000mg/day) supports baby's bone development.",
    "Omega-3 fatty acids (DHA) support brain development — try walnuts and flaxseeds.",
    "Avoid alcohol completely.",
  ],
  pregnancy_3: [
    "Increase calorie intake by ~450 kcal/day in the third trimester.",
    "Vitamin K-rich foods (leafy greens) support blood clotting for delivery.",
    "Small, frequent meals help with heartburn and discomfort.",
    "Continue avoiding raw/unpasteurized foods.",
  ],
  postpartum: [
    "Focus on iron-rich foods to recover from blood loss.",
    "Galactagogues like fenugreek, oats, and garlic may support milk production.",
    "Aim for 500 extra calories/day if breastfeeding.",
    "Hydration is crucial — drink water each time you breastfeed.",
  ],
  menopause: [
    "Calcium (1200mg/day) and Vitamin D are critical to prevent osteoporosis.",
    "Phytoestrogens in soy, flaxseeds, and legumes may help with symptoms.",
    "Limit sodium to manage blood pressure changes.",
    "Include magnesium-rich foods for better sleep quality.",
  ],
  general: [
    "A balanced diet with all food groups supports overall health.",
    "Aim for 5+ servings of fruits and vegetables daily.",
    "Stay hydrated with at least 2 liters of water per day.",
    "Whole grains provide sustained energy throughout the day.",
  ],
};

const CALORIE_TARGETS: Record<string, { min: number; max: number }> = {
  pregnancy_1: { min: 300, max: 500 },
  pregnancy_2: { min: 350, max: 550 },
  pregnancy_3: { min: 400, max: 600 },
  postpartum: { min: 400, max: 600 },
  menopause: { min: 250, max: 450 },
  general: { min: 300, max: 500 },
};

const ALLERGY_EXCLUDE_MAP: Record<string, string> = {
  dairy: "milk,cheese,butter,cream,yogurt,paneer,ghee",
  nuts: "almond,cashew,walnut,peanut,pistachio",
  gluten: "wheat,barley,rye,bread,pasta,flour",
  soy: "soybean,tofu,tempeh,soy sauce",
  eggs: "egg",
  shellfish: "shrimp,crab,lobster,prawn",
  fish: "fish,salmon,tuna,cod,sardine",
};

const DIET_MAP: Record<string, string> = {
  vegetarian: "ovo_lacto_vegetarian",
  vegan: "vegan",
  pescatarian: "pescetarian",
  "lacto-vegetarian": "lacto_vegetarian",
  "non-vegetarian": "",
};

// ──────────────────────────────────────────────
// Helper functions
// ──────────────────────────────────────────────

function getLifeStageKey(profile: UserProfile): string {
  if (profile.lifeStage === "pregnancy" && profile.trimester) {
    return `pregnancy_${profile.trimester}`;
  }
  return profile.lifeStage || "general";
}

function checkFoodSafety(recipeName: string, lifeStage: string): string[] {
  const warnings: string[] = [];
  const nameLower = recipeName.toLowerCase();
  if (lifeStage.startsWith("pregnancy")) {
    for (const food of UNSAFE_PREGNANCY_FOODS) {
      if (nameLower.includes(food)) {
        warnings.push(
          `Warning: "${food}" may not be safe during pregnancy. Please consult your doctor.`
        );
      }
    }
  }
  return warnings;
}

function getSubstitutions(profile: UserProfile): string[] {
  const subs: string[] = [];
  if (profile.allergies.includes("dairy")) {
    subs.push("Replace dairy with coconut milk, almond milk, or oat milk.");
  }
  if (profile.allergies.includes("gluten")) {
    subs.push("Use rice flour, almond flour, or millet flour instead of wheat.");
  }
  if (profile.allergies.includes("nuts")) {
    subs.push("Replace nuts with seeds (sunflower, pumpkin) for similar nutrition.");
  }
  if (profile.allergies.includes("eggs")) {
    subs.push("Use flax egg (1 tbsp ground flax + 3 tbsp water) as an egg substitute.");
  }
  if (profile.lifeStage.startsWith("pregnancy")) {
    subs.push("Replace soft cheeses with hard cheeses like cheddar or parmesan.");
  }
  return subs;
}

function formatRecipe(
  recipe: RecipeBasic,
  profile: UserProfile
): FormattedRecipe {
  const cal = Number(recipe.Calories || recipe["Energy (kcal)"] || 0);
  const protein = Number(recipe["Protein (g)"] || 0);
  const carbs = Number(recipe["Carbohydrate, by difference (g)"] || 0);
  const fat = Number(recipe["Total lipid (fat) (g)"] || 0);
  const key = getLifeStageKey(profile);

  return {
    name: recipe.Recipe_title,
    calories: Math.round(cal),
    protein: protein > 0 ? Math.round(protein * 10) / 10 : Math.round((cal * 0.2) / 4),
    carbs: carbs > 0 ? Math.round(carbs * 10) / 10 : Math.round((cal * 0.5) / 4),
    fat: fat > 0 ? Math.round(fat * 10) / 10 : Math.round((cal * 0.3) / 9),
    cookTime: recipe.cook_time || recipe.total_time || "Not specified",
    region: recipe.Region || "Global",
    servings: recipe.servings || "1",
    recipeId: recipe.Recipe_id,
    safetyNotes: checkFoodSafety(recipe.Recipe_title, key),
    substitutions: getSubstitutions(profile),
    healthTips: (SAFETY_TIPS[key] || SAFETY_TIPS.general).slice(0, 2),
  };
}

function msgId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ──────────────────────────────────────────────
// Pattern matching for free-chat
// ──────────────────────────────────────────────

interface PatternRule {
  patterns: RegExp[];
  response: string;
}

const FREE_CHAT_RULES: PatternRule[] = [
  {
    patterns: [/\b(hello|hi|hey|namaste)\b/i],
    response:
      "Hello! I'm your Nourish nutrition assistant. Would you like me to suggest a recipe? Type 'recipe' or 'suggest' to start!",
  },
  {
    patterns: [/\b(recipe|suggest|recommend|meal|food)\b/i],
    response: "I'd love to suggest a recipe! Let me gather some details first.",
  },
  {
    patterns: [/\b(iron|anemia|anaemia)\b/i],
    response:
      "Iron-rich foods include spinach, lentils (dal), beetroot, dates, jaggery (gur), and fortified cereals. Pair with Vitamin C (lemon, amla) to boost absorption. Avoid tea/coffee with meals as they inhibit iron absorption.",
  },
  {
    patterns: [/\b(calcium|bones|osteoporosis)\b/i],
    response:
      "Great calcium sources: ragi (finger millet), sesame seeds, dairy/fortified plant milk, leafy greens like moringa. Vitamin D (sunlight, fortified foods) helps calcium absorption. Aim for 1000-1200mg/day.",
  },
  {
    patterns: [/\b(folic acid|folate|neural tube)\b/i],
    response:
      "Folate is critical, especially in early pregnancy (600mcg/day). Rich sources: dark leafy greens, lentils, chickpeas, fortified cereals, orange juice. Cook lightly to preserve folate content.",
  },
  {
    patterns: [/\b(nausea|morning sickness|vomit)\b/i],
    response:
      "For nausea: try ginger tea, dry crackers/toast before getting up, small frequent meals, cold foods (less aroma), and avoid spicy/greasy foods. Vitamin B6 may help — consult your doctor.",
  },
  {
    patterns: [/\b(breastfeed|lactation|milk production|galactagogue)\b/i],
    response:
      "To support milk production: stay well-hydrated, eat oats, fenugreek (methi), garlic, fennel seeds, and protein-rich foods. Eat 500 extra cal/day while breastfeeding. Avoid excessive caffeine.",
  },
  {
    patterns: [/\b(weight|gain|lose|diet plan)\b/i],
    response:
      "Healthy weight management varies by life stage. During pregnancy, gradual weight gain is normal and healthy. Postpartum, focus on nourishment over restriction. I can suggest balanced meals — type 'recipe' to get started!",
  },
  {
    patterns: [/\b(caffeine|coffee|tea|chai)\b/i],
    response:
      "During pregnancy, limit caffeine to under 200mg/day (~1 cup of coffee or 2-3 cups of tea). Herbal teas like ginger and peppermint are generally safe. Avoid green tea in excess (interferes with folate). Postpartum/breastfeeding: moderate caffeine is okay.",
  },
  {
    patterns: [/\b(alcohol|wine|beer|drink)\b/i],
    response:
      "Alcohol should be completely avoided during pregnancy — no safe amount has been established. While breastfeeding, it's best to avoid it or wait 2+ hours per drink before nursing. During menopause, limit alcohol as it can worsen hot flashes.",
  },
  {
    patterns: [/\b(diabetes|gestational|sugar|blood sugar)\b/i],
    response:
      "For blood sugar management: choose complex carbs (whole grains, millets), pair carbs with protein/fiber, eat small frequent meals, and limit refined sugar. Include bitter gourd, fenugreek, and cinnamon. Always consult your doctor for gestational diabetes management.",
  },
  {
    patterns: [/\b(constipation|fiber|digestion)\b/i],
    response:
      "For better digestion: increase fiber with whole grains, fruits, vegetables, and psyllium husk (isabgol). Drink plenty of water, stay active, and include probiotics (yogurt, buttermilk). Prunes and flaxseeds are excellent natural remedies.",
  },
  {
    patterns: [/\b(protein)\b/i],
    response:
      "Protein needs increase during pregnancy (75-100g/day) and breastfeeding. Great sources: dal, paneer, eggs, chicken, fish (low mercury), tofu, quinoa, Greek yogurt, and nuts. Spread intake across all meals.",
  },
  {
    patterns: [/\b(vitamin d|sunshine|sunlight)\b/i],
    response:
      "Vitamin D is essential for calcium absorption and immunity. Sources: 15-20 min of morning sunlight, fortified milk, eggs, and mushrooms. Deficiency is very common — ask your doctor about supplementation.",
  },
  {
    patterns: [/\b(omega|dha|brain|fish oil)\b/i],
    response:
      "Omega-3 DHA supports baby's brain development. Vegetarian sources: walnuts, flaxseeds, chia seeds. Non-veg: fatty fish (salmon, sardines) 2x/week. Avoid high-mercury fish (shark, swordfish, king mackerel).",
  },
  {
    patterns: [/\b(hot flash|menopause|night sweat|hormone)\b/i],
    response:
      "For menopause symptoms: phytoestrogen-rich foods (soy, flaxseeds, sesame) may help. Avoid spicy foods, alcohol, and caffeine if they trigger hot flashes. Include calcium, Vitamin D, and magnesium-rich foods for bone and sleep health.",
  },
  {
    patterns: [/\b(thank|thanks|bye|goodbye)\b/i],
    response:
      "You're welcome! Remember, I'm here whenever you need nutrition guidance. Take care and eat well! Type 'recipe' anytime for a personalized suggestion.",
  },
  {
    patterns: [/\b(help|what can you do|options)\b/i],
    response:
      "I can help with:\n- Personalized recipe suggestions (type 'recipe')\n- Nutrition advice for pregnancy, postpartum & menopause\n- Food safety information\n- Dietary guidance for allergies\n- General health & nutrition tips\n\nJust ask me anything or type 'recipe' to get started!",
  },
];

function matchFreeChat(input: string): string | null {
  const lower = input.toLowerCase().trim();
  for (const rule of FREE_CHAT_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(lower)) {
        return rule.response;
      }
    }
  }
  return null;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

const NutritionChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [step, setStep] = useState<ConversationStep>("idle");
  const [profile, setProfile] = useState<UserProfile>({
    lifeStage: "",
    diet: "",
    allergies: [],
    mealType: "",
    cookingTime: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem(STORAGE_KEY);
      const savedProfile = localStorage.getItem(PROFILE_KEY);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages) as ChatMessage[];
        setMessages(parsed);
        // Determine step from last state
        if (parsed.length > 0) {
          setStep("free_chat");
        }
      }
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Persist to localStorage on message changes
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
      } catch {
        // storage full — clear old messages
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
      }
    }
  }, [messages]);

  // Persist profile
  useEffect(() => {
    if (profile.lifeStage) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    }
  }, [profile]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const addBotMessage = useCallback(
    (text: string, options?: QuickOption[], recipe?: FormattedRecipe | null) => {
      setMessages((prev) => [
        ...prev,
        {
          id: msgId(),
          role: "bot",
          text,
          options,
          recipe,
          timestamp: Date.now(),
        },
      ]);
    },
    []
  );

  const addUserMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: msgId(), role: "user", text, timestamp: Date.now() },
    ]);
  }, []);

  // ── Start conversation ──
  const startConversation = useCallback(() => {
    addBotMessage(
      "Namaste! I'm your Nourish nutrition assistant. I'll help you find healthy recipes tailored to your needs.\n\nWhat is your current life stage?",
      [
        { label: "Pregnancy", value: "pregnancy" },
        { label: "Postpartum", value: "postpartum" },
        { label: "Menopause", value: "menopause" },
        { label: "General Wellness", value: "general" },
      ]
    );
    setStep("life_stage");
  }, [addBotMessage]);

  // ── Open chat ──
  const handleOpen = useCallback(() => {
    setIsOpen(true);
    if (messages.length === 0) {
      startConversation();
    }
  }, [messages.length, startConversation]);

  // ── Fetch recipe from API ──
  const fetchRecipe = useCallback(
    async (prof: UserProfile) => {
      setIsLoading(true);
      setStep("fetching");
      addBotMessage("Looking for the perfect recipe for you...");

      try {
        const key = getLifeStageKey(prof);
        const calorieRange = CALORIE_TARGETS[key] || CALORIE_TARGETS.general;

        // Build exclude ingredients from allergies
        const excludeIngredients = prof.allergies
          .map((a) => ALLERGY_EXCLUDE_MAP[a] || a)
          .join(",");

        // Try primary search: by ingredients/categories/title with meal type hint
        let recipes: RecipeBasic[] = [];
        const mealTitles: Record<string, string> = {
          breakfast: "breakfast",
          lunch: "rice,curry,dal",
          dinner: "dinner,soup,stew",
          snack: "snack,chaat,smoothie",
        };

        try {
          recipes = await getRecipesByIngredientsCategoriesTitle({
            title: mealTitles[prof.mealType] || prof.mealType,
            excludeIngredients: excludeIngredients || undefined,
            limit: 15,
            page: Math.floor(Math.random() * 3) + 1,
          });
        } catch {
          // fallback
        }

        // If no results or diet filter needed, try diet endpoint
        if ((!recipes || recipes.length === 0) && prof.diet !== "non-vegetarian") {
          const dietKey = DIET_MAP[prof.diet];
          if (dietKey) {
            try {
              const res = await getRecipesByDiet(dietKey, 15, Math.floor(Math.random() * 3) + 1);
              recipes = res.data || [];
            } catch {
              // fallback
            }
          }
        }

        // Fallback to calorie-based
        if (!recipes || recipes.length === 0) {
          try {
            const res = await getRecipesByCalories(
              calorieRange.min,
              calorieRange.max,
              15,
              Math.floor(Math.random() * 5) + 1
            );
            recipes = res.data || [];
          } catch {
            // all failed
          }
        }

        // Filter by diet type client-side if needed
        if (prof.diet !== "non-vegetarian" && recipes.length > 0) {
          const dietField = DIET_MAP[prof.diet];
          if (dietField) {
            const filtered = recipes.filter(
              (r) => (r as Record<string, string>)[dietField] === "1"
            );
            if (filtered.length > 0) recipes = filtered;
          }
        }

        // Filter by cooking time client-side
        if (prof.cookingTime && recipes.length > 0) {
          const maxMinutes =
            prof.cookingTime === "quick"
              ? 30
              : prof.cookingTime === "medium"
              ? 60
              : 999;
          const filtered = recipes.filter((r) => {
            const time = parseInt(r.cook_time || r.total_time || "0");
            return time > 0 && time <= maxMinutes;
          });
          if (filtered.length > 0) recipes = filtered;
        }

        // Filter by calorie range
        if (recipes.length > 0) {
          const filtered = recipes.filter((r) => {
            const cal = Number(r.Calories || r["Energy (kcal)"] || 0);
            return cal >= calorieRange.min * 0.5 && cal <= calorieRange.max * 2;
          });
          if (filtered.length > 0) recipes = filtered;
        }

        if (recipes.length > 0) {
          // Pick a random recipe
          const picked = recipes[Math.floor(Math.random() * recipes.length)];
          const formatted = formatRecipe(picked, prof);

          addBotMessage(
            `Here's a recipe suggestion for you:`,
            undefined,
            formatted
          );

          setStep("done");
          setTimeout(() => {
            addBotMessage(
              "Would you like another recipe, or do you have any nutrition questions?",
              [
                { label: "Another recipe", value: "__new_recipe__" },
                { label: "Change preferences", value: "__restart__" },
                { label: "Ask a question", value: "__free_chat__" },
              ]
            );
          }, 500);
        } else {
          addBotMessage(
            "I couldn't find a recipe matching all your criteria. Let me share some nutrition tips instead.\n\n" +
              (SAFETY_TIPS[key] || SAFETY_TIPS.general).join("\n\n") +
              "\n\nWould you like to try with different preferences?",
            [
              { label: "Try again", value: "__restart__" },
              { label: "Ask a question", value: "__free_chat__" },
            ]
          );
          setStep("done");
        }
      } catch (err) {
        addBotMessage(
          "I'm having trouble connecting to the recipe database right now. Here are some general tips:\n\n" +
            (SAFETY_TIPS[getLifeStageKey(prof)] || SAFETY_TIPS.general).join("\n\n") +
            "\n\nYou can try again or ask me a nutrition question.",
          [
            { label: "Try again", value: "__new_recipe__" },
            { label: "Ask a question", value: "__free_chat__" },
          ]
        );
        setStep("done");
      } finally {
        setIsLoading(false);
      }
    },
    [addBotMessage]
  );

  // ── Process user input through conversation flow ──
  const processInput = useCallback(
    (input: string) => {
      const value = input.trim();
      if (!value) return;

      addUserMessage(value);

      // Handle special commands from any step
      if (value === "__restart__") {
        setProfile({ lifeStage: "", diet: "", allergies: [], mealType: "", cookingTime: "" });
        startConversation();
        return;
      }
      if (value === "__new_recipe__") {
        fetchRecipe(profile);
        return;
      }
      if (value === "__free_chat__") {
        addBotMessage(
          "Sure! Ask me anything about nutrition, pregnancy diet, postpartum recovery, or menopause wellness. Or type 'recipe' for a new suggestion."
        );
        setStep("free_chat");
        return;
      }

      switch (step) {
        case "life_stage": {
          const stage = value.toLowerCase();
          const updatedProfile = { ...profile, lifeStage: stage };
          setProfile(updatedProfile);

          if (stage === "pregnancy") {
            addBotMessage("Which trimester are you in?", [
              { label: "1st Trimester", value: "1" },
              { label: "2nd Trimester", value: "2" },
              { label: "3rd Trimester", value: "3" },
            ]);
            setStep("trimester");
          } else {
            addBotMessage("What is your dietary preference?", [
              { label: "Vegetarian", value: "vegetarian" },
              { label: "Vegan", value: "vegan" },
              { label: "Non-Vegetarian", value: "non-vegetarian" },
              { label: "Pescatarian", value: "pescatarian" },
              { label: "Lacto-Vegetarian", value: "lacto-vegetarian" },
            ]);
            setStep("diet");
          }
          break;
        }

        case "trimester": {
          const updatedProfile = { ...profile, trimester: value };
          setProfile(updatedProfile);
          addBotMessage("What is your dietary preference?", [
            { label: "Vegetarian", value: "vegetarian" },
            { label: "Vegan", value: "vegan" },
            { label: "Non-Vegetarian", value: "non-vegetarian" },
            { label: "Pescatarian", value: "pescatarian" },
            { label: "Lacto-Vegetarian", value: "lacto-vegetarian" },
          ]);
          setStep("diet");
          break;
        }

        case "diet": {
          const updatedProfile = { ...profile, diet: value.toLowerCase() };
          setProfile(updatedProfile);
          addBotMessage(
            "Do you have any food allergies or intolerances? Select all that apply, or type 'none'.",
            [
              { label: "Dairy", value: "dairy" },
              { label: "Nuts", value: "nuts" },
              { label: "Gluten", value: "gluten" },
              { label: "Soy", value: "soy" },
              { label: "Eggs", value: "eggs" },
              { label: "Shellfish", value: "shellfish" },
              { label: "None", value: "none" },
            ]
          );
          setStep("allergies");
          break;
        }

        case "allergies": {
          const allergyVal = value.toLowerCase();
          if (allergyVal === "none" || allergyVal === "done") {
            const updatedProfile = {
              ...profile,
              allergies: profile.allergies.length > 0 ? profile.allergies : [],
            };
            setProfile(updatedProfile);
            addBotMessage("What type of meal are you looking for?", [
              { label: "Breakfast", value: "breakfast" },
              { label: "Lunch", value: "lunch" },
              { label: "Dinner", value: "dinner" },
              { label: "Snack", value: "snack" },
            ]);
            setStep("meal_type");
          } else {
            // Add allergy and stay on same step
            const newAllergies = [...profile.allergies];
            if (!newAllergies.includes(allergyVal)) {
              newAllergies.push(allergyVal);
            }
            setProfile({ ...profile, allergies: newAllergies });
            addBotMessage(
              `Added "${allergyVal}" to your allergies (${newAllergies.join(", ")}). Select another or type 'done'.`,
              [
                { label: "Dairy", value: "dairy" },
                { label: "Nuts", value: "nuts" },
                { label: "Gluten", value: "gluten" },
                { label: "Done", value: "done" },
              ]
            );
          }
          break;
        }

        case "meal_type": {
          const updatedProfile = { ...profile, mealType: value.toLowerCase() };
          setProfile(updatedProfile);
          addBotMessage("How much time do you have for cooking?", [
            { label: "Quick (< 30 min)", value: "quick" },
            { label: "Medium (30-60 min)", value: "medium" },
            { label: "No limit", value: "any" },
          ]);
          setStep("cooking_time");
          break;
        }

        case "cooking_time": {
          const finalProfile = { ...profile, cookingTime: value.toLowerCase() };
          setProfile(finalProfile);
          fetchRecipe(finalProfile);
          break;
        }

        case "done":
        case "free_chat":
        default: {
          // Check if user wants a recipe
          if (/\b(recipe|suggest|recommend|new meal)\b/i.test(value)) {
            if (profile.lifeStage) {
              addBotMessage("Getting a fresh recipe for you...");
              fetchRecipe(profile);
            } else {
              startConversation();
            }
            return;
          }
          // Pattern matching
          const matched = matchFreeChat(value);
          if (matched) {
            addBotMessage(matched);
            // If they said hi/recipe-related, and want to start flow
            if (/\b(recipe|suggest|recommend|meal|food)\b/i.test(value) && !profile.lifeStage) {
              startConversation();
            }
          } else {
            addBotMessage(
              "I'm not sure about that, but I can help with nutrition advice and recipe suggestions. Try asking about:\n- Specific nutrients (iron, calcium, protein, etc.)\n- Pregnancy/postpartum/menopause diet tips\n- Food safety\n\nOr type 'recipe' for a personalized suggestion!",
              [
                { label: "Get a recipe", value: "__new_recipe__" },
                { label: "Start over", value: "__restart__" },
              ]
            );
          }
          setStep("free_chat");
          break;
        }
      }
    },
    [step, profile, addUserMessage, addBotMessage, startConversation, fetchRecipe]
  );

  // ── Handle send ──
  const handleSend = () => {
    if (!inputText.trim() || isLoading) return;
    processInput(inputText.trim());
    setInputText("");
  };

  // ── Handle quick option click ──
  const handleQuickOption = (value: string) => {
    if (isLoading) return;
    processInput(value);
  };

  // ── Reset chat ──
  const handleReset = () => {
    setMessages([]);
    setProfile({ lifeStage: "", diet: "", allergies: [], mealType: "", cookingTime: "" });
    setStep("idle");
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PROFILE_KEY);
    startConversation();
  };

  // ── Render recipe card ──
  const renderRecipeCard = (recipe: FormattedRecipe) => (
    <div className="mt-2 rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-3 text-sm">
      <h4 className="font-semibold text-emerald-800 text-base mb-2">
        {recipe.name}
      </h4>

      <div className="grid grid-cols-2 gap-1 mb-2 text-xs">
        <span className="text-gray-600">Calories: <strong>{recipe.calories} kcal</strong></span>
        <span className="text-gray-600">Protein: <strong>{recipe.protein}g</strong></span>
        <span className="text-gray-600">Carbs: <strong>{recipe.carbs}g</strong></span>
        <span className="text-gray-600">Fat: <strong>{recipe.fat}g</strong></span>
        <span className="text-gray-600">Cook time: <strong>{recipe.cookTime}</strong></span>
        <span className="text-gray-600">Region: <strong>{recipe.region}</strong></span>
      </div>

      {recipe.safetyNotes.length > 0 && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {recipe.safetyNotes.map((note, i) => (
            <p key={i}>{note}</p>
          ))}
        </div>
      )}

      {recipe.substitutions.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-emerald-700 mb-1">Substitutions:</p>
          {recipe.substitutions.map((sub, i) => (
            <p key={i} className="text-xs text-gray-600 ml-2">- {sub}</p>
          ))}
        </div>
      )}

      {recipe.healthTips.length > 0 && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded">
          <p className="text-xs font-medium text-blue-700 mb-1">Health Tips:</p>
          {recipe.healthTips.map((tip, i) => (
            <p key={i} className="text-xs text-blue-600">{tip}</p>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center group"
          aria-label="Open nutrition chatbot"
        >
          <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-orange-400 border-2 border-white animate-pulse" />
        </button>
      )}

      {/* Chat popup */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-4rem)] flex flex-col rounded-2xl shadow-2xl border border-gray-200 bg-white overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm leading-tight">Nourish Assistant</h3>
                <p className="text-[10px] text-emerald-100">Maternal Nutrition Guide</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Reset chat"
                title="Start over"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Minimize chat"
                title="Minimize"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Close chat"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50/50">
            {messages.map((msg) => (
              <div key={msg.id}>
                {/* Message bubble */}
                <div
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-emerald-600 text-white rounded-br-md"
                        : "bg-white text-gray-800 border border-gray-100 shadow-sm rounded-bl-md"
                    }`}
                  >
                    {msg.text.split("\n").map((line, i) => (
                      <React.Fragment key={i}>
                        {line}
                        {i < msg.text.split("\n").length - 1 && <br />}
                      </React.Fragment>
                    ))}

                    {/* Recipe card */}
                    {msg.recipe && renderRecipeCard(msg.recipe)}
                  </div>
                </div>

                {/* Quick options */}
                {msg.options && msg.id === messages[messages.length - 1]?.id && (
                  <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                    {msg.options.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleQuickOption(opt.value)}
                        disabled={isLoading}
                        className="text-xs px-3 py-1.5 rounded-full border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 transition-colors disabled:opacity-50"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Finding recipes...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t bg-white px-3 py-2.5">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  isLoading
                    ? "Please wait..."
                    : step === "allergies"
                    ? "Type allergy or click option..."
                    : "Type a message..."
                }
                disabled={isLoading}
                className="flex-1 text-sm rounded-full border border-gray-200 bg-gray-50 px-4 py-2 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 disabled:opacity-50 transition-colors"
              />
              <Button
                onClick={handleSend}
                disabled={!inputText.trim() || isLoading}
                size="sm"
                className="rounded-full h-9 w-9 p-0 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-1.5">
              Not medical advice. Always consult your healthcare provider.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default NutritionChatbot;
