# Prakriva

An Ayurvedic diet/wellness planning app connecting doctors and patients. Doctors
manage patients, build recipes and diet charts, review dosha/consultation
data, and run maternal disease-risk screening for their pregnant patients;
patients complete an Ayurvedic health questionnaire, list the foods in their
kitchen, and get a personalized diet plan.

## Tech stack

- **Frontend**: React + TypeScript + Vite, shadcn/ui + Radix + Tailwind CSS,
  React Router.
- **Backend**: Python/Flask API providing dosha estimation, calorie
  calculation, meal planning, plan storage, and the maternal disease detection
  pipeline (XGBoost anaemia + pregnancy-risk, GDM and preeclampsia logistic
  regressions, and a thyroid neural network — all run in numpy).
- **Supabase**: Postgres database + auth, using row-level security.
- **Tests**: Vitest + React Testing Library (frontend, jsdom), pytest
  (backend).
- **Deployment**: the frontend deploys to **Vercel** (Root Directory = repo
  root, Vite framework preset) and the Flask backend deploys to **Render** from
  the committed `render.yaml` blueprint. The frontend reaches the backend via
  `VITE_API_URL`. See "Deployment" below.

## Project structure

- `src/` — frontend. Routes are split into `patient/` and `doctor/` areas
  (`src/pages/patient`, `src/pages/doctor`) behind `PatientLayout` /
  `DoctorLayout`. App-wide state lives in `src/context` (`AppContext`,
  `FoodContext`). Data access to Supabase and other APIs lives in
  `src/services` and `src/lib`. Shared TypeScript types live in `src/types/`.
- `src/components/ui/logo.tsx` — the `Logo` component wrapping `public/logo.png`
  at four sizes (`sm`/`md`/`lg`/`xl`). Use it instead of hand-rolled brand
  markup; the artwork already contains the "Prakriva" wordmark, so don't pair it
  with the name in text (pass `alt=""` where nearby copy names the brand). It
  appears on the landing hero, the auth card, both sidebars, and the mobile
  header of both layouts.
- `src/pages/Landing.tsx` + `src/components/landing/` — the public marketing
  page at `/`. `Landing.tsx` only composes the sections; each one owns its own
  layout and motion: `LandingNav` (floating glass navbar), `Hero` (full-screen
  editorial hero over drifting blush colour fields), `CareSection` (the
  product's real features), `AssistantSection` (glassmorphism still of the
  in-app AI assistant), `CommunitySection` (stats + testimonials),
  `PractitionerSection` (the doctor pitch) and `LandingFooter`. Every call to
  action lands on `/auth/patient` or `/auth/doctor`. See "Landing page" below.
- `src/components/settings/SettingsScreen.tsx` — the Settings screen shared by
  `src/pages/patient/Settings.tsx` and `src/pages/doctor/DoctorSettings.tsx`;
  the pages supply only their role's notification and privacy rows. See
  "Theme, language and settings" below.
- `src/hooks/useReveal.ts` — `useReveal` (IntersectionObserver scroll-reveal for
  `.reveal` elements) and `useParallaxLayer` (scroll-linked drift written
  straight to the node). Both no-op under `prefers-reduced-motion`.
- `src/pages/auth/` — the combined sign-in / sign-up screen mounted at
  `/auth/:role`, split by layer:
  - `Login.tsx` — form state and orchestration for both roles.
  - `AccountFields.tsx` — the name/email/password fields, shared by the
    patient form and step 1 of the doctor wizard.
  - `DoctorSignupSteps.tsx` — the four-step doctor wizard (account, license,
    expertise, practice), with its option lists in `doctorProfileOptions.ts`.
  - Auth calls live in `src/services/authService.ts`; license formats,
    the registry lookup and profile scoring in `src/lib/licenseVerification.ts`.
- `src/test/` — Vitest setup (`setup.ts`) and the Supabase client mock
  (`supabaseMock.ts`) shared across frontend tests. Tests themselves sit in
  `__tests__/` folders next to the code they cover.
- `backend/` — Flask API (`app.py`) providing dosha estimation
  (`dosha_estimator.py`, `dosha_model.pkl`), calorie calculation
  (`calorie_calculator.py`), meal planning (`planner.py`), and dataset/DB
  access (`dataset_loader.py`, `db.py`). Config comes from `config.py` and
  `backend/.env` (see `backend/.env.example`).
- `backend/disease_detection/` — the maternal disease detection pipeline:
  input/output models (`schemas.py`), the rule-based baseline detectors
  (`rules.py`), clinical next steps (`recommendations.py`) and the detector
  registry (`pipeline.py`). The `ml/` subpackage holds the XGBoost anaemia +
  pregnancy-risk models, their shared feature transform (`featurize.py`),
  inference (`inference.py`), detectors (`detectors.py`) and the training script
  (`train_maternal_models.py`), plus the GDM logistic regression
  (`gdm_featurize.py`, `train_gdm_model.py`, `gdm_model.json`) and the thyroid
  network (`thyroid_featurize.py`, `convert_thyroid_model.py`,
  `thyroid_model.npz`) and the preeclampsia logistic regression
  (`preeclampsia_featurize.py`, `convert_preeclampsia_model.py`,
  `preeclampsia_model.json`). See "Disease detection" below.
- `render.yaml` — Render blueprint for deploying the Flask backend.
- `supabase/` — SQL migrations for the Supabase project, including
  `disease_screenings.sql` for the screening history table,
  `lifestyle_logs.sql` for the Lifestyle Tracker's daily sleep/activity/
  hydration log and `patient_pantry_items.sql` for the patient kitchen list.
- `src/components/patients/` — shared patient-selection UI:
  `PatientPicker.tsx` (searchable dropdown over the signed-in doctor's own
  patients, by name or patient code) and `PatientPantryPanel.tsx` (the doctor's
  read-only view of a patient's kitchen). Both are backed by
  `src/hooks/useDoctorPatients.ts`.
- `src/pages/doctor/RecipeBuilder.tsx` — one screen that combines dosha-based
  generation with hand editing. Picking a patient shows their dosha profile,
  nutritional targets and restrictions (via `dietChartService.ts`); hitting
  Generate calls the FoodOScope API and drops the resulting days straight into
  the same drag-and-drop Daily/Weekly board used for building a plan by hand,
  so the doctor can rearrange or leave it as-is before saving. Loading an
  existing saved plan for editing (from the Diet Chart viewer's Edit button,
  `?editPlanId=&patientId=`) populates the same board.
- `src/lib/localCache.ts` + `src/hooks/usePersistentState.ts` — the
  localStorage cache that keeps in-progress work (meal-plan drafts, the food
  palette, a generated diet chart, the selected patient) across a page refresh.
  See "Caching" below.
- `src/index.css` — the design system: shadcn/Tailwind CSS variables
  (`--primary`, `--secondary`, `--accent`, `--sidebar-*`, gradients) in the
  Prakriva brand palette (deep maroon/burgundy on warm cream, matching
  `public/logo.png`). Dosha colors (`--vata`/`--pitta`/`--kapha`) and status
  colors (`--success`/`--warning`/`--info`) now sit **inside** that palette
  too — see "Color" below.
- `src/lib/chartColors.ts` — the palette for Recharts, which takes raw color
  strings and so can't use Tailwind classes.
- `public/` — static assets served as-is: `logo.png` (the Prakriva brand mark,
  also used as the browser-tab favicon and the social preview image) and the
  standalone `mealCompatibility.html` "Food Compatibility" tool (Ayurvedic
  viruddha ahara / incompatible-combination checker). It is served directly at
  `/mealCompatibility.html`, and the patient **Food Compatibility** page
  (`/patient/food-compatibility`, `src/pages/patient/FoodCompatibility.tsx`)
  embeds it in an iframe so it is reachable from the patient sidebar.
- `vercel.json` — frontend-only: Vite framework preset builds to `dist/`,
  with a catch-all rewrite to `index.html` for client-side routing.

## Getting started

Frontend (run from repo root):

- `npm install`
- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run build:dev` — development-mode build
- `npm run lint` — ESLint
- `npm run preview` — preview a production build
- `npm run test` — run the Vitest suite once
- `npm run test:watch` — re-run tests on change
- `npm run test:coverage` — run with a V8 coverage report into `coverage/`

npm is the supported package manager; `package-lock.json` is the lockfile of
record.

Backend (run from `/backend`):

- `pip install -r requirements.txt` (add `-r requirements-dev.txt` for pytest)
- `python run.py` or `python app.py` — start the Flask API
- `python -m pytest tests/` — run the backend suite. `backend/tests/conftest.py`
  supplies placeholder Supabase credentials, so this needs no `.env` and makes
  no network calls.

## Testing

Frontend tests run under Vitest in a jsdom environment, configured in
`vitest.config.ts` (kept separate from `vite.config.ts` so the dev/build
config stays free of test concerns). `src/test/setup.ts` loads the
jest-dom matchers and shims the browser APIs Radix UI relies on
(`ResizeObserver`, `matchMedia`, pointer capture), which jsdom does not
implement.

Coverage is focused on authentication, since that is the gate on both roles:

- `src/lib/__tests__/licenseVerification.test.ts` — license number formats per
  medical council, the registry lookup, profile scoring and badge tiers.
- `src/services/__tests__/authService.test.ts` — signup metadata for each role,
  role lookup with retries, post-auth routing, and Supabase error mapping.
- `src/pages/auth/__tests__/Login.test.tsx` — the rendered screen for both
  roles: patient sign-in and sign-up, doctor sign-in, and the full four-step
  doctor sign-up wizard including license verification.
- `src/services/__tests__/diseaseDetectionService.test.ts` — the questionnaire →
  screening-form mapping, the screening API client, and the Supabase read/write
  of stored screenings (including the missing-table fallback).
- `src/services/__tests__/pantryService.test.ts` — the pantry row ↔ item
  mapping, insert defaults, error propagation and ingredient deduplication.
- `src/services/__tests__/foodoscopeApi.test.ts` — the ingredient recipe search,
  including a 404 (no recipe matches every ingredient) reading as an empty
  result rather than a failure.
- `src/data/__tests__/ingredients.test.ts` — bundled catalogue invariants:
  unique labels, known categories, normalized search terms and alias lookup.
- `src/services/__tests__/ingredientCatalogService.test.ts` — building the
  vocabulary from the API: frequency ordering, de-duplication across
  categories, alias carry-over, the merged staples, the offline fallback and
  the week-long cache.
- `src/lib/__tests__/localCache.test.ts` — the localStorage cache: namespacing,
  expiry, corrupted-entry handling and prefix clearing.

On the backend, `backend/tests/test_disease_detection.py` covers input
validation, each rule-based detector, the detector registry (including swapping
a detector out) and the `/disease/*` endpoints.

Supabase is mocked at the client boundary (`src/test/supabaseMock.ts`), so the
real auth and license logic runs in tests; no test touches a live project.

## Patient profile

The profile is filled in once, at `/patient/questionnaire`
(`src/pages/patient/Questionnaire.tsx`), and read back at `/patient/profile`
(`src/pages/patient/PatientProfile.tsx`). Both use the same `assessment_data`
JSON column on `patients`.

**It asks only for things that do not change over time.** Anything that varies
week to week belongs in the trackers, not in a one-off form, so it is
deliberately not collected here. What the profile stores:

| Group | Fields |
|---|---|
| Personal | `name`, `dob` (age is derived, never stored), `gender`, `location`, `heightCm` |
| Maternal (once) | `lifeStage` (`pregnancy`/`none`), `dueDate` (estimated due date) |
| Allergies & avoidances | `allergies`, `allergiesOther`, `foodAvoidances` |
| Dietary pattern | `dietaryPreferences` |
| Family history | `familyHistory`, `familyHistoryOther` |
| Prakriti (fixed at birth) | `bodyFrame`, `skinType`, `hairType`, `appetitePattern`, `personalityTraits`, `weatherPreference` |
| Notes | `additionalNotes` |

Fields the profile no longer collects, because they change over time:
`stressLevels`, `energyLevels`, `waterIntake`, `sleepDuration`,
`physicalActivity`, `dailyRoutine`, `cravings`, `digestionIssues`,
`currentConditions`, `medications`, `labReports`, `healthGoals`,
`mealPrepTime`, `budgetPreference`, `pregnancyTrimester`, `isBreastfeeding` and
`menopauseStage`. (`lifeStage` and `dueDate` *are* collected — they are one-off
maternal facts; the current gestational week is derived from `dueDate` at
screening time rather than stored.)

Readers of `assessment_data` treat it as free-form `jsonb` and read every field
defensively, so profiles saved before this change keep working and any absent
keys simply read as absent. Worth knowing:

- Features gated on `lifeStage === "pregnancy"` — the patient Health Check page
  and the doctor's pregnant-patient list — read it from the onboarding
  questionnaire. If a profile predates life-stage capture, the Health Check page
  shows an inline setup card (confirm pregnancy + optional due date/height) that
  writes the value straight into `assessment_data`, so patients don't have to
  re-do the whole questionnaire. See "Disease detection" below.
- `buildScreeningInputFromAssessment` prefills age, gestational week (from
  `dueDate`), trimester and history; labs and today's measurements stay blank
  for the patient or doctor to enter.

## Disease detection

Screens a pregnant patient for eight maternal risks — anaemia, an overall
**pregnancy risk**, gestational diabetes, preeclampsia, UTI, thyroid disorder,
miscarriage risk and perinatal mental health. Each comes back with a 0-100 risk
score, a low/moderate/high level, the factors that drove it, and next steps.

Five conditions are scored by trained models (see "Trained models" below) —
anaemia and pregnancy risk by **XGBoost**, gestational diabetes and preeclampsia
by **logistic regressions**, thyroid disorder by a **neural network** — and the
remaining three by the rule-based scorers.
Because every detector shares the same `(ScreeningInput) -> ConditionRisk`
contract, the two kinds mix transparently and `ConditionRisk.detector` records
which one answered.

The form is split across the two roles, because the two halves come from
different places:

- **Patient → Health Check** (`/patient/health-check`) — asks only for the three
  trained models' inputs, in three cards: **measurements** (weeks pregnant,
  weight → BMI using the height captured at onboarding, haemoglobin, blood
  pressure, iron supplements), **blood test results** (HbA1c, HDL,
  triglycerides — all optional), **blood pressure & scan** (fetal weight,
  amniotic fluid, urine protein, hypertension and diabetes history),
  **thyroid** (TSH, T3, total T4, T4 uptake, FTI
  plus the thyroid history flags), and **diabetes risk factors** (prior GDM,
  prediabetes, family history, PCOS, previous large baby, unexplained loss,
  inactivity). She sees anaemia, pregnancy risk, gestational diabetes, thyroid
  disorder and preeclampsia immediately. The rule-only conditions are not run here, since they need
  clinical findings and lab panels this form deliberately does not ask for.
  The page is only offered to patients whose stored `assessment_data` has a life
  stage of `pregnancy` — captured, along with the estimated due date and height,
  by the onboarding questionnaire (`src/pages/patient/Questionnaire.tsx`).
- **Doctor → Patient Analysis** (`/doctor/patient-analysis`, legacy
  `/doctor/disease-detection` still resolves) — lists the doctor's accepted
  pregnant patients (the Patients page also links through per patient via
  "Patient Analysis"). Selecting one shows a **read-only analytics view** of
  everything the patient has submitted: trend line charts of her vitals, labs and
  wellbeing scores (hemoglobin, blood pressure, BMI, HbA1c, TSH, PHQ-9, EPDS, …)
  over a selectable 7 / 15 / 30-day or all-time window, a per-condition risk-score
  trend, and the detected conditions with their current risk. The doctor no
  longer fills in or re-runs the screening form here — the analysis is built from
  the patient's own Health Check submissions.

The patient sees her full history in a **Past Checks** tab: date-range presets
(today, 7/30/90 days, all) plus a custom start/end range via a calendar picker,
scoping both a per-condition risk-score trend chart and the list beneath it
together. The trend chart (`RiskScoreTrend.tsx`, the same component the
doctor's Patient Analysis page uses) only appears once at least two checks fall
in the selected range — a single point has nothing to trend. Charts only render
for values that were actually recorded; laboratory fields left blank mean "not
performed" — they never score as a normal result.

**Measurement bounds.** `src/lib/screeningValidation.ts` mirrors the
`Field(ge=..., le=...)` constraints in `backend/disease_detection/schemas.py` so
an impossible reading (entering `119` instead of `11.9` for haemoglobin) is
flagged in the form instead of returning a raw pydantic error. The backend
remains the authority; **if you change a bound in `schemas.py`, update that file
too** — its unit tests pin the expected ranges and will fail if the two drift.

**Backend.** The pipeline lives in `backend/disease_detection/` and is exposed
by two endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/disease/conditions` | GET | Conditions the pipeline covers, the active detector for each, and the accepted symptom vocabulary. |
| `/disease/screen` | POST | Runs a screening. Body is a `ScreeningInput` payload, optionally with `conditions: [...]` to restrict the run to a subset. |

Three conditions are scored by the rule-based analytics ported from the Neuviaa
prototype (`rules.py`), registered per condition through
`pipeline.register_detector`. Anaemia, pregnancy risk, gestational diabetes,
thyroid disorder and preeclampsia are scored by the trained models in `disease_detection/ml/`
(see below), which register over their rule-based baselines at import. A detector is any callable of
`(ScreeningInput) -> ConditionRisk`, so swapping model for rules — or the
reverse — touches neither the API nor the frontend; `ConditionRisk.detector`
records which one produced each result, which keeps a mixed run auditable.

### Trained models

**Maternal risk (XGBoost).** Two classifiers trained on a synthetic
maternal-anaemia cohort (`backend/data/maternal_anemia_dataset.csv`):

- **Anaemia status** — Normal / Mild / Moderate / Severe (essentially the WHO
  haemoglobin grading).
- **Pregnancy risk** — Low / Medium / High, combining haemoglobin, blood
  pressure, maternal age and BMI.

Both read the same nine features (age, gestational week, haemoglobin, iron
supplement, systolic/diastolic BP, MAP, pulse pressure, BMI) via one shared
transform (`ml/featurize.py`) used for both training and inference, so they
cannot drift. Models are stored in XGBoost's version-tolerant native JSON
format alongside `model_schema.json`. Retrain them with:

```
cd backend && python -m disease_detection.ml.train_maternal_models
```

**Gestational diabetes (logistic regression).** A class-balanced logistic
regression trained on `backend/data/gdm_dataset.csv` (10,500 rows, ~17% GDM
prevalence). It is a *pre-OGTT early screening* model: fasting glucose and the
75g OGTT results are deliberately excluded from training, since those are the
diagnostic test itself and would leak the target.

It uses 15 features (`ml/gdm_featurize.py`), **12 of which the app already
collects** and maps straight off `ScreeningInput` — age, BMI, blood pressure,
pregnancies, prior GDM, family history, prior loss, prior macrosomia, PCOS,
sedentary lifestyle, HbA1c. Only three fields were added for it:
`known_prediabetes`, `hdl` and `triglycerides`. Three of the source notebook's
18 features were dropped after checking the cost on held-out data
(ROC-AUC 0.826 → 0.823):

| Dropped | Why |
|---|---|
| `snp_genetic_risk_score` | A genetic score no patient can be expected to know; correlates only +0.067 with the outcome. |
| `height_cm`, `weight_kg` | Fully redundant with `bmi`, which is derived from them — dropping both moved AUC by <0.0001. |

Held-out performance: **ROC-AUC 0.823, recall 0.733** (recall matters most for
a screening model, which is why the fit is class-balanced). Risk tiers follow
the notebook's stratification table: low <35%, moderate 35–60%, high >60%.

The model is stored as **plain JSON** (`gdm_model.json`: feature order, scaler
mean/scale, coefficients, intercept, per-feature medians) rather than a pickle,
and inference evaluates the sigmoid directly with numpy. This means it carries
no scikit-learn version coupling — the notebook's pickle was written with 1.6.1
while this repo pins 1.7.2, the same drift hazard `CLAUDE.md` flags for
`dosha_model.pkl` — and the scaler cannot go missing, because it travels in the
same file as the coefficients it belongs to. The training script asserts the
hand-rolled sigmoid reproduces `predict_proba` exactly. Retrain with:

```
cd backend && python -m disease_detection.ml.train_gdm_model
```

Missing optional labs (HbA1c, HDL, triglycerides) are imputed with the training
median, and the result says which ones were estimated so a score built partly on
population averages is never mistaken for one built on the patient's own
results.

**Thyroid disorder (neural network).** A Keras feed-forward network
(256-128-64, batch norm + dropout) trained externally on the UCI thyroid
dataset. The source artifacts live in `backend/data/thyroid_source/`.

It reads 31 features: 6 continuous labs (age, TSH, T3, TT4, T4U, FTI,
median-imputed then standardised), 13 clinical history flags, and 12 values that
are never asked for — the 6 "<lab> measured" flags are **derived** from whether
each value was supplied (asking twice would only create a way for the two to
disagree), `sex` and `pregnant` are known from the app's population, and the 4
referral-source one-hots take the training defaults.

> **TT4 is not the `t4` field.** The rule-based scorer's `t4` is *free* T4
> (roughly 0.8-2.5 ng/dL); the model's TT4 is *total* T4 (median 103 µg/dL).
> They are separate fields on purpose — feeding one in as the other would read
> every patient as severely hypothyroid.

**Converted, not shipped as-is.** `convert_thyroid_model.py` folds the Keras
weights and the scikit-learn preprocessor into `thyroid_model.npz` +
`thyroid_schema.json`, and inference runs the forward pass in numpy. This
matters twice over:

* Shipping the original would drag in **TensorFlow** — roughly 600 MB installed
  against a 512 MB free-tier Render instance. It would not merely be wasteful;
  it would likely take down the whole API, including the models that already
  work. None of that weight buys anything at inference, where dropout is a no-op
  and batch norm collapses to a fixed affine transform.
* The preprocessor pickle was written with scikit-learn 1.6.1 and, under the
  1.7.2 this repo pins, does not merely warn — it **fails to unpickle**
  (`_RemainderColsList` no longer exists). Its statistics are extracted to plain
  numbers instead.

The conversion asserts the numpy forward pass reproduces Keras (max drift
1.1e-06, i.e. float32 rounding). Re-run it only if the model is retrained:

```
cd backend && python -m disease_detection.ml.convert_thyroid_model
```

**Preeclampsia (logistic regression).** A class-balanced logistic regression over
13 antenatal features, converted from its pickled scikit-learn Pipeline the same
way (`convert_preeclampsia_model.py` → `preeclampsia_model.json`, verified to
reproduce the pipeline exactly, drift 0).

Nine of the thirteen already existed on the screening form. The four added for
it are **diabetes**, **history of hypertension**, and the two ultrasound values
**estimated fetal weight** and **amniotic fluid index**.

Proteinuria is deliberately three-way here: "not tested" falls back to the
training-set default rather than being scored as a negative result the patient
never had.

That pickle is the sharpest illustration of why none of these models are shipped
as pickles. Under a newer scikit-learn it fails twice — `_RemainderColsList` no
longer exists (so it will not unpickle), and `SimpleImputer._fit_dtype` was
renamed (so it loads but raises the moment it transforms). The conversion script
shims both to read the parameters out once; the deployed backend never unpickles
anything.

**Fallbacks.** When a model needs an input it does not have — haemoglobin for
anaemia, haemoglobin and blood pressure for pregnancy risk, BMI for GDM, TSH for
thyroid, blood pressure for preeclampsia — the
detector falls back to the rule-based baseline rather than scoring on imputed
values. If XGBoost or the model files are absent, the whole pipeline runs on the
rule-based baseline.

**Frontend layout.** The form sections
(`src/components/health/ScreeningFields.tsx`), the results rendering
(`ScreeningResults.tsx`) and the per-condition risk-score trend
(`RiskScoreTrend.tsx`) are shared by both pages; only the sections each role
gets and the wording differ. Risk-level styling lives in `src/lib/riskLevels.ts`.

**Storage.** Screening runs are recorded in the `disease_screenings` Supabase
table, tagged `submitted_by` = `patient` or `doctor`, so each side can reopen
past results. The table is applied in the hosted project as the
`disease_screenings` migration; `supabase/disease_screenings.sql` is its source,
kept for recreating it in a fresh project. Its RLS lets a patient file and read
only her own checks, and a doctor read and file for patients they treat. If the
table is missing the feature still works — results render normally and simply
are not persisted.

### Written analysis and the patient chatbot (Gemini)

Several features read patient data through Google's Gemini, all proxied by
Flask (`backend/gemini_service.py`):

- **Patient → chatbot** (`/assistant/chat`, `src/components/chat/NutritionChatbot.tsx`) —
  a free-form assistant, not a scripted decision tree: she can ask literally
  anything ("insights for the last 7 days", "am I improving?", "I'm craving
  something sweet, what can I make?"). `src/services/chatAssistantService.ts`
  assembles her own data — dosha, active diet plan, pantry, meal
  adherence/feedback, sleep/water/activity logs, and her disease-screening
  trend — and hands it to Gemini as context, so answers are grounded in what
  she's actually tracked rather than generic advice. A recipe question is
  additionally grounded in real FoodOScope dishes matched against her pantry
  (flavour-word lookup, e.g. "sweet", intersected with what's marked
  "at home") rather than an invented dish. Conversation history is kept
  client-side and replayed on each turn, so a follow-up like "yes I have
  that" is understood in context.
- **Doctor → Patient Analysis** (`/analysis/screening`) — a "Write analysis"
  panel that turns the selected patient's screening history into prose: how
  the risk picture has moved, which measurements drive it, what to check
  next.
- **Patient → Health Check** — "Fill from your report" reads a photographed or
  uploaded lab report (`/analysis/extract-report`) and offers the values it
  found. They are shown for confirmation and only written into the form when
  she accepts them: OCR's characteristic failure is a lost decimal point
  (haemoglobin 11.9 read as 119), and a wrong number reaching a risk model
  silently is worse than typing it by hand. The backend additionally discards
  anything outside the field's clinically plausible range before it is ever
  offered.
- `/assistant/ask` — the chatbot's original, narrower endpoint (screening
  results only). No longer called by the UI now that the chatbot has full
  context, but left in place as a lighter-weight "ask about just my
  screenings" endpoint.

Four things are deliberate here:

1. **The key is backend-only.** `VITE_`-prefixed variables are compiled into the
   browser bundle, so a frontend Gemini key could be lifted from devtools and
   spent by anyone. Only the Flask process ever sees it.
2. **Gemini explains, it does not score.** Risk levels stay with the trained
   models and rules. The prompt shows Gemini those results and forbids
   recalculating or contradicting them — a screening tool whose risk level
   changed between identical runs would be neither auditable nor safe.
3. **No identifiers leave the app.** The prompt builders take clinical,
   dietary and tracking values only; name, email and patient ID are never
   included, even in the chatbot's much richer context.
4. **The backend never looks a patient up.** Every Gemini-backed endpoint is
   handed already-fetched data by the caller (itself scoped by Supabase RLS to
   the signed-in patient's own rows) rather than querying Supabase itself, so
   none of them can leak another patient's data even without their own auth
   check.

All Gemini features hide themselves when no key is set (the frontend asks
`/analysis/status` first), and a Gemini outage degrades to the existing
behaviour rather than an error state.

#### Gemini key rotation

Up to three keys — `GEMINI_API_KEY`, `GEMINI_API_KEY2`, `GEMINI_API_KEY3` — can
be set. Only the first is required; the extra two exist so the chatbot (used
far more than the occasional screening write-up) can roll over to the next key
instead of hard-failing when one hits its rate limit or quota. The pool lives
in `backend/gemini_service.py`: the last-successful key is tried first, a
failed key is parked for 60 seconds (rate limited) to 15 minutes
(invalid/revoked/suspended) before being retried, and state is in-memory only
— unlike the FoodOScope rotation below, these are real secrets, so they stay
in server environment variables rather than a browser-readable Supabase table.

*These scores are decision aids for a clinician, not a diagnosis.*

## Lifestyle Tracker

`/patient/lifestyle-tracker` (`src/pages/patient/LifestyleTracker.tsx`). One
page, one daily check-in — movement, hydration, sleep and diet-plan adherence
are sections of a single view rather than separate tabs, because they are all
answered in the same sitting. Everything logged here is real and persisted.

**Movement & exercise.** The exercises offered are chosen from the patient's
conditions, not a fixed list: what helps anaemia (gentle, oxygen-conservative
work) is close to the opposite of what helps PCOS (sustained aerobic plus
resistance training), and several conditions have movements that are actively
unsafe.

- `src/lib/exerciseRecommendations.ts` holds the exercise catalog and a plan per
  condition — the exercises, the reason they suit that condition, and what to
  avoid. Conditions come from two sources: moderate/high findings on her latest
  maternal screening (`disease_screenings`) and the conditions in her profile
  (`patients.assessment_data`). Free text is matched through an alias table, so
  "Anemia", "PCOD" and "high BP" all land correctly; anything unrecognised is
  dropped rather than guessed at, and a patient with no known conditions gets a
  general balanced plan.
- Pregnancy swaps unsafe movements for pregnancy-safe stand-ins and adds its own
  "avoid" notes on top of the condition's.
- Minutes are logged against the recommended exercises themselves, so the log
  always matches the recommendation.
- Each exercise card links to a how-to video. `videoUrl()` builds a YouTube
  **search** URL from the exercise's `videoQuery` rather than embedding a video
  id: a specific id can be taken down, go private, or be re-uploaded as
  something else, and a dead or wrong-content link on a page giving health
  guidance is worse than no link. Swap in
  `https://www.youtube.com/watch?v=<id>` per exercise to curate specific videos.

**Streaks.** The activity streak counts consecutive days with *any* movement
logged; the hydration section counts days the daily water target was met. Streak
math lives in `src/lib/lifestyleLog.ts` (pure, Supabase-free, unit tested in
`src/lib/__tests__/lifestyleLog.test.ts`): an unachieved *today* doesn't break a
run — the day isn't over — but any earlier missed day does.

**Storage is local-first.** A streak that vanishes on refresh defeats the point,
so `src/services/lifestyleLogService.ts` writes every entry to `localStorage`
through the shared `src/lib/localCache.ts` wrapper — with no TTL, unlike the
in-progress drafts it usually holds — and then mirrors it to the
`lifestyle_logs` Supabase table (one row
per patient per day, RLS-scoped to the patient herself —
`supabase/lifestyle_logs.sql`). Reads merge the two, preferring the server where
both have a day so a second device wins over a stale cache. A missing table or an
unreachable server degrades gracefully: the tracker keeps working from the cache
and shows a banner saying it isn't backed up.

**Daily nutrition & diet plan.** Replaces the old "No Junk Food" streak. Rather
than a habit game, this reports two facts per day, read from the meal statuses
she ticks off in Meal Logging (`meal_tracking`, via
`src/services/mealAdherenceService.ts`): whether she completed her daily
nutrition (calories against the targets for her life stage, from
`getNutritionalTargets`) and whether she followed the diet plan she was given
(share of planned meals eaten). Deliberately *not* a streak — a missed day here
is dietary information for her doctor, not something to reset. Logic and
thresholds are in `src/lib/dietAdherence.ts`.

> The old `junk_food_streak_logs` table and its `supabase/junk_food_streak.sql`
> migration were removed with the feature. If the table exists in an already
> provisioned project it is now unused and safe to drop.

**Demo data (testing only).** A month of real logs takes a month to accumulate,
so the tracker can fill itself with 30 days of fabricated data to exercise the
streaks, calendars, charts and adherence roll-up. Two guards keep it away from
patients: the controls only appear when `isDemoModeAvailable()` says so
(`src/lib/demoMode.ts` — local dev, or any build with `?demo=1` in the URL), and
demo data is **never mirrored to Supabase**, only cached locally, so nothing
fabricated reaches the database. A banner marks the page while it is loaded, and
"Clear" wipes the cache and re-reads the real server data.

`src/lib/demoLifestyleData.ts` generates it deterministically (seeded PRNG,
dates relative to today), so the same day always produces the same month and a
failure is reproducible. The shape is deliberately uneven — rest days, missed
water targets, unlogged nights, skipped meals — because data where everything
succeeds would not prove the streak logic works. The rest days are placed to
give a current activity streak of 4 with an earlier best of 6;
`src/lib/__tests__/demoLifestyleData.test.ts` asserts those numbers by running
the production streak functions over the generated month, and
`src/pages/patient/__tests__/LifestyleTracker.test.tsx` renders the page and
checks they reach the UI.

## Patient kitchen (pantry)

Patients list the food they actually have, so plans are built around what they
can cook rather than what a generator picked.

- **Patient side** — "My Kitchen" at `/patient/pantry`
  (`src/pages/patient/Pantry.tsx`). Search the ingredient catalogue, add the
  food with an optional quantity and note onto either the **At home** or the
  **Shopping list** tab, and move items between the two. The old
  `/patient/shopping` placeholder now redirects here.
- **Ingredient catalogue** — `src/services/ingredientCatalogService.ts`. Foods
  are picked from a list rather than typed free-hand, because what a patient
  types ("Dals", "ALL Kinds Of Fruits") is not what the recipe database
  indexes, and the doctor's ingredient search then matched nothing. The list is
  **FoodOScope's own ingredient index**: the service sweeps the FlavorDB
  categories (`/ingredients/flavor/{category}`), keeps each entry's indexed
  name as the `searchTerm`, its readable `generic_name` as the label, and its
  `frequency` — how many recipes actually use it — to sort the common foods to
  the top. The sweep runs at most once a week (localStorage, 4 categories at a
  time) behind `src/hooks/useIngredientCatalog.ts`.
  `src/data/ingredients.ts` remains as the bundled fallback shown while the
  sweep runs or when the API is unreachable, and as the source of local-name
  aliases ("methi", "bhindi", "jeera", "gur") the API does not carry; curated
  staples the API omits are merged in.
  `public/foodDatabase.json` is deliberately not the source here — it lists
  prepared dishes, not ingredients.
- **Doctor side** — the **Patient Pantry** panel at the top of the Food Explorer
  (`src/components/patients/PatientPantryPanel.tsx`). Search one of your own
  patients and their kitchen list appears as tappable chips; picking one or two
  pushes their catalogue search terms into the FoodOScope include-ingredients
  filter. The filter is an AND across everything selected — a recipe must
  contain every ingredient picked — so the panel selects nothing by default
  rather than searching a whole pantry, which matches nothing.
- **Storage** — `patient_pantry_items` (`supabase/patient_pantry_items.sql`,
  one row per food with both the chosen label and its `search_term`),
  read and written through `src/services/pantryService.ts`. RLS makes the list
  the patient's own: they insert/update/delete only their rows, and a treating
  doctor can read but never write them.

## Patient selection (doctors)

Every doctor-side patient search goes through `PatientPicker`
(`src/components/patients/PatientPicker.tsx`): a searchable dropdown listing
**only the signed-in doctor's own patients**, filterable by name or by patient
code (P001…). It is used by the Recipe Builder, the Diet Chart viewer and the
Food Explorer's pantry panel, replacing the free-text "enter a patient ID"
inputs those pages used to have.

The list comes from `src/hooks/useDoctorPatients.ts`, which reads the doctor's
`consultation_requests` (statuses `pending`/`accepted`/`completed` — the same
set `public.doctor_treats()` accepts, so anything offered in the picker is
something the doctor may actually write a plan for) and caches the result in
React Query.

The picker hands callers the patient's **`patients.id` UUID**, and shows the
P001-style code as display text only. That distinction matters: `diet_plans`
(and every other table) keys on the UUID, so saving a plan against the code
fails on both the column type and the RLS check.

## Doctor verification

A doctor's "verified" badge is a claim patients act on, so nothing the browser
says decides it. The rules live in `supabase/doctor_verification.sql`.

**Signup records claims, never status.** The doctor wizard's license lookup
(`src/lib/licenseVerification.ts`) is browser-side and mocked, so it is form
validation and a completeness hint — not evidence. `buildSignupMetadata` sends
the claimed credentials (license number, council, degree, clinic) and
deliberately omits `licenseVerified`, `verificationScore` and
`verificationBadge`; the `handle_new_user` trigger ignores them regardless.
Every new doctor starts `verification_status = 'pending'`,
`can_accept_patients = false`.

**Doctors cannot promote themselves.** `authenticated` holds column-level
UPDATE grants covering profile fields only, so writing `verification_status`,
`license_verified`, `trust_score`, `badges`, `rating` or the consultation
counters fails at the SQL layer before RLS is consulted. The
`doctors_enforce_verification` trigger is the second layer: on any
non-privileged write it forces those columns back to their stored values, and
recomputes `verification_score` / `verification_badge` from the row via
`public.doctor_profile_score()` and `public.doctor_badge()` — SQL mirrors of
the TypeScript helpers. Change the weights in one and you must change the
other. Changing the claimed license or council resets the doctor to pending.

**Only the service role can verify.** `public.verify_doctor(id, verified,
details)` is the sole route to verified status; EXECUTE is revoked from `anon`
and `authenticated`, so it is reachable only from the Python backend or the
Supabase dashboard, both of which hold the service-role key. Pass
`p_verified => false` to revoke.

**The gate is enforced, not cosmetic.** The `doctors_select_directory` policy
hides unverified doctors from patients (a doctor still reads their own row so
their dashboard works while pending), `fetchDoctors` filters to verified, and
`consultation_requests_require_verified_doctor` rejects a booking against an
unverified doctor in the database — so bypassing the UI does not help. The
doctor's `pending_requests` counter is maintained by
`consultation_requests_bump_pending`; it used to be written by the patient's
client, which RLS silently refused, so the count never moved.

### Demo doctor accounts

`supabase/demo_doctors.sql` seeds three demonstration practitioners
(`*.demo@prakriva.app`). They are **fictional composites** — the institutions,
councils and `AYU/<state>/<6 digits>` registration format are real, the people
and numbers are not. Each is flagged `doctors.is_demo = true` and carries a
`license_verification_details.note` saying so, and they are verified through
`verify_doctor()` rather than by writing the trust columns directly.

They share a demo password and are fine for a prototype, but purge them before
the app sees real patients:

```sql
delete from auth.users where id in (select id from public.doctors where is_demo);
```

Note that Ayurvedic practitioners (BAMS/MD) register under the Ministry of
AYUSH / NCISM and their state Board of Indian Medicine — not the MCI or NMC,
which register allopathic doctors. The `ayush` council option is the correct
one for this app; `mci`/`nmc` exist for an applicant who also holds an
allopathic registration.

## Landing page

`/` is a marketing page, not product chrome, and is styled accordingly: warm
cream ground, blush→rose gradients, an editorial serif, and a lot of space.

- **Typography.** Fraunces (display serif) for headings, Inter for body and UI,
  both loaded from Google Fonts in `index.html` and exposed as `font-display` /
  `font-sans` in `tailwind.config.ts`. The fallback stacks keep the layout
  stable while the webfonts arrive, so a blocked font request degrades to a
  system serif rather than to a broken page.
- **The hero background is CSS, not a photograph.** Three heavily blurred
  colour fields (`.blush-field`) drift on long offset loops under a film-grain
  overlay (`.grain`, an inline SVG turbulence — no asset, no request). That is
  what keeps the section weightless and what lets it invert in dark mode: every
  field is a theme token, so nothing has to be re-shot for a dark palette.
- **Glass surfaces.** `.glass-panel` (navbar, trust badges, AI chat mock) is a
  translucent token background plus `backdrop-filter`, behind a `@supports`
  guard so browsers without it get a solid panel rather than a transparent one.
- **Motion.** `.reveal` elements fade up as they enter the viewport via
  `useReveal`; the hero layers drift with `useParallaxLayer`. Everything
  decorative is stilled under `prefers-reduced-motion`, and revealed content is
  forced visible there so it can never be stranded in its hidden start state.
- **The AI assistant panel is a still, not a live model call.** The transcript
  is written to match what the real in-app assistant can actually do (it reads
  the patient's plan, pantry, logs and screenings) so the page doesn't promise
  behaviour the product lacks.
- **The testimonials and the stat row are placeholder copy.** They are marked
  as such in `CommunitySection.tsx`; replace them with consented, attributable
  quotes and real numbers before the page goes public.

## Theme, language and settings

`ThemeContext`, `I18nContext` and `userSettingsService` landed earlier without
anything wired to them, so the Theme dropdown set a piece of component state
and no more. `SettingsScreen` is what connects them, on both
`/patient/settings` and `/doctor/settings` (the doctor route was a "Coming
Soon" placeholder, which meant doctors could not reach the theme control at
all).

- **Light / Dark / System all work.** `ThemeContext` toggles the `dark` class
  and `color-scheme` on `<html>`; "System" resolves through
  `prefers-color-scheme` and keeps following the OS while the app is open. An
  inline script in `index.html` applies the saved choice before the first
  paint, so dark-mode users never get a flash of cream. Keep its storage key in
  step with `CACHE_KEY` in `ThemeContext` and `PREFIX` in `localCache.ts`.
- **The provider is the source of truth, not the stored settings object.** The
  select reads `theme` from the provider, so the control can never disagree
  with the page it is sitting on; a choice applies immediately and persists
  after.
- **Saving is local-first.** Changes write to `localStorage` and mirror to the
  `user_settings` table, debounced so a run of toggles is one write. When the
  table is missing or the server is unreachable the page says "Saved on this
  device" instead of pretending to have synced.
- `src/components/settings/__tests__/SettingsScreen.test.tsx` covers the three
  theme modes, persistence, applying a stored preference on load, and the
  device-only notice.

Dark mode also had to survive the pages that predate it. Much of the product UI
paints surfaces with literal light utilities (`bg-white`, `bg-gray-50`,
`text-gray-600`), which stayed bright when the rest of the app went dark. A
compatibility block at the end of `src/index.css` remaps those to theme tokens
under `.dark`, fixing every page at once. It lives in the `components` layer on
purpose: an explicit `dark:` class on an element is emitted later, in
`utilities`, so any page that has opted into its own dark treatment still wins.
`text-white` and `bg-black` are left alone — those sit on coloured buttons and
overlays where white-on-brand is correct in both themes.

## Color

The app is pink end to end. It used to mix in the stock Tailwind ramps —
green "success" badges, blue chart lines, amber warnings — which read as three
palettes fighting on one warm cream page. Everything now lives in one family.

**Three brand ramps** (`tailwind.config.ts`), hues ~30° apart so states stay
tellable apart while still reading as one palette:

| Ramp | Hue | Role | Replaced |
|---|---|---|---|
| `plum` | 318° | informational, neutral emphasis | blue, sky, cyan, indigo, violet, purple |
| `rose` | 345° | positive, on track, goal met | green, emerald, teal, lime |
| `coral` | 8° | attention, partial, needs a nudge | yellow, amber, orange |

They follow Tailwind's own lightness curve, so the swap kept shade numbers
(`bg-green-100` → `bg-rose-100`) and with them the contrast each layout was
built around. `red` keeps its native hue: it already sits inside this family
(0°, between coral and rose) and carries the clinical high-risk signal.
`gray`/`slate` are overridden to warm, brand-tinted neutrals — Tailwind's stock
greys are blue-tinted and read cold against the cream background.

Two rules follow from having one hue family, both learned from looking at the
rendered pages rather than the code:

- **Binary states are filled vs. tinted, not two tints.** Two 100-level tints of
  the same family look identical at a glance, which defeats a "did I hit my
  target?" strip. Achieved days are solid (`bg-rose-600 text-white`), missed
  ones are pale and outlined.
- **Colour never carries meaning alone.** Risk levels escalate in *intensity*
  as well as hue (pale rose → coral → saturated red), so the ordering survives
  greyscale and colour vision deficiency, and high risk is the only filled
  badge. Every level also renders its `label` in words.

**Editorial tokens.** The marketing surface leans on a softer set than the deep
maroon used for dense product chrome: `--cream`, `--blush`, `--petal`,
`--apricot`, `--rose-accent` and the `--gradient-blush` / `--gradient-rose` /
`--gradient-cream` gradients, all defined in `src/index.css` and redefined
under `.dark`. Use the tokens rather than literal pinks so new marketing
sections invert with the theme for free.

Native form controls (`input[type=range|checkbox|radio]`) paint a browser-default
blue that no class on the element can reach; `src/index.css` sets `accent-color`
globally to fix that.

`src/lib/__tests__/brandPalette.test.ts` fails the build if an off-brand
utility or a hardcoded chart hex reappears — the drift happened once already,
one reasonable-looking green badge at a time.

## Caching

Long-running work no longer disappears on a page refresh:

- `src/lib/localCache.ts` is a small namespaced, TTL-aware localStorage wrapper;
  `src/hooks/usePersistentState.ts` is `useState` mirrored into it.
- What is cached: the Recipe Builder's meal-plan board (generated, hand-built,
  or both), its form fields and selected patient, the food palette
  (`FoodContext.selectedFoods`), the food database JSON, the patient selected
  in the Diet Chart viewer and the Food Explorer pantry panel, and each
  patient's pantry list.
- The Lifestyle Tracker uses the same wrapper but with no TTL
  (`CACHE_KEYS.lifestyleLogs` + the patient id): its logs are the patient's own
  history rather than in-progress work, so a streak must not expire on its own.
  See "Lifestyle Tracker" above.
- Server reads go through React Query, whose app-wide defaults live in
  `src/App.tsx` (`staleTime` 5 min, `gcTime` 30 min, no refetch on window
  focus), so switching pages serves from cache instead of refetching.

## Environment variables

Copy `.env.example` to `.env` (frontend, repo root) and `backend/.env.example`
to `backend/.env` (backend), then fill in real values. Both `.env` files are
gitignored and must stay that way — only the `.env.example` templates are
committed.

| Variable | Where | Required | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Frontend | Yes | Supabase project URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) | Frontend | Yes | Supabase anon/publishable key. Safe to expose — protected by RLS. |
| `VITE_API_URL` | Frontend | No | Base URL of the Flask backend, used by the recipe builder and disease detection screening. Defaults to `http://localhost:8000`. |
| `SUPABASE_URL` | Backend | Yes | Falls back to `VITE_SUPABASE_URL` if unset. |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Yes | Falls back to `VITE_SUPABASE_ANON_KEY` if unset, but that runs backend Supabase calls as the anon role (subject to RLS) instead of the privileged service role — set this explicitly for full backend access. **Never expose to the browser.** |
| `GEMINI_API_KEY` | Backend | No | Powers the written analysis on Patient Analysis and the patient chatbot. **Backend-only — never give it a `VITE_` prefix**, that compiles the key into the browser bundle. Unset disables both features cleanly. |
| `GEMINI_API_KEY2`, `GEMINI_API_KEY3` | Backend | No | Extra keys (e.g. from a second/third Google AI Studio project). The backend rotates to the next one whenever the active key is rate-limited, over quota, or rejected — see "Gemini key rotation" below. Only `GEMINI_API_KEY` is required. |
| `GEMINI_MODEL` | Backend | No | Defaults to `gemini-2.0-flash`. |
| `OPENAI_API_KEY` | Backend | No | Only needed for OpenAI-backed features; the app boots fine without it. |
| `FLASK_ENV` | Backend | Recommended | Set to `production` on deployed environments to disable Flask debug/test routes. Defaults to `development`. |

### Credentials previously committed to this repo

`backend/.env` and `backend/firebase_key.json` were tracked in git and are now
removed (the Firebase key outright — nothing has used Firebase since the move
to Supabase). Removing them from the working tree does **not** scrub them from
git history, so treat every secret they held as public and rotate it:

- the `OPENAI_API_KEY` in `backend/.env`,
- the `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`,
- the Firebase service-account key in `backend/firebase_key.json` — revoke the
  service account in Google Cloud IAM rather than reissuing it.

## FoodOScope API key rotation

Recipe data comes from the FoodOScope (RecipeDB) API, called directly from the
browser by `src/services/foodoscopeApi.ts`. That service accepts **multiple
keys** and rotates between them so a single exhausted or throttled key doesn't
take the recipe features down.

**Keys go in Supabase — nowhere else.** Insert one row per key into
`public.foodoscope_api_keys`:

| Column | |
|---|---|
| `api_key` | the key itself — the only field you have to fill in |
| `label` | optional note, e.g. "backup 2" |
| `is_active` | defaults to `true`; set `false` to retire a key without deleting it |
| `priority` | defaults to `100`; lower is tried first |

The frontend loads the table on first use and re-checks every 5 minutes, so a
key added there **takes effect without a redeploy**. The table is readable by
signed-in users only, which is all that's needed — every screen that calls
FoodOScope sits behind `ProtectedRoute`. There is no write policy, so keys can
only be added from the Supabase dashboard or the service role, never from the
browser. No environment variable configures these keys.

`src/services/foodoscopeApi.ts` also holds a single `EMERGENCY_KEY` constant.
That is **not** a place to add keys — it is the last resort that keeps recipes
loading if Supabase is unreachable, and real keys from the table replace it as
soon as they load.

How rotation behaves:

- The key that last succeeded is tried first, so healthy traffic stays on one
  key instead of cycling.
- On `401`/`402`/`403` (invalid, exhausted, or suspended key), `429` (rate
  limited), or any `5xx`, the request is retried on the next key.
- A failed key is put in cooldown — 60s after a `429`, 15 min after an auth
  failure, 30s after a server or network error — and skipped while a healthy
  key is available. If every key is cooling down, they're still tried rather
  than failing outright.
- `4xx` responses that aren't key-related (e.g. `400`, `404`) throw
  immediately, since another key would return the same thing.
- When all keys fail, the last error is thrown as a `FoodoscopeApiError`
  carrying the HTTP `status`. `getKeyPoolStatus()` from the same module returns
  a redacted snapshot of each key's state for debugging.

These keys are **not secrets** — a row readable by signed-in users is readable
by every signed-in user, and the keys reach the browser either way. FoodOScope
keys are per-app quota tokens, which is why this is fine; genuine secrets still
belong in `backend/.env`. If a key must stay private, proxy the calls through
the Flask backend instead.

One exception, unchanged from before: `public/mealCompatibility.html` is a
standalone static page with no bundler and no Supabase client, so it keeps its
own `API_TOKENS` array. It is not part of the rotation described above.

## Deployment

### Frontend (Vercel)

The frontend deploys as its own Vercel project: Root Directory = repo root,
Framework Preset = Vite. Set the frontend environment variables above in that
project's settings, then redeploy. Point `VITE_API_URL` at the deployed backend
URL (see below) so the disease-detection screening reaches the Flask API.

### Backend (Render)

The Flask backend — including the maternal disease-detection models — deploys to
Render from the committed blueprint at `render.yaml`. In Render, choose **New +
→ Blueprint** and select this repo; it builds `backend/requirements.txt`
(installing XGBoost and the other backend deps) and starts the app with
`python run.py` (Waitress), health-checked at `/health`. Render injects `PORT`
automatically; `config.py` reads it.

Set two secrets in the Render dashboard (they are `sync: false` in the
blueprint, so they are never committed): `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`, both from your free Supabase project (Project
Settings → API). `OPENAI_API_KEY` is **optional** — the disease-detection models
and the rest of the API boot without it, so the backend deploys for free; only
the LLM meal-planning / dosha-chat features need a key, which you can add later
in the dashboard. Once the service is live, copy its URL into the frontend's
`VITE_API_URL`.

The model artifacts in `backend/disease_detection/ml/*.json` are committed, so no
training step runs on deploy; the service loads them at startup and falls back to
the rule-based baseline if they are missing.

### Backend (Vercel, alternative)

The backend is **not** combined into the same Vercel project as the
frontend. This was tried (routing backend paths to a Python function under
`/api` alongside the Vite frontend) and hit a platform-level wall: that build
path ignores both of Vercel's documented ways to pin the Python version
(`.python-version` and `pyproject.toml`'s `requires-python`), and numpy has no
prebuilt wheel at all for the Python version Vercel defaults to there, so the
build fails trying to compile numpy/pandas from source. The backend-only
build path (Root Directory = `backend/`, Flask framework preset) does not
have this problem and is known to work — deploy the backend as a separate
Vercel project using that layout if you prefer Vercel over Render. Either way,
the frontend's disease-detection screening calls the backend in production, so
`VITE_API_URL` must point at whichever backend deployment you use.
