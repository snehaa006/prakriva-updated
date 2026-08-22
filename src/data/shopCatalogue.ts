import type { ShopCategory, ShopProduct } from "@/types/shop";

/**
 * The curated product catalogue behind the patient shop.
 *
 * **This is seeded data, not a live feed.** Prices are indicative and dated by
 * `PRICE_CHECKED_ON` in `lib/shop/retailers.ts`; the UI always shows that date
 * and always routes the patient to the retailer for the real number. When a
 * price API is added, this file is what it replaces — the pure search,
 * recommendation and link-safety modules around it stay as they are.
 *
 * Quick-commerce (`blinkit`, `instamart`) is listed only where a ten-minute
 * app plausibly carries the item — everyday consumables, not breast pumps or
 * birthing balls. Padding those apps onto every product would make the
 * "delivers in minutes" filter a lie in the direction that costs a patient a
 * wasted evening.
 *
 * Editorial rules, enforced by `src/data/__tests__/shopCatalogue.test.ts`:
 *
 * - `blurb` says what the product **is**. No claims about what it does to a
 *   body. "Wedge cushion that supports the bump when side-sleeping" is fine;
 *   "prevents back pain" is not, and this app is in no position to say it.
 * - Anything ingested carries `clinicianAdvised`, and the UI shows a notice on
 *   it. A pregnant patient reading a nutrition app should not be nudged into
 *   self-prescribing iron.
 * - Every product carries an `image`, and the file it names lives in
 *   `public/shop`. Stock photography of the *kind* of thing, never a
 *   retailer's own product shot: theirs is theirs, and a hot-linked one breaks
 *   the day they re-key their CDN. The alt text describes the photo, not the
 *   product — the title already says what the product is.
 * - No home fetal dopplers, at any price. They are widely sold, they would
 *   rank well here, and obstetric bodies advise against home use precisely
 *   because a reassuring heartbeat found by an untrained user delays
 *   presentation when something is wrong. Selling reassurance is the one thing
 *   this catalogue must not do.
 */

export const SHOP_CATEGORIES: { id: ShopCategory; label: string; blurb: string }[] = [
  { id: "sleep-comfort", label: "Sleep & comfort", blurb: "Pillows, wedges and supports" },
  { id: "maternity-wear", label: "Maternity wear", blurb: "Belts, bras and everyday clothing" },
  { id: "supplements", label: "Supplements", blurb: "Discuss with your doctor first" },
  { id: "skin-body", label: "Skin & body", blurb: "Oils, butters and everyday care" },
  { id: "nursing-feeding", label: "Nursing & feeding", blurb: "Pumps, pads and bottles" },
  { id: "monitoring", label: "Monitoring", blurb: "Scales, BP and glucose meters" },
  { id: "intimate-care", label: "Intimate care", blurb: "Washes, pads and hygiene" },
  { id: "baby-essentials", label: "Baby essentials", blurb: "For the fourth trimester" },
  { id: "movement", label: "Movement", blurb: "Birthing balls, mats and bands" },
];

export const SHOP_CATALOGUE: ShopProduct[] = [
  // ── Sleep & comfort ──────────────────────────────────────────────────────
  {
    id: "sleep-full-body-pillow",
    title: "Full Body Pregnancy Pillow (C-shape)",
    brand: "Sleepsia",
    category: "sleep-comfort",
    blurb: "C-shaped body pillow that supports the back, bump and knees at once.",
    stages: ["pregnancy", "postpartum"],
    trimesters: [2, 3],
    rating: 4.3,
    reviewCount: 6120,
    keywords: ["pregnancy pillow", "maternity pillow", "body pillow", "c shape pillow", "sleeping pillow"],
    image: {
      src: "/shop/sleep-full-body-pillow.webp",
      alt: "A stack of white pillows on a dark wooden bench",
    },
    offers: [
      { retailer: "amazon", price: 1899, listPrice: 3499, inStock: true },
      { retailer: "flipkart", price: 2049, listPrice: 3299, inStock: true },
      { retailer: "firstcry", price: 2199, inStock: false },
    ],
  },
  {
    id: "sleep-u-shape-pillow",
    title: "U-Shaped Maternity Pillow with Washable Cover",
    brand: "Comfeya",
    category: "sleep-comfort",
    blurb: "Full-length U pillow supporting both sides, so turning over doesn't mean rebuilding the setup.",
    stages: ["pregnancy", "postpartum"],
    trimesters: [2, 3],
    rating: 4.4,
    reviewCount: 2840,
    keywords: ["pregnancy pillow", "u shaped pillow", "maternity pillow", "full body pillow"],
    image: {
      src: "/shop/sleep-u-shape-pillow.webp",
      alt: "A long curled bolster pillow on a cream bed",
    },
    offers: [
      { retailer: "amazon", price: 2499, listPrice: 4999, inStock: true },
      { retailer: "flipkart", price: 2699, inStock: true },
    ],
  },
  {
    id: "sleep-wedge-pillow",
    title: "Bump Support Wedge Cushion",
    brand: "Mylo",
    category: "sleep-comfort",
    blurb: "Small wedge that sits under the bump or lower back while side-sleeping.",
    stages: ["pregnancy"],
    trimesters: [2, 3],
    rating: 4.1,
    reviewCount: 930,
    keywords: ["wedge pillow", "bump support", "pregnancy pillow", "small pillow"],
    image: {
      src: "/shop/sleep-wedge-pillow.webp",
      alt: "A small round cushion propped against a cream bed",
    },
    offers: [
      { retailer: "amazon", price: 649, listPrice: 999, inStock: true },
      { retailer: "firstcry", price: 699, inStock: true },
    ],
  },
  {
    id: "sleep-cooling-pillow",
    title: "Cooling Gel Memory Foam Pillow",
    brand: "Wakefit",
    category: "sleep-comfort",
    blurb: "Gel-layer pillow that stays cooler than standard memory foam through the night.",
    stages: ["menopause", "pregnancy", "not_applicable"],
    rating: 4.2,
    reviewCount: 15400,
    keywords: ["cooling pillow", "night sweats", "hot flashes", "memory foam pillow", "sleep"],
    image: {
      src: "/shop/sleep-cooling-pillow.webp",
      alt: "A plump white pillow against a yellow background",
    },
    offers: [
      { retailer: "amazon", price: 1299, listPrice: 2499, inStock: true },
      { retailer: "flipkart", price: 1199, listPrice: 2299, inStock: true },
    ],
  },

  // ── Maternity wear ───────────────────────────────────────────────────────
  {
    id: "wear-belly-band",
    title: "Maternity Belly Support Belt",
    brand: "Tynor",
    category: "maternity-wear",
    blurb: "Adjustable abdominal band worn under clothing to take some bump weight off the lower back.",
    stages: ["pregnancy"],
    trimesters: [2, 3],
    rating: 4.2,
    reviewCount: 4310,
    keywords: ["belly band", "maternity belt", "pregnancy support belt", "back support", "abdominal belt"],
    image: {
      src: "/shop/wear-belly-band.webp",
      alt: "A pregnant woman with a wide support band across her bump",
    },
    offers: [
      { retailer: "amazon", price: 899, listPrice: 1250, inStock: true },
      { retailer: "flipkart", price: 949, inStock: true },
      { retailer: "brand", price: 1250, url: "https://www.tynor.com/", inStock: true },
    ],
  },
  {
    id: "wear-nursing-bra",
    title: "Wire-Free Maternity & Nursing Bra (Pack of 2)",
    brand: "Morph Maternity",
    category: "maternity-wear",
    blurb: "Cotton nursing bras with drop-down clips and no underwire, sized to change through pregnancy.",
    stages: ["pregnancy", "postpartum"],
    trimesters: [2, 3],
    rating: 4.1,
    reviewCount: 2210,
    keywords: ["nursing bra", "maternity bra", "feeding bra", "wire free bra"],
    image: {
      src: "/shop/wear-nursing-bra.webp",
      alt: "A white bra folded on a mustard knit jumper",
    },
    offers: [
      { retailer: "amazon", price: 1099, listPrice: 1799, inStock: true },
      { retailer: "nykaa", price: 1249, inStock: true },
      { retailer: "firstcry", price: 1150, inStock: true },
    ],
  },
  {
    id: "wear-maternity-leggings",
    title: "Over-Bump Maternity Leggings",
    brand: "Blush Nine",
    category: "maternity-wear",
    blurb: "Stretch leggings with a full over-bump panel, sized to be worn from mid-pregnancy onward.",
    stages: ["pregnancy", "postpartum"],
    trimesters: [2, 3],
    rating: 4.0,
    reviewCount: 780,
    keywords: ["maternity leggings", "maternity pants", "over bump", "maternity clothes"],
    image: {
      src: "/shop/wear-maternity-leggings.webp",
      alt: "Black leggings with a white side stripe, close up",
    },
    offers: [
      { retailer: "amazon", price: 799, inStock: true },
      { retailer: "flipkart", price: 749, listPrice: 1299, inStock: true },
    ],
  },
  {
    id: "wear-compression-socks",
    title: "Graduated Compression Socks (15-20 mmHg)",
    brand: "Sorgen",
    category: "maternity-wear",
    blurb: "Knee-length graduated compression socks, a class commonly recommended for swelling and long travel.",
    stages: ["pregnancy", "postpartum"],
    trimesters: [2, 3],
    rating: 4.3,
    reviewCount: 1560,
    keywords: ["compression socks", "swollen feet", "swelling", "varicose", "leg pain"],
    image: {
      src: "/shop/wear-compression-socks.webp",
      alt: "Three pairs of ribbed knee socks laid side by side",
    },
    offers: [
      { retailer: "amazon", price: 749, listPrice: 1100, inStock: true },
      { retailer: "flipkart", price: 820, inStock: false },
    ],
  },

  // ── Supplements — every one of these carries clinicianAdvised ────────────
  {
    id: "supp-prenatal-multivitamin",
    title: "Prenatal Multivitamin with Folic Acid",
    brand: "Himalaya Wellness",
    category: "supplements",
    blurb: "Daily prenatal multivitamin tablet including folic acid, iron and B12.",
    stages: ["pregnancy"],
    trimesters: [1, 2, 3],
    clinicianAdvised: true,
    rating: 4.2,
    reviewCount: 3400,
    keywords: ["prenatal vitamins", "folic acid", "multivitamin", "pregnancy vitamins", "folate"],
    image: {
      src: "/shop/supp-prenatal-multivitamin.webp",
      alt: "A plain white supplement bottle on a wooden surface",
    },
    offers: [
      { retailer: "amazon", price: 499, listPrice: 650, inStock: true },
      { retailer: "flipkart", price: 525, inStock: true },
      { retailer: "nykaa", price: 549, inStock: true },
      { retailer: "blinkit", price: 549, inStock: true },
    ],
  },
  {
    id: "supp-iron-folic",
    title: "Iron + Folic Acid Tablets",
    brand: "Carbamide Forte",
    category: "supplements",
    blurb: "Iron supplement with folic acid and vitamin C, in a form marketed as gentler on the stomach.",
    stages: ["pregnancy", "postpartum"],
    trimesters: [2, 3],
    clinicianAdvised: true,
    rating: 4.3,
    reviewCount: 8900,
    keywords: ["iron tablets", "iron supplement", "anaemia", "anemia", "folic acid", "haemoglobin"],
    image: {
      src: "/shop/supp-iron-folic.webp",
      alt: "White tablets spilling from an open bottle onto a green surface",
    },
    offers: [
      { retailer: "amazon", price: 399, listPrice: 899, inStock: true },
      { retailer: "flipkart", price: 449, inStock: true },
      { retailer: "blinkit", price: 449, inStock: true },
      { retailer: "instamart", price: 469, inStock: true },
    ],
  },
  {
    id: "supp-calcium-d3",
    title: "Calcium + Vitamin D3 Tablets",
    brand: "TrueBasics",
    category: "supplements",
    blurb: "Calcium carbonate with vitamin D3 and magnesium, one tablet per serving.",
    stages: ["pregnancy", "postpartum", "menopause"],
    clinicianAdvised: true,
    rating: 4.4,
    reviewCount: 2100,
    keywords: ["calcium", "vitamin d", "d3", "bone health", "osteoporosis"],
    image: {
      src: "/shop/supp-calcium-d3.webp",
      alt: "A white supplement tub against a pink background",
    },
    offers: [
      { retailer: "amazon", price: 749, listPrice: 999, inStock: true },
      { retailer: "nykaa", price: 799, inStock: true },
      { retailer: "instamart", price: 819, inStock: true },
    ],
  },
  {
    id: "supp-myo-inositol",
    title: "Myo-Inositol & D-Chiro-Inositol Powder",
    brand: "Carbamide Forte",
    category: "supplements",
    blurb: "Unflavoured inositol powder in a 40:1 myo to D-chiro ratio.",
    stages: ["not_applicable"],
    tracks: ["pcos"],
    clinicianAdvised: true,
    rating: 4.2,
    reviewCount: 1870,
    keywords: ["inositol", "myo inositol", "pcos supplement", "pcod", "insulin resistance"],
    image: {
      src: "/shop/supp-myo-inositol.webp",
      alt: "An open tub of unflavoured powder beside a measuring scoop",
    },
    offers: [
      { retailer: "amazon", price: 949, listPrice: 1999, inStock: true },
      { retailer: "flipkart", price: 1049, inStock: true },
    ],
  },
  {
    id: "supp-omega3",
    title: "Omega-3 with DHA (Algal, Vegetarian)",
    brand: "Unived",
    category: "supplements",
    blurb: "Algae-derived DHA capsules, a vegetarian alternative to fish-oil omega-3.",
    stages: ["pregnancy", "postpartum"],
    trimesters: [2, 3],
    clinicianAdvised: true,
    rating: 4.3,
    reviewCount: 640,
    keywords: ["omega 3", "dha", "fish oil alternative", "vegetarian omega"],
    image: {
      src: "/shop/supp-omega3.webp",
      alt: "Golden softgel capsules scattered on a pale surface",
    },
    offers: [
      { retailer: "amazon", price: 1299, inStock: true },
      { retailer: "brand", price: 1199, url: "https://www.unived.in/", inStock: true },
    ],
  },

  // ── Skin & body ──────────────────────────────────────────────────────────
  {
    id: "skin-stretch-oil",
    title: "Bio-Oil Skincare Oil",
    brand: "Bio-Oil",
    category: "skin-body",
    blurb: "Light body oil widely used on the bump and hips during and after pregnancy.",
    stages: ["pregnancy", "postpartum"],
    trimesters: [1, 2, 3],
    rating: 4.4,
    reviewCount: 41200,
    keywords: ["stretch marks", "bio oil", "body oil", "belly oil", "skin oil"],
    image: {
      src: "/shop/skin-stretch-oil.webp",
      alt: "An amber glass dropper bottle of oil in dappled light",
    },
    offers: [
      { retailer: "amazon", price: 649, listPrice: 900, inStock: true },
      { retailer: "nykaa", price: 675, listPrice: 900, inStock: true },
      { retailer: "flipkart", price: 699, inStock: true },
      { retailer: "blinkit", price: 699, listPrice: 900, inStock: true, delivery: "In 10–15 min" },
      { retailer: "instamart", price: 715, inStock: true },
    ],
  },
  {
    id: "skin-belly-butter",
    title: "Nourishing Belly Butter with Shea & Cocoa",
    brand: "The Moms Co.",
    category: "skin-body",
    blurb: "Thick body butter for the bump, fragrance-light and formulated for pregnancy use.",
    stages: ["pregnancy"],
    trimesters: [2, 3],
    rating: 4.3,
    reviewCount: 5300,
    keywords: ["belly butter", "stretch marks", "body butter", "bump cream", "moisturiser"],
    image: {
      src: "/shop/skin-belly-butter.webp",
      alt: "An open jar of thick white body butter",
    },
    offers: [
      { retailer: "amazon", price: 599, listPrice: 799, inStock: true },
      { retailer: "nykaa", price: 639, inStock: true },
      { retailer: "firstcry", price: 649, inStock: true },
      { retailer: "blinkit", price: 649, inStock: true },
    ],
  },
  {
    id: "skin-nipple-cream",
    title: "Lanolin Nipple Cream",
    brand: "Lansinoh",
    category: "skin-body",
    blurb: "Pure lanolin ointment for sore skin during early breastfeeding; no removal before a feed.",
    stages: ["postpartum"],
    rating: 4.5,
    reviewCount: 9800,
    keywords: ["nipple cream", "lanolin", "breastfeeding", "sore nipples", "cracked nipples"],
    image: {
      src: "/shop/skin-nipple-cream.webp",
      alt: "A plain white cream tube resting on a peach block",
    },
    offers: [
      { retailer: "amazon", price: 849, listPrice: 1100, inStock: true },
      { retailer: "firstcry", price: 899, inStock: true },
      { retailer: "blinkit", price: 929, inStock: false },
    ],
  },
  {
    id: "skin-pcos-face-wash",
    title: "Salicylic Acid Face Wash 2%",
    brand: "Minimalist",
    category: "skin-body",
    blurb: "Gentle salicylic acid cleanser for oily and congestion-prone skin.",
    stages: ["not_applicable"],
    tracks: ["pcos"],
    rating: 4.3,
    reviewCount: 12600,
    keywords: ["acne", "face wash", "salicylic acid", "pcos skin", "oily skin", "breakouts"],
    image: {
      src: "/shop/skin-pcos-face-wash.webp",
      alt: "A tube of gel facial cleanser standing on a pale surface",
    },
    offers: [
      { retailer: "amazon", price: 349, listPrice: 399, inStock: true },
      { retailer: "nykaa", price: 359, inStock: true },
      { retailer: "blinkit", price: 379, inStock: true },
      { retailer: "instamart", price: 389, inStock: true },
    ],
  },

  // ── Nursing & feeding ────────────────────────────────────────────────────
  {
    id: "feed-electric-pump",
    title: "Single Electric Breast Pump",
    brand: "Philips Avent",
    category: "nursing-feeding",
    blurb: "Electric pump with adjustable suction levels and a closed system.",
    stages: ["postpartum"],
    rating: 4.3,
    reviewCount: 3900,
    keywords: ["breast pump", "electric pump", "pumping", "expressing milk"],
    image: {
      src: "/shop/feed-electric-pump.webp",
      alt: "A pump bottle of expressed milk with a yellow lid",
    },
    offers: [
      { retailer: "amazon", price: 6499, listPrice: 9500, inStock: true },
      { retailer: "firstcry", price: 6899, listPrice: 9500, inStock: true },
      { retailer: "flipkart", price: 6750, inStock: false },
    ],
  },
  {
    id: "feed-nursing-pads",
    title: "Disposable Nursing Breast Pads (Pack of 100)",
    brand: "Mee Mee",
    category: "nursing-feeding",
    blurb: "Absorbent single-use pads worn inside the bra between feeds.",
    stages: ["postpartum"],
    rating: 4.2,
    reviewCount: 7100,
    keywords: ["nursing pads", "breast pads", "leaking", "feeding pads"],
    image: {
      src: "/shop/feed-nursing-pads.webp",
      alt: "A parent feeding a newborn, seen from above",
    },
    offers: [
      { retailer: "amazon", price: 449, listPrice: 699, inStock: true },
      { retailer: "firstcry", price: 425, listPrice: 699, inStock: true },
      { retailer: "blinkit", price: 499, inStock: true },
    ],
  },
  {
    id: "feed-storage-bags",
    title: "Pre-Sterilised Breast Milk Storage Bags",
    brand: "Lansinoh",
    category: "nursing-feeding",
    blurb: "Double-sealed freezer bags with a write-on panel for date and volume.",
    stages: ["postpartum"],
    rating: 4.4,
    reviewCount: 2400,
    keywords: ["milk storage bags", "breast milk bags", "freezer bags", "pumping"],
    image: {
      src: "/shop/feed-storage-bags.webp",
      alt: "A parent feeding a baby from a bottle of expressed milk",
    },
    offers: [
      { retailer: "amazon", price: 899, inStock: true },
      { retailer: "firstcry", price: 949, inStock: true },
    ],
  },

  // ── Monitoring ───────────────────────────────────────────────────────────
  {
    id: "mon-bp-monitor",
    title: "Automatic Upper-Arm Blood Pressure Monitor",
    brand: "Omron",
    category: "monitoring",
    blurb: "Clinically validated upper-arm BP monitor with cuff-position guidance and memory.",
    stages: ["pregnancy", "postpartum", "menopause", "not_applicable"],
    trimesters: [2, 3],
    rating: 4.4,
    reviewCount: 28700,
    keywords: ["bp monitor", "blood pressure", "preeclampsia", "bp machine", "hypertension"],
    image: {
      src: "/shop/mon-bp-monitor.webp",
      alt: "A digital blood pressure monitor with the cuff on an upper arm",
    },
    offers: [
      { retailer: "amazon", price: 1999, listPrice: 2790, inStock: true },
      { retailer: "flipkart", price: 2149, listPrice: 2790, inStock: true },
      { retailer: "brand", price: 2790, url: "https://www.omronhealthcare-ap.com/in", inStock: true },
    ],
  },
  {
    id: "mon-weighing-scale",
    title: "Digital Body Weighing Scale",
    brand: "Dr Trust",
    category: "monitoring",
    blurb: "Flat glass digital scale with 100g steps, for tracking a trend rather than a daily figure.",
    stages: ["pregnancy", "postpartum", "menopause", "not_applicable"],
    tracks: ["pcos"],
    rating: 4.1,
    reviewCount: 9400,
    keywords: ["weighing scale", "weight machine", "digital scale", "weight tracking"],
    image: {
      src: "/shop/mon-weighing-scale.webp",
      alt: "Bare feet standing on a flat white digital scale",
    },
    offers: [
      { retailer: "amazon", price: 1299, listPrice: 2499, inStock: true },
      { retailer: "flipkart", price: 1399, inStock: true },
    ],
  },
  {
    id: "mon-glucometer",
    title: "Blood Glucose Monitor Kit with 50 Strips",
    brand: "Accu-Chek",
    category: "monitoring",
    blurb: "Glucometer kit with lancing device and test strips, for use as directed by a clinician.",
    stages: ["pregnancy", "not_applicable"],
    trimesters: [2, 3],
    tracks: ["pcos", "pregnancy"],
    rating: 4.4,
    reviewCount: 16200,
    keywords: ["glucometer", "blood sugar", "gestational diabetes", "glucose monitor", "sugar test"],
    image: {
      src: "/shop/mon-glucometer.webp",
      alt: "A glucose meter with a lancing device and test strips",
    },
    offers: [
      { retailer: "amazon", price: 1749, listPrice: 2300, inStock: true },
      { retailer: "flipkart", price: 1825, inStock: true },
    ],
  },

  // ── Intimate care ────────────────────────────────────────────────────────
  {
    id: "care-maternity-pads",
    title: "Maternity Pads, Extra Long (Pack of 20)",
    brand: "Sirona",
    category: "intimate-care",
    blurb: "Extra-long, high-absorbency pads intended for the weeks after birth.",
    stages: ["postpartum"],
    rating: 4.2,
    reviewCount: 3100,
    keywords: ["maternity pads", "postpartum pads", "after delivery", "sanitary pads"],
    image: {
      src: "/shop/care-maternity-pads.webp",
      alt: "An extra-long sanitary pad and a wrapped spare on pink",
    },
    offers: [
      { retailer: "amazon", price: 399, listPrice: 549, inStock: true },
      { retailer: "nykaa", price: 419, inStock: true },
      { retailer: "firstcry", price: 435, inStock: true },
      { retailer: "blinkit", price: 429, inStock: true },
      { retailer: "instamart", price: 445, inStock: true },
    ],
  },
  {
    id: "care-intimate-wash",
    title: "pH-Balanced Intimate Wash",
    brand: "Sirona",
    category: "intimate-care",
    blurb: "Mild, fragrance-free external wash formulated to sit near intimate skin's natural pH.",
    stages: ["pregnancy", "postpartum", "menopause", "not_applicable"],
    rating: 4.1,
    reviewCount: 8600,
    keywords: ["intimate wash", "ph balanced", "feminine hygiene", "intimate hygiene"],
    image: {
      src: "/shop/care-intimate-wash.webp",
      alt: "A dark pump bottle of wash on a bathroom shelf",
    },
    offers: [
      { retailer: "amazon", price: 299, listPrice: 399, inStock: true },
      { retailer: "nykaa", price: 315, inStock: true },
      { retailer: "blinkit", price: 329, inStock: true },
      { retailer: "instamart", price: 339, inStock: true },
    ],
  },
  {
    id: "care-period-underwear",
    title: "Leak-Proof Period Underwear (Pack of 2)",
    brand: "Nua",
    category: "intimate-care",
    blurb: "Reusable absorbent underwear, machine-washable, for lighter days or backup.",
    stages: ["not_applicable", "postpartum"],
    tracks: ["pcos"],
    rating: 4.0,
    reviewCount: 1120,
    keywords: ["period underwear", "leak proof", "reusable", "periods", "menstrual"],
    image: {
      src: "/shop/care-period-underwear.webp",
      alt: "Folded underwear laid out on a white bed",
    },
    offers: [
      { retailer: "amazon", price: 1199, inStock: true },
      { retailer: "nykaa", price: 1249, inStock: true },
      { retailer: "brand", price: 1099, url: "https://nuawoman.com/", inStock: true },
    ],
  },

  // ── Baby essentials ──────────────────────────────────────────────────────
  {
    id: "baby-swaddle-set",
    title: "Muslin Swaddle Wraps (Pack of 3)",
    brand: "Mother Sparsh",
    category: "baby-essentials",
    blurb: "Breathable cotton muslin wraps, roughly 100 × 100 cm, that soften with washing.",
    stages: ["pregnancy", "postpartum"],
    trimesters: [3],
    rating: 4.4,
    reviewCount: 2900,
    keywords: ["swaddle", "muslin", "baby wrap", "newborn", "hospital bag"],
    image: {
      src: "/shop/baby-swaddle-set.webp",
      alt: "A newborn wrapped snugly in a white muslin swaddle",
    },
    offers: [
      { retailer: "amazon", price: 899, listPrice: 1299, inStock: true },
      { retailer: "firstcry", price: 949, inStock: true },
    ],
  },
  {
    id: "baby-water-wipes",
    title: "99% Water Baby Wipes (Pack of 3)",
    brand: "Mother Sparsh",
    category: "baby-essentials",
    blurb: "Plant-fibre wipes with a 99%-water formulation and no added fragrance.",
    stages: ["pregnancy", "postpartum"],
    trimesters: [3],
    rating: 4.3,
    reviewCount: 14100,
    keywords: ["baby wipes", "water wipes", "newborn", "nappy change", "hospital bag"],
    image: {
      src: "/shop/baby-water-wipes.webp",
      alt: "A stack of folded wipes on a blue background",
    },
    offers: [
      { retailer: "amazon", price: 549, listPrice: 747, inStock: true },
      { retailer: "firstcry", price: 519, listPrice: 747, inStock: true },
      { retailer: "flipkart", price: 575, inStock: true },
      { retailer: "blinkit", price: 585, inStock: true, delivery: "In 10–15 min" },
      { retailer: "instamart", price: 599, inStock: true },
    ],
  },
  {
    id: "baby-newborn-diapers",
    title: "Newborn Taped Diapers (Size NB, 72 count)",
    brand: "Pampers",
    category: "baby-essentials",
    blurb: "Taped newborn diapers with a wetness indicator and umbilical-cord notch.",
    stages: ["postpartum"],
    rating: 4.4,
    reviewCount: 32000,
    keywords: ["diapers", "newborn diapers", "nappies", "hospital bag"],
    image: {
      src: "/shop/baby-newborn-diapers.webp",
      alt: "A baby lying on a blue mat wearing a taped diaper",
    },
    offers: [
      { retailer: "amazon", price: 899, listPrice: 1099, inStock: true },
      { retailer: "firstcry", price: 869, listPrice: 1099, inStock: true },
      { retailer: "blinkit", price: 949, inStock: true },
      { retailer: "instamart", price: 969, inStock: true },
    ],
  },

  // ── Movement ─────────────────────────────────────────────────────────────
  {
    id: "move-birthing-ball",
    title: "Anti-Burst Birthing / Exercise Ball with Pump",
    brand: "Boldfit",
    category: "movement",
    blurb: "65 cm anti-burst gym ball, the size usually suggested for average height, with a hand pump.",
    stages: ["pregnancy", "postpartum"],
    trimesters: [2, 3],
    rating: 4.3,
    reviewCount: 11800,
    keywords: ["birthing ball", "exercise ball", "gym ball", "yoga ball", "labour"],
    image: {
      src: "/shop/move-birthing-ball.webp",
      alt: "A person stretching backwards over a large exercise ball",
    },
    offers: [
      { retailer: "amazon", price: 799, listPrice: 1499, inStock: true },
      { retailer: "flipkart", price: 849, inStock: true },
    ],
  },
  {
    id: "move-yoga-mat",
    title: "Non-Slip Yoga Mat, 6 mm",
    brand: "Boldfit",
    category: "movement",
    blurb: "Cushioned 6 mm TPE mat with a textured, non-slip surface.",
    stages: ["pregnancy", "postpartum", "menopause", "not_applicable"],
    tracks: ["pcos"],
    rating: 4.2,
    reviewCount: 22400,
    keywords: ["yoga mat", "exercise mat", "prenatal yoga", "workout mat"],
    image: {
      src: "/shop/move-yoga-mat.webp",
      alt: "Two rolled yoga mats standing on a wooden floor",
    },
    offers: [
      { retailer: "amazon", price: 699, listPrice: 1499, inStock: true },
      { retailer: "flipkart", price: 749, inStock: true },
    ],
  },
  {
    id: "move-resistance-bands",
    title: "Resistance Loop Bands (Set of 5)",
    brand: "Fitsy",
    category: "movement",
    blurb: "Fabric loop bands in five tensions, for low-impact strength work at home.",
    stages: ["postpartum", "menopause", "not_applicable"],
    tracks: ["pcos"],
    rating: 4.1,
    reviewCount: 6700,
    keywords: ["resistance bands", "loop bands", "strength training", "home workout"],
    image: {
      src: "/shop/move-resistance-bands.webp",
      alt: "An orange resistance band beside dumbbells on wood",
    },
    offers: [
      { retailer: "amazon", price: 549, listPrice: 999, inStock: true },
      { retailer: "flipkart", price: 599, inStock: false },
    ],
  },
];

/** Look one product up by id. */
export const findProduct = (id: string): ShopProduct | undefined =>
  SHOP_CATALOGUE.find((p) => p.id === id);

/** Category metadata by id, for labels and blurbs. */
export const categoryLabel = (id: ShopCategory): string =>
  SHOP_CATEGORIES.find((c) => c.id === id)?.label ?? id;
