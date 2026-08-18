// Translation dictionaries and the language catalogue.
//
// Two layers work together, and the split matters:
//
// 1. **This file** — a hand-written dictionary for the app *chrome*
//    (navigation, settings, profile labels, shared actions). It is exact,
//    instant and works offline, so the parts of the UI a user navigates by
//    never depend on the network.
// 2. **`src/i18n/pageTranslator.ts`** — a runtime translator that walks the
//    live DOM and machine-translates everything else, in any of the languages
//    below. That is what makes the *whole* site multilingual rather than just
//    the menus.
//
// Layer 1 is consulted first (by exact English string as well as by key), so
// where a curated phrase exists it wins over the machine one.

export type LanguageCode =
  // Indian languages
  | "en"
  | "hi"
  | "mr"
  | "gu"
  | "bn"
  | "ta"
  | "te"
  | "kn"
  | "ml"
  | "pa"
  | "or"
  | "as"
  | "ur"
  | "sa"
  | "ne"
  // International
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "ru"
  | "ar"
  | "zh-CN"
  | "ja"
  | "ko"
  | "id"
  | "sw";

export interface LanguageOption {
  code: LanguageCode;
  /** Shown in the picker, in the language itself. */
  label: string;
  /** The same name in English, so the picker is readable in any script. */
  englishLabel: string;
  /**
   * True when this file carries a hand-written dictionary for the chrome.
   * Everything else is machine-translated at runtime; the picker says so
   * rather than pretending the two are the same quality.
   */
  curated: boolean;
  /** Right-to-left script — the document direction follows it. */
  rtl?: boolean;
  /** Which region this language is grouped under in the picker. */
  group: "India" | "International";
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", englishLabel: "English", curated: true, group: "India" },
  { code: "hi", label: "हिंदी", englishLabel: "Hindi", curated: true, group: "India" },
  { code: "mr", label: "मराठी", englishLabel: "Marathi", curated: false, group: "India" },
  { code: "gu", label: "ગુજરાતી", englishLabel: "Gujarati", curated: false, group: "India" },
  { code: "bn", label: "বাংলা", englishLabel: "Bengali", curated: false, group: "India" },
  { code: "ta", label: "தமிழ்", englishLabel: "Tamil", curated: false, group: "India" },
  { code: "te", label: "తెలుగు", englishLabel: "Telugu", curated: false, group: "India" },
  { code: "kn", label: "ಕನ್ನಡ", englishLabel: "Kannada", curated: false, group: "India" },
  { code: "ml", label: "മലയാളം", englishLabel: "Malayalam", curated: false, group: "India" },
  { code: "pa", label: "ਪੰਜਾਬੀ", englishLabel: "Punjabi", curated: false, group: "India" },
  { code: "or", label: "ଓଡ଼ିଆ", englishLabel: "Odia", curated: false, group: "India" },
  { code: "as", label: "অসমীয়া", englishLabel: "Assamese", curated: false, group: "India" },
  { code: "ur", label: "اردو", englishLabel: "Urdu", curated: false, rtl: true, group: "India" },
  { code: "sa", label: "संस्कृतम्", englishLabel: "Sanskrit", curated: false, group: "India" },
  { code: "ne", label: "नेपाली", englishLabel: "Nepali", curated: false, group: "India" },
  { code: "es", label: "Español", englishLabel: "Spanish", curated: false, group: "International" },
  { code: "fr", label: "Français", englishLabel: "French", curated: false, group: "International" },
  { code: "de", label: "Deutsch", englishLabel: "German", curated: false, group: "International" },
  { code: "pt", label: "Português", englishLabel: "Portuguese", curated: false, group: "International" },
  { code: "ru", label: "Русский", englishLabel: "Russian", curated: false, group: "International" },
  { code: "ar", label: "العربية", englishLabel: "Arabic", curated: false, rtl: true, group: "International" },
  { code: "zh-CN", label: "中文（简体）", englishLabel: "Chinese (Simplified)", curated: false, group: "International" },
  { code: "ja", label: "日本語", englishLabel: "Japanese", curated: false, group: "International" },
  { code: "ko", label: "한국어", englishLabel: "Korean", curated: false, group: "International" },
  { code: "id", label: "Bahasa Indonesia", englishLabel: "Indonesian", curated: false, group: "International" },
  { code: "sw", label: "Kiswahili", englishLabel: "Swahili", curated: false, group: "International" },
];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export const isLanguageCode = (value: unknown): value is LanguageCode =>
  LANGUAGES.some((l) => l.code === value);

export const findLanguage = (code: LanguageCode): LanguageOption | undefined =>
  LANGUAGES.find((l) => l.code === code);

/** Every translatable key. English doubles as the fallback. */
const en = {
  // --- navigation ---------------------------------------------------------
  "nav.mainMenu": "Main Menu",
  "nav.more": "More",
  "nav.account": "Account",
  "nav.dashboard": "Dashboard",
  "nav.today": "Today",
  "nav.myPlan": "My Plan",
  "nav.plan": "Plan",
  "nav.consultDoctor": "Consult Doctor",
  "nav.mealLogging": "Meal Logging",
  "nav.myKitchen": "My Kitchen",
  "nav.foodCompatibility": "Food Compatibility",
  "nav.healthCheck": "Health Check",
  "nav.lifestyleTracker": "Lifestyle Tracker",
  "nav.lifestyle": "Lifestyle",
  "nav.cycleSkin": "Cycle & Skin",
  "nav.shop": "Shop",
  "nav.community": "Community",
  "nav.reminders": "Reminders",
  "nav.tracker": "Tracker",
  "nav.profile": "Profile",
  "nav.settings": "Settings",
  "nav.settingsLogout": "Settings & Logout",
  "nav.logout": "Logout",
  "nav.patients": "Patients",
  "nav.addPatient": "Add Patient",
  "nav.patientAnalysis": "Patient Analysis",
  "nav.foodExplorer": "Food Explorer",
  "nav.recipeBuilder": "Recipe Builder",
  "nav.dietCharts": "Diet Charts",

  // --- shared actions -----------------------------------------------------
  "action.save": "Save",
  "action.saving": "Saving…",
  "action.cancel": "Cancel",
  "action.edit": "Edit",
  "action.delete": "Delete",
  "action.close": "Close",
  "action.retry": "Retry",
  "action.saveChanges": "Save Changes",

  // --- settings -----------------------------------------------------------
  "settings.title": "Settings",
  "settings.subtitle": "Manage your account preferences and privacy",
  "settings.notifications": "Notifications",
  "settings.notifications.desc": "Choose what you want to be told about",
  "settings.notif.meal": "Meal reminders",
  "settings.notif.meal.desc": "Reminders at your usual meal times",
  "settings.notif.medicine": "Medicine reminders",
  "settings.notif.medicine.desc": "Reminders to take your prescribed medicines",
  "settings.notif.appointment": "Appointment reminders",
  "settings.notif.appointment.desc": "Before an upcoming consultation",
  "settings.notif.weekly": "Weekly reports",
  "settings.notif.weekly.desc": "A summary of your week, every Sunday",
  "settings.notif.newRequest": "New consultation requests",
  "settings.notif.newRequest.desc": "When a patient asks to consult you",
  "settings.notif.patientAlerts": "Patient alerts",
  "settings.notif.patientAlerts.desc": "When a patient's adherence or risk changes",
  "settings.notif.schedule": "Schedule changes",
  "settings.notif.schedule.desc": "When an appointment is booked or cancelled",

  "settings.preferences": "App Preferences",
  "settings.preferences.desc": "Customize your app experience",
  "settings.language": "Preferred Language",
  "settings.language.desc":
    "Changes the whole app, on every page. Menus and settings use hand-checked wording; everything else is translated automatically as you browse.",
  "settings.language.curated": "hand-checked",
  "settings.language.translating": "Translating this page…",
  "settings.theme": "Theme",
  "settings.theme.light": "Light",
  "settings.theme.dark": "Dark",
  "settings.theme.system": "System",
  "settings.timezone": "Timezone",

  "settings.privacy": "Privacy",
  "settings.privacy.desc": "Control who sees what",
  "settings.privacy.shareDoctor": "Share my data with my doctor",
  "settings.privacy.shareDoctor.desc":
    "Lets your treating doctor see your logs and screening results",
  "settings.privacy.analytics": "Allow anonymous analytics",
  "settings.privacy.analytics.desc": "Helps improve the app; never includes health data",
  "settings.privacy.onlineStatus": "Show my online status",
  "settings.privacy.onlineStatus.desc": "Others can see when you are active",
  "settings.privacy.directory": "List me in the doctor directory",
  "settings.privacy.directory.desc": "Patients can find and request a consultation with you",

  "settings.appearance": "Appearance",
  "settings.appearance.desc": "How the app looks on this device",

  "settings.account": "Account",
  "settings.account.desc": "Your data, your session and your account",
  "settings.logout": "Log out",
  "settings.logout.desc": "Sign out of Prakriva on this device",
  "settings.logout.confirm": "Log out of Prakriva?",
  "settings.logout.confirmDesc":
    "You will need to sign in again to see your plan, your logs and your reminders.",
  "settings.export": "Export my data",
  "settings.export.desc": "Download everything stored about you as a JSON file",
  "settings.delete": "Delete my account",
  "settings.delete.desc": "This cannot be undone",
  "settings.saved": "Settings saved",
  "settings.savedLocal": "Saved on this device",
  "settings.savedLocal.desc": "We couldn't reach the server, so this is not synced yet.",
  "settings.saveFailed": "Could not save settings",

  // --- profile ------------------------------------------------------------
  "profile.title": "Profile",
  "profile.photo": "Profile photo",
  "profile.photo.desc": "Shown next to your name across the app",
  "profile.personalInfo": "Personal Information",
  "profile.name": "Name",
  "profile.email": "Email",
  "profile.phone": "Phone",
  "profile.notProvided": "Not provided",
  "profile.specialization": "Specialization",
  "profile.qualification": "Qualification",
  "profile.experience": "Experience",
  "profile.clinic": "Clinic",
  "profile.registration": "Registration",
  "profile.verification": "Verification",
  "profile.verified": "Verified",
  "profile.pending": "Pending verification",
  "profile.years": "years",
  "profile.loadFailed": "Could not load your profile",
} as const;

export type TranslationKey = keyof typeof en;

/**
 * Hindi. Keys absent here fall back to English rather than rendering blank —
 * a missing translation should degrade to readable, not to empty.
 */
const hi: Partial<Record<TranslationKey, string>> = {
  "nav.mainMenu": "मुख्य मेन्यू",
  "nav.more": "और",
  "nav.account": "खाता",
  "nav.dashboard": "डैशबोर्ड",
  "nav.today": "आज",
  "nav.myPlan": "मेरी योजना",
  "nav.plan": "योजना",
  "nav.consultDoctor": "डॉक्टर से परामर्श",
  "nav.mealLogging": "भोजन लॉग",
  "nav.myKitchen": "मेरी रसोई",
  "nav.foodCompatibility": "भोजन अनुकूलता",
  "nav.healthCheck": "स्वास्थ्य जाँच",
  "nav.lifestyleTracker": "जीवनशैली ट्रैकर",
  "nav.lifestyle": "जीवनशैली",
  "nav.cycleSkin": "चक्र और त्वचा",
  "nav.shop": "दुकान",
  "nav.community": "समुदाय",
  "nav.reminders": "अनुस्मारक",
  "nav.tracker": "ट्रैकर",
  "nav.profile": "प्रोफ़ाइल",
  "nav.settings": "सेटिंग्स",
  "nav.settingsLogout": "सेटिंग्स और लॉग आउट",
  "nav.logout": "लॉग आउट",
  "nav.patients": "मरीज़",
  "nav.addPatient": "मरीज़ जोड़ें",
  "nav.patientAnalysis": "मरीज़ विश्लेषण",
  "nav.foodExplorer": "भोजन खोज",
  "nav.recipeBuilder": "रेसिपी बिल्डर",
  "nav.dietCharts": "आहार चार्ट",

  "action.save": "सहेजें",
  "action.saving": "सहेजा जा रहा है…",
  "action.cancel": "रद्द करें",
  "action.edit": "संपादित करें",
  "action.delete": "हटाएँ",
  "action.close": "बंद करें",
  "action.retry": "पुनः प्रयास करें",
  "action.saveChanges": "परिवर्तन सहेजें",

  "settings.title": "सेटिंग्स",
  "settings.subtitle": "अपने खाते की प्राथमिकताएँ और निजता प्रबंधित करें",
  "settings.notifications": "सूचनाएँ",
  "settings.notifications.desc": "चुनें कि आपको किस बारे में बताया जाए",
  "settings.notif.meal": "भोजन अनुस्मारक",
  "settings.notif.meal.desc": "आपके सामान्य भोजन समय पर अनुस्मारक",
  "settings.notif.medicine": "दवा अनुस्मारक",
  "settings.notif.medicine.desc": "निर्धारित दवाएँ लेने के अनुस्मारक",
  "settings.notif.appointment": "अपॉइंटमेंट अनुस्मारक",
  "settings.notif.appointment.desc": "आगामी परामर्श से पहले",
  "settings.notif.weekly": "साप्ताहिक रिपोर्ट",
  "settings.notif.weekly.desc": "हर रविवार आपके सप्ताह का सारांश",
  "settings.notif.newRequest": "नए परामर्श अनुरोध",
  "settings.notif.newRequest.desc": "जब कोई मरीज़ आपसे परामर्श माँगे",
  "settings.notif.patientAlerts": "मरीज़ अलर्ट",
  "settings.notif.patientAlerts.desc": "जब किसी मरीज़ का पालन या जोखिम बदले",
  "settings.notif.schedule": "समय-सारणी परिवर्तन",
  "settings.notif.schedule.desc": "जब कोई अपॉइंटमेंट बुक या रद्द हो",

  "settings.preferences": "ऐप प्राथमिकताएँ",
  "settings.preferences.desc": "अपने ऐप अनुभव को अनुकूलित करें",
  "settings.language": "पसंदीदा भाषा",
  "settings.language.desc":
    "यह पूरे ऐप की भाषा बदलता है, हर पेज पर। मेन्यू और सेटिंग्स की शब्दावली जाँची हुई है; बाकी सामग्री ब्राउज़ करते समय स्वतः अनुवादित होती है।",
  "settings.language.curated": "जाँचा हुआ",
  "settings.language.translating": "इस पेज का अनुवाद हो रहा है…",
  "settings.theme": "थीम",
  "settings.theme.light": "हल्का",
  "settings.theme.dark": "गहरा",
  "settings.theme.system": "सिस्टम",
  "settings.timezone": "समय क्षेत्र",

  "settings.privacy": "निजता",
  "settings.privacy.desc": "नियंत्रित करें कि कौन क्या देखे",
  "settings.privacy.shareDoctor": "मेरा डेटा मेरे डॉक्टर के साथ साझा करें",
  "settings.privacy.shareDoctor.desc":
    "आपके इलाज करने वाले डॉक्टर को आपके लॉग और जाँच परिणाम दिखते हैं",
  "settings.privacy.analytics": "गुमनाम विश्लेषण की अनुमति दें",
  "settings.privacy.analytics.desc":
    "ऐप सुधारने में मदद करता है; इसमें स्वास्थ्य डेटा कभी शामिल नहीं होता",
  "settings.privacy.onlineStatus": "मेरी ऑनलाइन स्थिति दिखाएँ",
  "settings.privacy.onlineStatus.desc": "दूसरे देख सकते हैं कि आप कब सक्रिय हैं",
  "settings.privacy.directory": "मुझे डॉक्टर निर्देशिका में सूचीबद्ध करें",
  "settings.privacy.directory.desc": "मरीज़ आपको ढूँढ़कर परामर्श का अनुरोध कर सकते हैं",

  "settings.account": "खाता",
  "settings.account.desc": "आपका डेटा, आपका सत्र और आपका खाता",
  "settings.appearance": "रूप-रंग",
  "settings.appearance.desc": "इस डिवाइस पर ऐप कैसा दिखे",
  "settings.logout": "लॉग आउट",
  "settings.logout.desc": "इस डिवाइस पर प्रकृवा से साइन आउट करें",
  "settings.logout.confirm": "प्रकृवा से लॉग आउट करें?",
  "settings.logout.confirmDesc":
    "अपनी योजना, लॉग और अनुस्मारक देखने के लिए आपको फिर से साइन इन करना होगा।",
  "settings.export": "मेरा डेटा निर्यात करें",
  "settings.export.desc": "आपके बारे में संग्रहीत सब कुछ JSON फ़ाइल में डाउनलोड करें",
  "settings.delete": "मेरा खाता हटाएँ",
  "settings.delete.desc": "इसे वापस नहीं लिया जा सकता",
  "settings.saved": "सेटिंग्स सहेजी गईं",
  "settings.savedLocal": "इस डिवाइस पर सहेजा गया",
  "settings.savedLocal.desc": "हम सर्वर तक नहीं पहुँच सके, इसलिए यह अभी सिंक नहीं हुआ है।",
  "settings.saveFailed": "सेटिंग्स सहेजी नहीं जा सकीं",

  "profile.title": "प्रोफ़ाइल",
  "profile.photo": "प्रोफ़ाइल फ़ोटो",
  "profile.photo.desc": "पूरे ऐप में आपके नाम के साथ दिखती है",
  "profile.personalInfo": "व्यक्तिगत जानकारी",
  "profile.name": "नाम",
  "profile.email": "ईमेल",
  "profile.phone": "फ़ोन",
  "profile.notProvided": "उपलब्ध नहीं",
  "profile.specialization": "विशेषज्ञता",
  "profile.qualification": "योग्यता",
  "profile.experience": "अनुभव",
  "profile.clinic": "क्लिनिक",
  "profile.registration": "पंजीकरण",
  "profile.verification": "सत्यापन",
  "profile.verified": "सत्यापित",
  "profile.pending": "सत्यापन लंबित",
  "profile.years": "वर्ष",
  "profile.loadFailed": "आपकी प्रोफ़ाइल लोड नहीं हो सकी",
};

export const DICTIONARIES: Partial<Record<LanguageCode, Partial<Record<TranslationKey, string>>>> = {
  en,
  hi,
};

/** Translate `key`, falling back to English, then to the key itself. */
export const translate = (language: LanguageCode, key: TranslationKey): string =>
  DICTIONARIES[language]?.[key] ?? en[key] ?? key;

/**
 * The curated dictionary as an English-phrase → translation map.
 *
 * The runtime page translator sees rendered text, not keys, so this is how a
 * hand-written phrase gets to win over the machine translation of the same
 * words. Keys whose English value is duplicated are fine — they translate to
 * the same thing by construction.
 */
export const curatedPhrases = (
  language: LanguageCode
): Record<string, string> => {
  const dictionary = DICTIONARIES[language];
  if (!dictionary || language === DEFAULT_LANGUAGE) return {};

  const phrases: Record<string, string> = {};
  (Object.keys(en) as TranslationKey[]).forEach((key) => {
    const translated = dictionary[key];
    if (translated) phrases[en[key]] = translated;
  });
  return phrases;
};
