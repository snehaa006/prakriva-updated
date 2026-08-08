// src/data/ingredients.ts
//
// The vocabulary a patient picks their pantry from. Free text does not work
// here: what a patient types ("Dals", "ALL Kinds Of Fruits") is not what the
// recipe database indexes, so the doctor's ingredient search matched nothing.
//
// Each entry carries two names:
//   - `label`      what the patient sees and what we store as the food name.
//   - `searchTerm` the plain ingredient noun sent to the recipe API. Generic
//                  beats specific here — "rice" finds recipes, "sona masoori"
//                  does not — so several labels deliberately share one term.
// `aliases` only widen what matches while typing; they are never stored.
//
// `public/foodDatabase.json` is deliberately not used for this: it lists ~8000
// prepared *dishes* (Ada Pradhaman, Akki Rotti…), not ingredients.

export interface IngredientOption {
  label: string;
  searchTerm: string;
  category: string;
  aliases?: string[];
}

export const INGREDIENT_CATEGORIES = [
  "Grains & Cereals",
  "Dals & Legumes",
  "Vegetables",
  "Fruits",
  "Dairy & Eggs",
  "Nuts & Seeds",
  "Spices & Herbs",
  "Oils & Fats",
  "Meat & Seafood",
  "Sweeteners",
  "Beverages",
  "Other staples",
] as const;

export const INGREDIENTS: IngredientOption[] = [
  // --- Grains & Cereals ---
  { label: "Rice (white)", searchTerm: "rice", category: "Grains & Cereals", aliases: ["chawal", "basmati", "sona masoori"] },
  { label: "Brown rice", searchTerm: "rice", category: "Grains & Cereals" },
  { label: "Poha (flattened rice)", searchTerm: "rice", category: "Grains & Cereals", aliases: ["chivda", "beaten rice"] },
  { label: "Wheat flour (atta)", searchTerm: "wheat flour", category: "Grains & Cereals", aliases: ["atta", "gehu"] },
  { label: "Maida (refined flour)", searchTerm: "flour", category: "Grains & Cereals", aliases: ["all purpose flour"] },
  { label: "Semolina (sooji/rava)", searchTerm: "semolina", category: "Grains & Cereals", aliases: ["sooji", "rava"] },
  { label: "Oats", searchTerm: "oat", category: "Grains & Cereals" },
  { label: "Quinoa", searchTerm: "quinoa", category: "Grains & Cereals" },
  { label: "Barley (jau)", searchTerm: "barley", category: "Grains & Cereals", aliases: ["jau"] },
  { label: "Millet (bajra)", searchTerm: "millet", category: "Grains & Cereals", aliases: ["bajra", "pearl millet"] },
  { label: "Ragi (finger millet)", searchTerm: "millet", category: "Grains & Cereals", aliases: ["nachni", "finger millet"] },
  { label: "Jowar (sorghum)", searchTerm: "sorghum", category: "Grains & Cereals", aliases: ["jowar"] },
  { label: "Corn / maize", searchTerm: "corn", category: "Grains & Cereals", aliases: ["makai", "bhutta"] },
  { label: "Cornmeal (makki atta)", searchTerm: "cornmeal", category: "Grains & Cereals" },
  { label: "Bread", searchTerm: "bread", category: "Grains & Cereals" },
  { label: "Pasta", searchTerm: "pasta", category: "Grains & Cereals", aliases: ["macaroni", "penne"] },
  { label: "Noodles", searchTerm: "noodle", category: "Grains & Cereals" },
  { label: "Buckwheat (kuttu)", searchTerm: "buckwheat", category: "Grains & Cereals", aliases: ["kuttu"] },
  { label: "Sago (sabudana)", searchTerm: "tapioca", category: "Grains & Cereals", aliases: ["sabudana", "tapioca pearl"] },
  { label: "Besan (gram flour)", searchTerm: "chickpea flour", category: "Grains & Cereals", aliases: ["besan", "gram flour"] },

  // --- Dals & Legumes ---
  { label: "Toor dal (arhar)", searchTerm: "lentil", category: "Dals & Legumes", aliases: ["arhar", "pigeon pea", "tuvar"] },
  { label: "Moong dal", searchTerm: "mung bean", category: "Dals & Legumes", aliases: ["mung", "green gram"] },
  { label: "Masoor dal (red lentil)", searchTerm: "lentil", category: "Dals & Legumes", aliases: ["masoor", "red lentil"] },
  { label: "Chana dal", searchTerm: "chickpea", category: "Dals & Legumes", aliases: ["bengal gram", "split chickpea"] },
  { label: "Urad dal (black gram)", searchTerm: "black gram", category: "Dals & Legumes", aliases: ["urad", "black lentil"] },
  { label: "Chickpeas (kabuli chana)", searchTerm: "chickpea", category: "Dals & Legumes", aliases: ["chana", "garbanzo"] },
  { label: "Kidney beans (rajma)", searchTerm: "kidney bean", category: "Dals & Legumes", aliases: ["rajma"] },
  { label: "Black-eyed peas (lobia)", searchTerm: "black-eyed pea", category: "Dals & Legumes", aliases: ["lobia", "chawli"] },
  { label: "Green peas", searchTerm: "pea", category: "Dals & Legumes", aliases: ["matar"] },
  { label: "Soybean", searchTerm: "soybean", category: "Dals & Legumes", aliases: ["soya"] },
  { label: "Tofu", searchTerm: "tofu", category: "Dals & Legumes" },
  { label: "Sprouts", searchTerm: "sprout", category: "Dals & Legumes" },
  { label: "Peanuts", searchTerm: "peanut", category: "Dals & Legumes", aliases: ["groundnut", "moongphali"] },

  // --- Vegetables ---
  { label: "Onion", searchTerm: "onion", category: "Vegetables", aliases: ["pyaz"] },
  { label: "Garlic", searchTerm: "garlic", category: "Vegetables", aliases: ["lehsun"] },
  { label: "Ginger", searchTerm: "ginger", category: "Vegetables", aliases: ["adrak"] },
  { label: "Tomato", searchTerm: "tomato", category: "Vegetables", aliases: ["tamatar"] },
  { label: "Potato", searchTerm: "potato", category: "Vegetables", aliases: ["aloo"] },
  { label: "Sweet potato", searchTerm: "sweet potato", category: "Vegetables", aliases: ["shakarkandi"] },
  { label: "Spinach", searchTerm: "spinach", category: "Vegetables", aliases: ["palak"] },
  { label: "Fenugreek leaves (methi)", searchTerm: "fenugreek", category: "Vegetables", aliases: ["methi"] },
  { label: "Mustard greens (sarson)", searchTerm: "mustard green", category: "Vegetables", aliases: ["sarson"] },
  { label: "Cabbage", searchTerm: "cabbage", category: "Vegetables", aliases: ["patta gobhi"] },
  { label: "Cauliflower", searchTerm: "cauliflower", category: "Vegetables", aliases: ["gobhi"] },
  { label: "Broccoli", searchTerm: "broccoli", category: "Vegetables" },
  { label: "Carrot", searchTerm: "carrot", category: "Vegetables", aliases: ["gajar"] },
  { label: "Beetroot", searchTerm: "beet", category: "Vegetables", aliases: ["chukandar"] },
  { label: "Radish (mooli)", searchTerm: "radish", category: "Vegetables", aliases: ["mooli", "daikon"] },
  { label: "Bottle gourd (lauki)", searchTerm: "gourd", category: "Vegetables", aliases: ["lauki", "dudhi"] },
  { label: "Ridge gourd (turai)", searchTerm: "gourd", category: "Vegetables", aliases: ["turai"] },
  { label: "Bitter gourd (karela)", searchTerm: "bitter gourd", category: "Vegetables", aliases: ["karela"] },
  { label: "Pumpkin (kaddu)", searchTerm: "pumpkin", category: "Vegetables", aliases: ["kaddu", "sitaphal"] },
  { label: "Brinjal / eggplant", searchTerm: "eggplant", category: "Vegetables", aliases: ["baingan", "aubergine"] },
  { label: "Okra (bhindi)", searchTerm: "okra", category: "Vegetables", aliases: ["bhindi", "ladyfinger"] },
  { label: "Capsicum / bell pepper", searchTerm: "bell pepper", category: "Vegetables", aliases: ["shimla mirch", "capsicum"] },
  { label: "Green chilli", searchTerm: "chili pepper", category: "Vegetables", aliases: ["hari mirch"] },
  { label: "Cucumber", searchTerm: "cucumber", category: "Vegetables", aliases: ["kheera"] },
  { label: "Zucchini", searchTerm: "zucchini", category: "Vegetables" },
  { label: "Mushroom", searchTerm: "mushroom", category: "Vegetables" },
  { label: "Green beans", searchTerm: "green bean", category: "Vegetables", aliases: ["french beans"] },
  { label: "Cluster beans (gawar)", searchTerm: "bean", category: "Vegetables", aliases: ["gawar", "guar"] },
  { label: "Drumstick (moringa)", searchTerm: "moringa", category: "Vegetables", aliases: ["sahjan", "drumstick"] },
  { label: "Colocasia (arbi)", searchTerm: "taro", category: "Vegetables", aliases: ["arbi", "taro"] },
  { label: "Yam (jimikand)", searchTerm: "yam", category: "Vegetables", aliases: ["suran", "jimikand"] },
  { label: "Raw banana", searchTerm: "plantain", category: "Vegetables", aliases: ["plantain", "kaccha kela"] },
  { label: "Lettuce", searchTerm: "lettuce", category: "Vegetables" },
  { label: "Celery", searchTerm: "celery", category: "Vegetables" },
  { label: "Sweet corn", searchTerm: "corn", category: "Vegetables" },
  { label: "Peas (frozen)", searchTerm: "pea", category: "Vegetables" },
  { label: "Amaranth leaves (chaulai)", searchTerm: "amaranth", category: "Vegetables", aliases: ["chaulai"] },

  // --- Fruits ---
  { label: "Apple", searchTerm: "apple", category: "Fruits", aliases: ["seb"] },
  { label: "Banana", searchTerm: "banana", category: "Fruits", aliases: ["kela"] },
  { label: "Guava", searchTerm: "guava", category: "Fruits", aliases: ["amrood"] },
  { label: "Mango", searchTerm: "mango", category: "Fruits", aliases: ["aam"] },
  { label: "Papaya", searchTerm: "papaya", category: "Fruits", aliases: ["papita"] },
  { label: "Orange", searchTerm: "orange", category: "Fruits", aliases: ["santra"] },
  { label: "Sweet lime (mosambi)", searchTerm: "lime", category: "Fruits", aliases: ["mosambi"] },
  { label: "Lemon", searchTerm: "lemon", category: "Fruits", aliases: ["nimbu"] },
  { label: "Grapes", searchTerm: "grape", category: "Fruits", aliases: ["angoor"] },
  { label: "Pomegranate", searchTerm: "pomegranate", category: "Fruits", aliases: ["anar"] },
  { label: "Watermelon", searchTerm: "watermelon", category: "Fruits", aliases: ["tarbooz"] },
  { label: "Muskmelon", searchTerm: "melon", category: "Fruits", aliases: ["kharbooja"] },
  { label: "Pineapple", searchTerm: "pineapple", category: "Fruits", aliases: ["ananas"] },
  { label: "Pear", searchTerm: "pear", category: "Fruits", aliases: ["nashpati"] },
  { label: "Peach", searchTerm: "peach", category: "Fruits", aliases: ["aadu"] },
  { label: "Plum", searchTerm: "plum", category: "Fruits", aliases: ["aloo bukhara"] },
  { label: "Chikoo (sapota)", searchTerm: "sapote", category: "Fruits", aliases: ["chikoo", "sapota"] },
  { label: "Custard apple (sitaphal)", searchTerm: "custard apple", category: "Fruits", aliases: ["sitaphal"] },
  { label: "Amla (gooseberry)", searchTerm: "gooseberry", category: "Fruits", aliases: ["amla"] },
  { label: "Coconut", searchTerm: "coconut", category: "Fruits", aliases: ["nariyal"] },
  { label: "Strawberry", searchTerm: "strawberry", category: "Fruits" },
  { label: "Blueberry", searchTerm: "blueberry", category: "Fruits" },
  { label: "Avocado", searchTerm: "avocado", category: "Fruits" },
  { label: "Kiwi", searchTerm: "kiwi", category: "Fruits" },
  { label: "Dates", searchTerm: "date", category: "Fruits", aliases: ["khajoor"] },
  { label: "Raisins", searchTerm: "raisin", category: "Fruits", aliases: ["kishmish"] },
  { label: "Figs (anjeer)", searchTerm: "fig", category: "Fruits", aliases: ["anjeer"] },

  // --- Dairy & Eggs ---
  { label: "Milk", searchTerm: "milk", category: "Dairy & Eggs", aliases: ["doodh"] },
  { label: "Curd / yogurt", searchTerm: "yogurt", category: "Dairy & Eggs", aliases: ["dahi", "curd"] },
  { label: "Buttermilk (chaas)", searchTerm: "buttermilk", category: "Dairy & Eggs", aliases: ["chaas", "lassi"] },
  { label: "Paneer", searchTerm: "cheese", category: "Dairy & Eggs", aliases: ["cottage cheese", "paneer"] },
  { label: "Cheese", searchTerm: "cheese", category: "Dairy & Eggs" },
  { label: "Butter", searchTerm: "butter", category: "Dairy & Eggs", aliases: ["makhan"] },
  { label: "Cream", searchTerm: "cream", category: "Dairy & Eggs", aliases: ["malai"] },
  { label: "Khoya / mawa", searchTerm: "milk", category: "Dairy & Eggs", aliases: ["mawa", "khoya"] },
  { label: "Eggs", searchTerm: "egg", category: "Dairy & Eggs", aliases: ["anda"] },

  // --- Nuts & Seeds ---
  { label: "Almonds", searchTerm: "almond", category: "Nuts & Seeds", aliases: ["badam"] },
  { label: "Cashews", searchTerm: "cashew", category: "Nuts & Seeds", aliases: ["kaju"] },
  { label: "Walnuts", searchTerm: "walnut", category: "Nuts & Seeds", aliases: ["akhrot"] },
  { label: "Pistachios", searchTerm: "pistachio", category: "Nuts & Seeds", aliases: ["pista"] },
  { label: "Sesame seeds (til)", searchTerm: "sesame", category: "Nuts & Seeds", aliases: ["til"] },
  { label: "Flaxseeds (alsi)", searchTerm: "flaxseed", category: "Nuts & Seeds", aliases: ["alsi", "linseed"] },
  { label: "Chia seeds", searchTerm: "chia", category: "Nuts & Seeds" },
  { label: "Pumpkin seeds", searchTerm: "pumpkin seed", category: "Nuts & Seeds" },
  { label: "Sunflower seeds", searchTerm: "sunflower seed", category: "Nuts & Seeds" },
  { label: "Melon seeds (magaz)", searchTerm: "melon seed", category: "Nuts & Seeds", aliases: ["magaz"] },

  // --- Spices & Herbs ---
  { label: "Turmeric (haldi)", searchTerm: "turmeric", category: "Spices & Herbs", aliases: ["haldi"] },
  { label: "Cumin (jeera)", searchTerm: "cumin", category: "Spices & Herbs", aliases: ["jeera"] },
  { label: "Coriander seeds (dhania)", searchTerm: "coriander", category: "Spices & Herbs", aliases: ["dhania"] },
  { label: "Coriander leaves", searchTerm: "cilantro", category: "Spices & Herbs", aliases: ["hara dhania", "cilantro"] },
  { label: "Mustard seeds (rai)", searchTerm: "mustard seed", category: "Spices & Herbs", aliases: ["rai", "sarson"] },
  { label: "Fenugreek seeds (methi dana)", searchTerm: "fenugreek", category: "Spices & Herbs", aliases: ["methi dana"] },
  { label: "Fennel (saunf)", searchTerm: "fennel", category: "Spices & Herbs", aliases: ["saunf"] },
  { label: "Carom seeds (ajwain)", searchTerm: "carom", category: "Spices & Herbs", aliases: ["ajwain"] },
  { label: "Asafoetida (hing)", searchTerm: "asafoetida", category: "Spices & Herbs", aliases: ["hing"] },
  { label: "Red chilli powder", searchTerm: "chili powder", category: "Spices & Herbs", aliases: ["lal mirch"] },
  { label: "Black pepper", searchTerm: "black pepper", category: "Spices & Herbs", aliases: ["kali mirch"] },
  { label: "Cardamom (elaichi)", searchTerm: "cardamom", category: "Spices & Herbs", aliases: ["elaichi"] },
  { label: "Cloves (laung)", searchTerm: "clove", category: "Spices & Herbs", aliases: ["laung"] },
  { label: "Cinnamon (dalchini)", searchTerm: "cinnamon", category: "Spices & Herbs", aliases: ["dalchini"] },
  { label: "Bay leaf (tej patta)", searchTerm: "bay leaf", category: "Spices & Herbs", aliases: ["tej patta"] },
  { label: "Nutmeg (jaiphal)", searchTerm: "nutmeg", category: "Spices & Herbs", aliases: ["jaiphal"] },
  { label: "Garam masala", searchTerm: "garam masala", category: "Spices & Herbs" },
  { label: "Curry leaves", searchTerm: "curry leaf", category: "Spices & Herbs", aliases: ["kadi patta"] },
  { label: "Mint (pudina)", searchTerm: "mint", category: "Spices & Herbs", aliases: ["pudina"] },
  { label: "Basil / tulsi", searchTerm: "basil", category: "Spices & Herbs", aliases: ["tulsi"] },
  { label: "Tamarind (imli)", searchTerm: "tamarind", category: "Spices & Herbs", aliases: ["imli"] },
  { label: "Salt", searchTerm: "salt", category: "Spices & Herbs", aliases: ["namak"] },
  { label: "Rock salt (sendha namak)", searchTerm: "salt", category: "Spices & Herbs", aliases: ["sendha namak"] },
  { label: "Vinegar", searchTerm: "vinegar", category: "Spices & Herbs" },

  // --- Oils & Fats ---
  { label: "Ghee", searchTerm: "ghee", category: "Oils & Fats", aliases: ["clarified butter"] },
  { label: "Mustard oil", searchTerm: "mustard oil", category: "Oils & Fats", aliases: ["sarson ka tel"] },
  { label: "Coconut oil", searchTerm: "coconut oil", category: "Oils & Fats" },
  { label: "Groundnut oil", searchTerm: "peanut oil", category: "Oils & Fats", aliases: ["peanut oil"] },
  { label: "Sunflower oil", searchTerm: "sunflower oil", category: "Oils & Fats" },
  { label: "Olive oil", searchTerm: "olive oil", category: "Oils & Fats" },
  { label: "Sesame oil", searchTerm: "sesame oil", category: "Oils & Fats", aliases: ["til oil"] },

  // --- Meat & Seafood ---
  { label: "Chicken", searchTerm: "chicken", category: "Meat & Seafood", aliases: ["murgh"] },
  { label: "Mutton / lamb", searchTerm: "lamb", category: "Meat & Seafood", aliases: ["mutton", "goat"] },
  { label: "Fish", searchTerm: "fish", category: "Meat & Seafood", aliases: ["machli"] },
  { label: "Prawns", searchTerm: "shrimp", category: "Meat & Seafood", aliases: ["jhinga", "shrimp"] },
  { label: "Salmon", searchTerm: "salmon", category: "Meat & Seafood" },
  { label: "Tuna", searchTerm: "tuna", category: "Meat & Seafood" },

  // --- Sweeteners ---
  { label: "Sugar", searchTerm: "sugar", category: "Sweeteners", aliases: ["cheeni"] },
  { label: "Jaggery (gur)", searchTerm: "jaggery", category: "Sweeteners", aliases: ["gur"] },
  { label: "Honey", searchTerm: "honey", category: "Sweeteners", aliases: ["shahad"] },
  { label: "Maple syrup", searchTerm: "maple syrup", category: "Sweeteners" },

  // --- Beverages ---
  { label: "Tea", searchTerm: "tea", category: "Beverages", aliases: ["chai"] },
  { label: "Green tea", searchTerm: "green tea", category: "Beverages" },
  { label: "Coffee", searchTerm: "coffee", category: "Beverages" },
  { label: "Coconut water", searchTerm: "coconut water", category: "Beverages" },
  { label: "Almond milk", searchTerm: "almond milk", category: "Beverages" },
  { label: "Soy milk", searchTerm: "soy milk", category: "Beverages" },

  // --- Other staples ---
  { label: "Baking soda", searchTerm: "baking soda", category: "Other staples" },
  { label: "Baking powder", searchTerm: "baking powder", category: "Other staples" },
  { label: "Yeast", searchTerm: "yeast", category: "Other staples" },
  { label: "Cornflour", searchTerm: "cornstarch", category: "Other staples", aliases: ["cornstarch"] },
  { label: "Papad", searchTerm: "lentil", category: "Other staples", aliases: ["papadum"] },
  { label: "Pickle (achaar)", searchTerm: "pickle", category: "Other staples", aliases: ["achaar"] },
  { label: "Tomato ketchup", searchTerm: "ketchup", category: "Other staples" },
  { label: "Soy sauce", searchTerm: "soy sauce", category: "Other staples" },
];

/** Look an ingredient up by its stored label. */
export function findIngredient(label: string): IngredientOption | undefined {
  const needle = label.trim().toLowerCase();
  return INGREDIENTS.find((option) => option.label.toLowerCase() === needle);
}

/**
 * The haystack cmdk filters on: label, category and aliases, so "methi",
 * "fenugreek" and "spices" all surface the same entry.
 */
export function ingredientSearchValue(option: IngredientOption): string {
  return [option.label, option.category, option.searchTerm, ...(option.aliases ?? [])].join(
    " "
  );
}

/** The catalogue grouped by category, in the order categories are declared. */
export function ingredientsByCategory(): { category: string; options: IngredientOption[] }[] {
  return INGREDIENT_CATEGORIES.map((category) => ({
    category,
    options: INGREDIENTS.filter((option) => option.category === category),
  })).filter((group) => group.options.length > 0);
}
