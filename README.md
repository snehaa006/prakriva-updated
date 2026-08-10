# Prakriva

An Ayurvedic diet/wellness planning app connecting doctors and patients. Doctors
manage patients, build recipes and diet charts, review dosha/consultation
data, and run maternal disease-risk screening for their pregnant patients;
patients complete an Ayurvedic health questionnaire, list the foods in their
kitchen, get a personalized diet plan, get exercise suggestions matched to the
risks their health check flagged, and join peer-support community circles.

Patients pick their **care tracks** at signup — pregnancy, PCOD/PCOS, both, or
neither — which decides which tabs they see and which nutritional targets their
plan starts from. See "Care tracks" below.

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
- `src/pages/auth/` — the combined sign-in / sign-up screen mounted at
  `/auth/:role`, split by layer:
  - `Login.tsx` — form state and orchestration for both roles.
  - `AccountFields.tsx` — the name/email/password fields, shared by step 1 of
    both wizards and the sign-in form.
  - `DoctorSignupSteps.tsx` — the four-step doctor wizard (account, license,
    expertise, practice), with its option lists in `doctorProfileOptions.ts`.
  - `PatientSignupSteps.tsx` — the two-step patient wizard (account, then care
    tracks and their track-specific questions), with its constants in
    `patientTrackOptions.ts`.
  - Auth calls live in `src/services/authService.ts`; license formats,
    the registry lookup and profile scoring in `src/lib/licenseVerification.ts`.
- `src/test/` — Vitest setup (`setup.ts`), the Supabase client mock
  (`supabaseMock.ts`) and `renderPage.tsx` (renders a page with the router and
  a fresh react-query client, which pages need since they load through
  `useCachedPageData`). Tests themselves sit in `__tests__/` folders next to
  the code they cover.
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
  hydration log, `patient_pantry_items.sql` for the patient kitchen list and
  `community.sql` for the community circles, their memberships and their chat,
  and `pcos_tracking.sql` for the care-tracks column, the PCOD/PCOS trackers
  (`menstrual_cycle_logs`, `missed_cycle_months`, `weight_logs`, `acne_logs`)
  and the private `acne-photos` storage bucket.
- `src/components/wellness/ExercisePlan.tsx` — the one rendering of an exercise
  suggestion, shared by the Lifestyle Tracker (where minutes are logged against
  each exercise), the patient's health-check results and the doctor's Patient
  Analysis, so the three cannot drift apart. The picks themselves come from
  `src/lib/exerciseRecommendations.ts`. See "Exercise suggestions" below.
- `src/lib/healthTrack.ts` + `src/services/healthTrackService.ts` — which care
  tracks a patient is on (a set — pregnancy and PCOS can both apply), and the
  two places they are stored. See "Care tracks".
- `src/lib/cycleTracking.ts`, `src/lib/weightLog.ts`, `src/lib/acneGuidance.ts`
  and `src/lib/pcosInsights.ts` — the PCOD/PCOS domain model: cycle analysis,
  weight trends, acne guidance, and the combined insight that tunes the diet
  plan. All pure and unit-tested, with the Supabase side in the matching
  `src/services/*LogService.ts` files.
- `src/components/patients/` — shared patient-selection UI:
  `PatientPicker.tsx` (searchable dropdown over the signed-in doctor's own
  patients, by name or patient code) and `PatientPantryPanel.tsx` (the doctor's
  read-only view of a patient's kitchen). Both are backed by
  `src/hooks/useDoctorPatients.ts`.
- `src/pages/doctor/RecipeBuilder.tsx` — one screen that combines dosha-based
  generation with hand editing. Picking a patient shows their dosha profile,
  nutritional targets and restrictions (via `dietChartService.ts`); hitting
  Generate composes a plan with Gemini and drops the resulting days straight
  into the same drag-and-drop Daily/Weekly board used for building a plan by
  hand, so the doctor can rearrange or leave it as-is before saving. See "Diet
  chart generation" below for what feeds the generator. Loading an existing
  saved plan for editing (from the Diet Chart viewer's Edit button,
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

### Signing up with an email that already has an account

Worth knowing when testing the auth screen, because Supabase makes this case
look like the opposite of what it is. With **Confirm email** on (the default),
Supabase will not confirm or deny that an address is taken: `signUp()` for an
existing account returns *success* — no error, no session, and an obfuscated
user whose `identities` array is empty. A genuinely new signup always comes
back with one identity, and that is the only thing separating the two.

`signUpUser()` (`src/services/authService.ts`) checks for it and raises
`EmailAlreadyRegisteredError`, so the screen sends the person to sign-in with
her email kept and the password she just chose cleared. Without that check the
response is indistinguishable from "confirmation email sent", and the account
she is told was created does not exist — leaving every later sign-in failing
with "Invalid credentials" on a password that was never set.

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
- `src/hooks/__tests__/useCachedPageData.test.tsx` — that a revisited page
  renders from cache without a spinner and without re-fetching. See
  "Page loads" under Caching.
- `src/lib/__tests__/exerciseRecommendations.test.ts` — condition → exercise
  matching, the screening findings that feed it, the pregnancy substitutions,
  and a working video link for every recommended exercise.
- `src/lib/__tests__/community.test.ts` — which circles suit a patient, the
  browse ordering, display-name defaulting and message validation.
- `src/services/__tests__/communityService.test.ts` — the community row
  mapping, that a join request never sends its own status, and the
  missing-table fallbacks.

On the backend, `backend/tests/test_disease_detection.py` covers input
validation, each rule-based detector, the detector registry (including swapping
a detector out) and the `/disease/*` endpoints.
`backend/tests/test_dataset_loader.py` covers `load_all_datasets` directly —
the API tests patch `app.get_datasets`, so without it nothing exercises the
real loader or its critical-dataset guard.

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
| Care tracks (set at signup) | `healthTracks` (any of `pregnancy`, `pcos`; empty = general), mirrored to `patients.health_tracks` |
| Maternal (once) | `lifeStage` (`pregnancy`/`pcos`/`not_applicable`, or `none` from the questionnaire's own "No"), `dueDate` (estimated due date) |
| PCOD/PCOS (set at signup) | `pcosDiagnosisStatus`, `pcosDiagnosisYear`, `typicalCycleLength`, `lastPeriodStart`, `pcosConcerns` |
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

**The questionnaire merges into `assessment_data`, it does not replace it.**
Signup writes the care tracks and their answers there before the patient ever
reaches this form, and an empty answer never wins over a stored one — saving
the form state straight over the column would silently wipe her tracks and drop
her back onto general-adult nutrition targets. For the same reason the "Are you
currently pregnant?" question is hidden for anyone who ticked a track at
signup, since she has already answered it.

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

## Care tracks

Prakriva began as a maternal app: every patient was assumed pregnant, so the
maternal screening and the pregnancy nutrition targets applied to everyone. A
patient now picks her **care tracks** on step 2 of signup, and that choice
decides what the app is for her.

**They are a set, not a choice.** Pregnancy and PCOS routinely coexist — PCOS is
one of the more common reasons a pregnancy is higher-risk, and a patient does
not stop having it the month she conceives. A form that forced a choice would
make a pregnant PCOS patient pick which half of her care to give up, so the
signup step is checkboxes and ticking both shows both sets of questions.

| Tracks | Tabs she gets | Analysis her plan is built from | Calorie band | Questionnaire |
|---|---|---|---|---|
| `pregnancy` | Health Check (maternal screening) | `disease_screenings` — the trained models | ACOG, per trimester | Required |
| `pcos` | Period & Weight Tracker, Skin & Acne | Her cycle, weight, exercise and skin logs | PCOS band, tuned per patient | Optional |
| both | All three | Both — screening *and* logs | ACOG (pregnancy wins) | Optional |
| neither (general) | Neither | — | General adult | Required |

**Only pregnancy gets disease detection.** The screening models are trained on
pregnancy conditions (gestational diabetes, preeclampsia, maternal anaemia);
running them for a patient who is not pregnant would produce confident-looking
risk scores for conditions her answers were never about, which is worse than
showing nothing. That applies to PCOS-only *and* general-wellness patients.
`showsDiseaseDetection()` in `src/lib/healthTrack.ts` is the single place the
decision lives — the sidebar hides the tab, `TrackRoute` in `App.tsx` redirects
a hand-typed URL, and the doctor's Patient Analysis page never lists her.

### The questionnaire is offered on the PCOS track, not demanded

Every other patient completes the onboarding questionnaire before the rest of
the app opens up. A PCOD/PCOS patient does not: `requiresQuestionnaire()` in
`src/lib/healthTrack.ts` returns false for her, so sign-in lands her on her
dashboard and `PatientProtectedRoute` lets her through.

She has just answered a form of her own at signup — diagnosis, cycle, height
and weight, what she wants tracked — and a five-section Ayurvedic assessment
straight afterwards reads as being asked the same thing twice. It also stands
between her and the trackers she came for, which are the one part of the app
that is useless unless she starts logging early: a cycle history only becomes
an analysis after a few entries.

It is **not removed**, only un-gated. The Prakriti answers (body frame, skin,
appetite, temperament) are what `dietChartService.ts` builds her dosha from,
and without them it falls back to a default constitution — so her profile
carries a "Finish your Ayurvedic profile" card explaining what is still missing
and what it buys her. The exemption follows the PCOS half of the set: a patient
who is both pregnant and PCOS is exempt too, having answered those questions
either way.

As with the other track rules, one function decides it — `resolveDashboardPath()`
picks the landing route from it, `PatientProtectedRoute` and `AuthRedirect` in
`App.tsx` enforce it, and tracks that cannot be read fall back to asking, so an
unknown patient is never let past a gate that does apply to her.

### Pregnancy takes precedence, and that is a safety rule

`lifeStageForTracks()` puts pregnancy ahead of PCOS whenever both apply, and
that ordering is not a preference. The PCOS targets run a calorie deficit and
exclude foods; neither belongs anywhere near a pregnancy. Three places enforce
it, and each is unit-tested:

- **Nutrition targets** come from the pregnancy guidelines, not the PCOS ones.
- **`buildPcosInsight({ isPregnant: true })`** suppresses everything
  restrictive: no deficit, no "lose 5%", no dairy exclusion for acne. What
  survives is the part that helps *because* she is pregnant — the low-glycaemic
  emphasis (PCOS is the largest single risk factor for gestational diabetes)
  and the iron focus. The training-calorie allowance stays, since it adds.
  Weight is not read at all, and the panel says so rather than silently
  ignoring it: gestational weight gain belongs with her obstetrician, not a
  diet generator reading a home scale.
- **`analyseCycles({ isPregnant: true })`** suppresses every gap-derived flag.
  Periods stop in pregnancy, so her log shows a months-long gap and an
  ever-growing "days since last period"; reported as-is that reads as
  amenorrhoea and an overdue period — a false clinical finding generated by an
  entirely normal event, shown to the patient least able to shrug it off. The
  history itself still stands, because her pre-pregnancy pattern is what makes
  PCOS relevant to a pregnancy in the first place.

### Where the tracks are stored

Two places, on purpose:

1. `auth.users.raw_user_meta_data.healthTracks` — written by `signUp()`, so it
   exists even when email confirmation means there is no session yet and the
   browser cannot write to `patients`.
2. `patients.health_tracks text[]` — the column everything reads, set by the
   `on_auth_user_created_track` trigger (`supabase/pcos_tracking.sql`).

An empty array is an answer (general wellness); null means she was never asked.

Unlike a doctor's verification claim this is **not** a trust signal — it
decides which of her own trackers a patient sees, not what she may reach — so
it is safe for the client to state and for the trigger to copy straight
through. `signUp()` also merges the answers into `assessment_data` (including
`lifeStage`, which the diet generator keys off), so a project that has not
applied `pcos_tracking.sql` still resolves them via `resolveHealthTracks()`.
That fallback also covers accounts created before the tracks existed — and
combines rather than competing, so an old profile whose questionnaire says
pregnancy *and* which lists PCOD in its conditions resolves to both. An unknown
patient falls back to the empty set, never `pregnancy`: assuming pregnancy is
exactly how the app ended up showing a maternal screening to everybody.

### Period & weight tracker (PCOD/PCOS)

`/patient/period-tracker` (`src/pages/patient/PeriodTracker.tsx`), backed by
`src/lib/cycleTracking.ts` and `src/lib/weightLog.ts`. Local-first like the
Lifestyle Tracker: every entry hits localStorage synchronously and is then
mirrored to Supabase, so the history survives a refresh, an offline week and a
project missing the tables.

It counts the four ways a PCOS cycle goes wrong separately, because they pull
nutrition in different directions:

- **Infrequent cycles** (>35 days) and **missed periods** (90+ day gaps) point
  at anovulation, so the plan leans on low-glycaemic carbohydrate.
- **Frequent periods** and **heavy or prolonged bleeding** cost iron, so the
  plan leans on iron plus vitamin C.

Two details worth knowing:

- **"Two periods in one month" is not just two starts in a calendar month.** On
  a textbook 28-day cycle that happens roughly every other month — a period on
  the 1st and the 29th of January is one ordinary cycle, not a finding. Only
  two bleeds less than 21 days apart inside one month count.
- **Missed months are recorded explicitly**, not inferred from gaps. A patient
  who joins mid-way has gaps that are missing *data*, not missing periods, and
  treating those as amenorrhoea would put a false clinical finding in front of
  her doctor.

Weight is asked for weekly or whenever she likes. No direction is reported from
a single reading, or from two less than a fortnight apart — weight swings by a
kilo on water alone. `needsWeightReduction()` fires on either being above the
healthy BMI band or gaining faster than 1.5 kg/month. None of it applies during
pregnancy; see "Pregnancy takes precedence" above.

### Skin & acne tracker (PCOD/PCOS)

`/patient/skin-tracker` (`src/pages/patient/SkinTracker.tsx`), backed by
`src/lib/acneGuidance.ts`. She rates her skin, tags the regions, and can
attach a photo; the guidance escalates with severity, adds the dairy trial and
an active from moderate upwards, and points at a doctor for severe or
worsening-moderate acne rather than pretending food will fix it.

Unlike the other trackers this one is **not** local-first: a few phone photos
would blow the localStorage quota and evict the cycle history stored beside it,
so entries go straight to Supabase and a missing table is reported honestly.
Photos live in the private `acne-photos` bucket under `<patient-id>/`, which is
the prefix the storage policies key off, and are rendered through short-lived
signed URLs — never public.

If `GEMINI_API_KEY` is set, the photo is also sent to the backend's
`POST /analysis/acne-photo`, which returns a severity band, the visible regions
and at most two descriptive sentences. **The patient's own rating stays
authoritative** — she can see her face in daylight, the model is looking at a
phone photo — so the read is stored beside hers, never over it, and the
recommendations only ever branch on her band. The endpoint returns no treatment
advice at all, and a photo Gemini cannot judge comes back with a null severity
rather than a guess. Without a key the tracker works exactly as before, minus
that one line.

### How a PCOS diet plan is generated

For a patient who is only pregnant, the doctor opens Patient Analysis, the
pipeline scores her conditions, and Recipe Builder generates from the result. A
PCOS patient has no pipeline to run — she already has the diagnosis — so
`src/lib/pcosInsights.ts` stands in its place, reading her cycle, weight,
exercise and skin logs and producing the same shape of answer the generator
wants: a `PlanAdjustment` of calorie delta, ingredient emphasis and notes.

- `getNutritionalTargets("pcos")` in `dietChartService.ts` is the population
  baseline: 1600–1900 kcal, 30 g+ fibre, iron at the menstruating-adult level,
  and a low-glycaemic ingredient focus.
- `buildPcosInsight()` tunes it per patient. Drivers add up rather than one
  winning, so a patient who is both gaining weight *and* training hard lands in
  between: −300 kcal for weight reduction, +150 back for a consistent training
  week. Lean PCOS gets calories *added*, not cut.
- `generateDietChart(profile, days, adjustment)` applies it, with a 1200 kcal
  floor no tracker-derived adjustment can push through — below that a plan
  cannot carry the protein, iron and calcium the guidelines call for.
- With nothing logged there is no adjustment. `insight.gaps` says what is
  missing, and the doctor sees "Not enough logged yet" rather than a number
  invented from an empty history.

The doctor sees all of this in the **PCOD/PCOS Analysis** panel on Recipe
Builder, which sits exactly where the screening result would for a patient who
is only pregnant — and *alongside* the screening for one who is both.

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
  disorder and preeclampsia immediately, and — on the same tab — an **exercise
  plan built from those results**, grouped by the condition that asked for it
  (see "Exercise suggestions" below).
  The rule-only conditions are not run here, since they need
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
  trend, the detected conditions with their current risk, and the **exercise
  plan those conditions imply** — the same suggestions the patient sees, so the
  doctor can talk through or correct them in the consultation. The doctor no
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
  that" is understood in context. Only real turns are replayed: the canned
  welcome message and any "couldn't reach your assistant" notice are left out,
  because Gemini requires a conversation to open with a *user* turn and
  replaying a failure notice as a model turn teaches the conversation that it
  is broken. When a turn does fail, the reply says so and carries the reason
  underneath it in small print (see the troubleshooting note below) plus a
  "Try again" button that re-sends the same question.
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
- **Patient → Skin & Acne** (`/analysis/acne-photo`) — a second opinion on an
  uploaded skin photo: a severity band, the visible regions, and at most two
  descriptive sentences. It is asked for a *band*, never a lesion count or a
  diagnosis, and it returns no treatment advice — that lives in
  `src/lib/acneGuidance.ts` where it can be reviewed. The patient's own rating
  stays authoritative and is the only thing the recommendations branch on; the
  model's read is recorded beside it. A photo it cannot judge comes back with a
  null severity rather than a guess. The photo is forwarded and discarded — the
  copy she keeps lives in her own Supabase storage folder, which this endpoint
  never touches.
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
behaviour rather than an error state. The chatbot is the exception to the
"ask `/analysis/status` first" rule for *sending*: it always attempts the
call, because that check is still in flight for the first second or so after
the widget opens and refusing to send during it answered the opening question
with "your assistant isn't available" on a perfectly healthy deployment. The
banner at the top of the chat still uses the status check.

#### When the chatbot answers "I couldn't reach your assistant"

Failure notices in the chat carry the underlying reason in small grey text
beneath them, so the cause is visible without opening devtools:

| Detail line | What it means |
| --- | --- |
| `Could not reach the backend at <url>` | Flask is down, `VITE_API_URL` points somewhere wrong, or the origin is not in the backend's `ALLOWED_ORIGINS`. |
| `Gemini returned HTTP 400 (INVALID_ARGUMENT — …)` | The request itself was rejected — a malformed conversation, not a key problem. |
| `Gemini returned HTTP 429 (RESOURCE_EXHAUSTED …)` | Every configured key is out of quota. Add a spare (`GEMINI_API_KEY2`) or wait. |
| `Gemini returned no usable model (…)` | Every model in the chain answered 404 *and* the live model list could not be fetched — see "Gemini model retirement" below. |
| `Gemini used its whole output budget …` | The model spent `maxOutputTokens` reasoning without writing an answer, twice. Raise `GEMINI_MAX_TOKENS`. |
| `No GEMINI_API_KEY is set` | The backend has no key; set it in the Render dashboard. |

Keys are redacted out of anything shown or logged.

#### Gemini model retirement

Google shuts model IDs down on a published schedule, and a retired ID answers
404 to every request made against it. This app has already been bitten once:
`gemini-2.0-flash`, the original hard-coded default, was shut down on
**1 June 2026**, and the two Gemini callers failed very differently —

- the **chatbot** has no fallback, so every message came back "I couldn't
  reach your assistant";
- **diet chart generation** falls back to the FoodOScope recipe path on any
  failure, so it kept producing charts and looked healthy, which made the
  outage read as "the chatbot is broken" rather than "the model name is dead".

So the model is resolved rather than declared. On its first call each process
asks Gemini which models the key can actually serve (`ListModels`) and takes
the best flash model on offer — stable over preview, full over lite, highest
version. A hard-coded name is only correct until the next retirement, and
those have arrived *ahead* of their published dates (`gemini-2.5-flash` began
answering 404 more than three months before its announced shutdown), so one
extra request per process buys a model that certainly exists. `_MODEL_CHAIN`
in `backend/gemini_service.py` is only the backstop for when that listing call
itself fails.

On top of that, a 404 or `NOT_FOUND` from any call retires that ID for the
life of the process and the next candidate is tried on the same request — so a
model that dies mid-deployment costs one extra call, not an outage. Set
`GEMINI_MODEL` only to pin a specific model; a pinned model that 404s is
logged and routed around too.

`GET /analysis/status` reports the model in use alongside `enabled`, and both
generation endpoints return it in their response — that field is the quickest
way to tell "the key is broken" apart from "the model name is gone".

#### Gemini key rotation

Several keys — `GEMINI_API_KEY` plus `GEMINI_API_KEY2` … `GEMINI_API_KEY10`,
or one comma-separated `GEMINI_API_KEY` — can be set (blanks and duplicates are
dropped). Only the first is required; the extras exist so the chatbot (used far
more than the occasional screening write-up) and diet chart generation (one
large request per plan) can roll over to the next key instead of hard-failing
when one hits its rate limit or quota. The pool lives in
`backend/gemini_service.py`: the last-successful key is tried first, a failed
key is parked for 60 seconds (rate limited) to 15 minutes
(invalid/revoked/suspended) before being retried, and state is in-memory only
— unlike the FoodOScope rotation below, these are real secrets, so they stay
in server environment variables rather than a browser-readable Supabase table.
A key still cooling down is sorted to the back rather than dropped, so a call
can still get through when every key is cooling.

A failure is only charged to the key when it is actually the key's fault.
This matters most for 400, which Gemini returns both for an invalid or
disabled key *and* for a request it could not parse: counting every 400
against the key meant one malformed request rotated through the whole pool and
parked each key for fifteen minutes, turning a single bad reply into an
app-wide Gemini outage. The decision now reads Gemini's own error status
(`RESOURCE_EXHAUSTED`, `UNAUTHENTICATED`, `PERMISSION_DENIED`, or a message
naming the API key) and raises anything else immediately, untried on the other
keys.

Error messages are reported with any configured key string replaced by `***`,
so the reason for a failure can be logged and shown in the UI without the
risk that made this "status codes only" before — Google's messages can echo
the request, and the key travels in the query string. When every key fails the endpoint answers 503 and each
caller degrades on its own terms: diet chart generation falls back to the
FoodOScope recipe path, and the analysis panels hide themselves.

*These scores are decision aids for a clinician, not a diagnosis.*

## Exercise suggestions

A risk score on its own tells a patient nothing she can act on. Every place a
risk is shown, the exercise that answers it is shown with it — thyroid risk
gets brisk walking, resistance work and pranayama; anaemia gets the gentle,
oxygen-conservative opposite — and each exercise links to a how-to video.

**Where they appear.**

- `/patient/health-check` → **My results** — under the screening results,
  grouped **per flagged condition** ("Exercise for Thyroid Disorder", with its
  risk badge, why it is prescribed that way, its videos, and what to avoid).
  The question on that tab is "my thyroid came back moderate — now what?", and
  one merged list of ten exercises does not answer it.
- `/doctor/patient-analysis` — the same plan for the selected patient's latest
  screening, in clinician wording, so the doctor can talk it through or correct
  it in the consultation.
- `/patient/lifestyle-tracker` — merged into one list instead, because the
  question there is *what to do today*: an exercise two conditions both ask for
  should appear once, with minute logging attached.

**How the picks are made.** `src/lib/exerciseRecommendations.ts` holds the
exercise catalog and a plan per condition — the exercises, the reason they suit
that condition, and what to avoid.

- Conditions come from two sources: **moderate/high findings** on the latest
  maternal screening (`disease_screenings`, via `conditionsFromScreening()`) and
  the conditions in her profile (`patients.assessment_data`). A low-risk finding
  is reassurance, not something to train around, so it is dropped — otherwise
  the one risk that needs tailoring is buried under four that don't.
- Free text is matched through an alias table, so "Anemia", "PCOD" and "high BP"
  all land correctly; anything unrecognised is dropped rather than guessed at,
  and a patient with no known conditions gets a general balanced plan.
- Plans are ordered by risk, so the most pressing condition leads.
- Pregnancy swaps unsafe movements for pregnancy-safe stand-ins (`Surya
  Namaskar` → prenatal yoga, strength training → light resistance) and adds its
  own "avoid" notes on top of the condition's. Every patient on the doctor's
  Patient Analysis page is pregnant, so that view always applies them.
- `videoUrl()` builds a YouTube **search** URL from the exercise's `videoQuery`
  rather than embedding a video id: a specific id can be taken down, go private,
  or be re-uploaded as something else, and a dead or wrong-content link on a page
  giving health guidance is worse than no link. Swap in
  `https://www.youtube.com/watch?v=<id>` per exercise to curate specific videos.

The module is pure and Supabase-free, and unit tested in
`src/lib/__tests__/exerciseRecommendations.test.ts` — including that every
recommended exercise across every condition (pregnant and not) has a working
video link. Rendering is shared through
`src/components/wellness/ExercisePlan.tsx`.

*These are general wellness suggestions, not a prescription — every surface says
so, and says to check with a doctor first.*

## Lifestyle Tracker

`/patient/lifestyle-tracker` (`src/pages/patient/LifestyleTracker.tsx`). One
page, one daily check-in — movement, hydration, sleep and diet-plan adherence
are sections of a single view rather than separate tabs, because they are all
answered in the same sitting. Everything logged here is real and persisted.

**Movement & exercise.** The exercises offered are chosen from the patient's
conditions, not a fixed list — see "Exercise suggestions" below for how they are
picked. Minutes are logged against the recommended exercises themselves, so the
log always matches the recommendation.

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

## Diet chart generation

Generate on the doctor's Recipe Builder (`/doctor/recipe-builder`) composes the
plan with **Gemini**, from four inputs:

1. **The dosha and the clinical targets** — computed in the browser by
   `src/services/dietChartService.ts`, exactly as before: the dosha scoring
   table, the life-stage calorie/micronutrient tables (ACOG for pregnancy, WHO
   for postpartum, NAMS for menopause), the allergy→ingredient exclusions and
   the five-slot meal structure.
2. **The patient's kitchen** — her `patient_pantry_items` rows, split into what
   she has at home and what is already on her shopping list. Meals are built
   around what she has; a plan that needs a shop she hasn't done is a plan that
   doesn't get cooked.
3. **Her disease screening results** — the flagged conditions from her recent
   `disease_screenings` rows, so an anaemia flag pushes iron and vitamin C
   pairings and a gestational diabetes flag pushes low-glycaemic carbohydrates.
   Low-risk conditions are left out; a diet does not need to react to something
   the models did not flag.
4. **Her assessment** — life stage, dietary preference, digestion issues, goals.

The split of responsibilities matters: **the app decides the constraints, Gemini
composes within them.** The prompt (`backend/diet_planner.py`) states the dosha,
the calorie band and the exclusion list as fixed, and forbids re-grading any of
them. Nothing identifying is sent — no name, email or patient ID — and the
frontend re-attaches the patient's name to the plan that comes back.

The reply is validated server-side before it reaches the board. Every meal is
checked against the exclusion list, matching whole words for short terms so
"egg" doesn't reject an aubergine dish, and any meal naming an excluded
ingredient is **dropped rather than corrected** — the doctor sees a gap they can
fill, which beats a plausible-looking meal nobody checked. The count of dropped
meals is surfaced as a toast.

Generated meals arrive in the same shape FoodOScope recipes do, so the
drag-and-drop board, the save path and the saved-plan schema needed no changes.

**Fallback.** If the backend is unreachable, has no Gemini key, or every key is
exhausted (`POST /diet-chart/generate` → 503), generation falls back to the
original FoodOScope path: recipes filtered by dosha, life stage and calorie
range, dealt into meal slots. That chart is tagged `source: "foodoscope"` and
the toast says so — it knows nothing about the kitchen or the screening, and the
doctor should be told which one they got.

## Community

`/patient/community` (`src/pages/patient/Community.tsx`) — peer support
circles. **This replaces the old Social Support tab**, whose feed and doctor
chat were hardcoded mock data; the route `/patient/social-support` now redirects
here.

Circles are condition-shaped, because that is what women actually want to
compare notes about: **Pregnancy**, **PCOS & PCOD**, **Thyroid**, **Iron &
Anaemia**, **Blood Sugar** (gestational and type 2), **New Mothers**, **Mind &
Mood**, and an open **Women's Wellness** circle. They are seeded by
`supabase/community.sql`; edit the copy freely, but keep the slugs — the
matching keys off them.

**Three tabs.**

- **Discover** — every circle, with the ones matching her own profile badged
  *"Suits your profile"* and sorted to the top. The match runs off her reported
  conditions, her latest screening findings and her life stage, through the same
  alias table the exercise plans use (`src/lib/community.ts` →
  `profileMatchKeys`), so "PCOD" in a questionnaire reaches the PCOS circle.
  The open circle is deliberately never badged: it suits everyone, so saying so
  carries no information.
- **My circles** — the chat. Messages are live where Supabase realtime is
  enabled on `community_messages`, and still work without it (new messages
  appear on the next send or reload).
- **Requests** — who is waiting to be let into her circles.

**Joining is always a request.** She picks a display name (defaulted to a first
name plus an initial — these are circles about miscarriage, mental health and
PCOS, so the default should not be her full name) and can add a line about
herself. The status is the **database's** decision, never the browser's: the
`community_admit()` trigger forces every insert to `pending`, except into a
circle with no approved members yet, which would otherwise be un-joinable — that
founding member is admitted immediately. After that, **existing members approve
the next person**, which keeps moderation inside the circle rather than needing
an admin the app does not have.

**Privacy is enforced in Postgres, not in the page.** `public.community_member()`
(SECURITY DEFINER, so the membership policies don't recurse on their own table)
gates reads and writes on `community_messages`: a signed-in stranger cannot read
a circle she has not been approved into. The same guard trigger that admits the
founding member also restores every column except `status` on an update, so an
approving member cannot rewrite a peer's display name or move her request to
another circle, and a pending patient cannot wave herself through. Messages
cannot be edited after they are read; an author can delete her own.

**Storage** — `community_groups`, `community_memberships` and
`community_messages` (`supabase/community.sql`), read and written through
`src/services/communityService.ts`. A missing table degrades gracefully, as
elsewhere: the page shows "No circles yet" rather than erroring, so a deploy
that has not applied the SQL does not take the page down. Matching and message
validation are pure functions in `src/lib/community.ts`, unit tested in
`src/lib/__tests__/community.test.ts`; the service's row mapping and its
missing-table fallbacks in `src/services/__tests__/communityService.test.ts`.

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
  See "Lifestyle Tracker" above. The PCOD/PCOS cycle and weight logs
  (`CACHE_KEYS.cycleLogs`, `missedCycleMonths`, `weightLogs`) follow the same
  rule for the same reason.
- The skin tracker is the one exception: photos cannot go in localStorage
  without blowing the ~5 MB quota and evicting the cycle history stored beside
  them, so it reads and writes Supabase directly. See "Care tracks" above.
- Server reads go through React Query, whose app-wide defaults live in
  `src/App.tsx` (`staleTime` 5 min, `gcTime` 30 min, no refetch on window
  focus), so switching pages serves from cache instead of refetching.

### Page loads (why tabs no longer flash a spinner)

Pages used to load themselves in a `useEffect` with their own `isLoading`
starting at `true`. React Router unmounts the page you leave, so the fresh
mount knew nothing about what the previous one had fetched: **every** tab
switch — not just the first visit — put a full-page spinner over data that had
been on screen a second earlier, and refetched all of it.

Two hooks fix that for good, and both are the pattern to follow for any new
page:

- `src/hooks/useCachedPageData.ts` wraps `useQuery` for a page's whole
  snapshot. The query cache lives at the app root and outlives the unmount, so
  a return visit renders the previous answer in its first frame and
  revalidates underneath. It hands back `isFirstLoad` — true only when there is
  genuinely nothing to show — which is the *only* state a page should block
  on. A query still waiting on `enabled` counts as loading, because rendering
  the page empty for that beat is the same flicker. `refreshMs` keeps the
  polling that the doctor's request queue and patient list rely on.
  Unit tested in `src/hooks/__tests__/useCachedPageData.test.tsx`, including
  that a second mount neither spins nor re-fetches.
- `src/hooks/useAuthUserId.ts` is one cached answer for "who is signed in".
  Eleven call sites each ran their own `supabase.auth.getUser()` — a round trip
  to the auth server that every page waited on before its first query could
  even start. `useDoctorPatients` owns the same cache key, so they share it.

Converted so far: the patient's Dashboard, Health Check, Tracker, Community and
Profile, and the doctor's Patients, Consultation Requests and Patient Analysis.
Page tests render through `src/test/renderPage.tsx`, which supplies a **fresh**
query client per test so one test's cache cannot satisfy the next test's query.

Two rules keep the cache honest where a page also owns editable state: seed
local state from the snapshot **once** (a background refresh must never
overwrite half-typed input), and after a write, re-read the snapshot rather
than patching a second copy of it.

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
| `GEMINI_API_KEY` | Backend | No | Powers diet chart generation, the written analysis on Patient Analysis, the patient chatbot, lab-report extraction and the skin tracker's photo read. **Backend-only — never give it a `VITE_` prefix**, that compiles the key into the browser bundle. Unset disables those features cleanly; diet charts fall back to the FoodOScope recipe path. May also hold a comma-separated list of keys. |
| `GEMINI_API_KEY2` … `GEMINI_API_KEY10` | Backend | No | Extra keys (e.g. from a second/third Google AI Studio project). The backend rotates to the next one whenever the active key is rate-limited, over quota, or rejected — see "Gemini key rotation" under Disease detection. Only `GEMINI_API_KEY` is required. |
| `GEMINI_MODEL` | Backend | No | Pins one model ID. Leave unset: the backend then asks the API which models the key can actually call and uses the best flash model available, so a retired model ID cannot take the AI features down — see "Gemini model retirement". |
| `GEMINI_MAX_TOKENS` | Backend | No | Output budget per call, defaults to `2048`. Current models spend part of it reasoning before they answer, so a small budget can return an empty reply. |
| `GEMINI_TIMEOUT_SECONDS` | Backend | No | Defaults to `45`. Diet chart generation overrides this with its own longer timeout. |
| `OPENAI_API_KEY` | Backend | No | Only needed for OpenAI-backed features; the app boots fine without it. |
| `FLASK_ENV` | Backend | Recommended | Set to `production` on deployed environments to disable Flask debug/test routes. Defaults to `development`. |
| `RATELIMIT_STORAGE_URI` | Backend | No | Where flask-limiter keeps its request counters. Defaults to `memory://` (in-process), which is correct while the API runs as a single worker — the case on Render's free plan. Point it at a shared Redis instance (`redis://…`) before scaling past one worker, otherwise each process enforces its own separate copy of the limit. `REDIS_URL` is used as a fallback, so an attached Render Key Value instance works with no extra config. |

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

`public/mealCompatibility.html` is a standalone static page with no bundler and
no Supabase client, so it cannot read the table itself. When it runs embedded in
the patient **Food Compatibility** page it borrows the app's pool over a
`postMessage` bridge instead: the iframe posts
`{ type: "foodoscope-request", id, path }`, `FoodCompatibility.tsx` calls
`fetchFoodoscopePath()` with the rotating keys and posts the JSON back as
`{ type: "foodoscope-response", id, ok, data | status }`. The host only answers
its own same-origin iframe, and only for `/recipe-bytitle/…` and
`/search-recipe/…`. Opened directly at `/mealCompatibility.html` — or if the
host doesn't answer — the page falls back to its own hardcoded `API_TOKENS`
array, which is a stale last resort rather than the intended path (food search
there breaks once that key expires).

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

**Reading the deploy log.** `run.py` logs to stdout in every environment, which
is the only stream Render captures — the container's `logs/app.log` is discarded
on each redeploy, and file logging is skipped entirely if the directory is not
writable. Expect `Running 'python run.py'` to be followed by the startup lines
(environment validation, dataset counts, database health) before the port opens.
Render prints `No open ports detected, continuing to scan...` while the service
loads its datasets and models; that is normal on the free plan and resolves once
Waitress binds — the deploy has only failed if the scan never succeeds.

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
