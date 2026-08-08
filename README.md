# Prakriva

An Ayurvedic diet/wellness planning app connecting doctors and patients. Doctors
manage patients, build recipes and diet charts, review dosha/consultation
data, and run maternal disease-risk screening for their pregnant patients;
patients complete an Ayurvedic health questionnaire and get a personalized
diet plan.

## Tech stack

- **Frontend**: React + TypeScript + Vite, shadcn/ui + Radix + Tailwind CSS,
  React Router.
- **Backend**: Python/Flask API providing dosha estimation, calorie
  calculation, meal planning, plan storage, and the maternal disease detection
  pipeline.
- **Supabase**: Postgres database + auth, using row-level security.
- **Tests**: Vitest + React Testing Library (frontend, jsdom), pytest
  (backend).
- **Deployment**: the frontend and backend deploy as **two separate Vercel
  projects**. The frontend project (Root Directory = repo root, Vite
  framework preset) serves the static build. A backend Vercel project, if
  used, would need Root Directory = `backend/` and its own Flask/Python
  framework preset — see "Deployment (Vercel)" below for why they aren't
  combined into one project.

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
  registry (`pipeline.py`). See "Disease detection" below.
- `supabase/` — SQL migrations for the Supabase project, including
  `disease_screenings.sql` for the screening history table.
- `src/index.css` — the design system: shadcn/Tailwind CSS variables
  (`--primary`, `--secondary`, `--accent`, `--sidebar-*`, gradients) in the
  Prakriva brand palette (deep maroon/burgundy on warm cream, matching
  `public/logo.png`). Dosha colors (`--vata`/`--pitta`/`--kapha`) and status
  colors (`--success`/`--warning`/`--info`, plus the ad hoc green/red/amber
  used for risk levels and meal/reminder status across `src/pages`) are kept
  separate from the brand palette on purpose — they carry meaning and aren't
  restyled when the brand colors change.
- `public/` — static assets served as-is: `logo.png` (the Prakriva brand mark,
  also used as the browser-tab favicon and the social preview image) and the
  standalone `mealCompatibility.html` visualisation (reachable at
  `/mealCompatibility.html`; it is not a React route).
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
| Personal | `name`, `dob` (age is derived, never stored), `gender`, `location` |
| Allergies & avoidances | `allergies`, `allergiesOther`, `foodAvoidances` |
| Dietary pattern | `dietaryPreferences` |
| Family history | `familyHistory`, `familyHistoryOther` |
| Prakriti (fixed at birth) | `bodyFrame`, `skinType`, `hairType`, `appetitePattern`, `personalityTraits`, `weatherPreference` |
| Notes | `additionalNotes` |

Fields the profile no longer collects, because they change over time:
`stressLevels`, `energyLevels`, `waterIntake`, `sleepDuration`,
`physicalActivity`, `dailyRoutine`, `cravings`, `digestionIssues`,
`currentConditions`, `medications`, `labReports`, `healthGoals`,
`mealPrepTime`, `budgetPreference`, and the life-stage block (`lifeStage`,
`pregnancyTrimester`, `isBreastfeeding`, `menopauseStage`).

Readers of `assessment_data` treat it as free-form `jsonb` and read every field
defensively, so profiles saved before this change keep working and the dropped
keys simply read as absent. Two consequences worth knowing:

- Features gated on `lifeStage === "pregnancy"` — the patient Health Check page
  and the doctor's pregnant-patient list — no longer have a source for that
  value from the profile. See "Disease detection" below.
- `buildScreeningInputFromAssessment` prefills less of the screening form, so
  the doctor enters more of it by hand.

## Disease detection

Screens a pregnant patient for seven maternal conditions — anaemia, gestational
diabetes, preeclampsia, UTI, thyroid disorder, miscarriage risk and perinatal
mental health. Each condition comes back with a 0-100 risk score, a
low/moderate/high level, the factors that drove it, and next steps.

The form is split across the two roles, because the two halves come from
different places:

- **Patient → Health Check** (`/patient/health-check`) — she reports her own
  symptoms, medical history and wellbeing scales (stress, sleep, mood, support,
  EPDS, PHQ-9), and sees her results immediately. No lab fields are asked for.
  The page is only offered to patients whose stored `assessment_data` has a
  life stage of `pregnancy`. **The profile questionnaire no longer asks for life
  stage** (it is not a constant), so only profiles saved before that change
  carry the value — new patients need life stage captured somewhere else before
  this gate opens for them.
- **Doctor → Disease Detection** (`/doctor/disease-detection`) — lists the
  doctor's accepted pregnant patients (the Patients page also links through per
  patient via "Risk Screening"). Selecting one loads her latest self-report into
  the form; the doctor adds the clinical measurements and lab panel and re-runs.
  Without a self-report the form falls back to her profile, which since the
  static-only change supplies age and family history but not the symptom,
  condition or stress fields.

Both roles see every run in a History tab, labelled by who submitted it.
Laboratory fields left blank mean "not performed" — they never score as a normal
result.

**Backend.** The pipeline lives in `backend/disease_detection/` and is exposed
by two endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/disease/conditions` | GET | Conditions the pipeline covers, the active detector for each, and the accepted symptom vocabulary. |
| `/disease/screen` | POST | Runs a screening. Body is a `ScreeningInput` payload, optionally with `conditions: [...]` to restrict the run to a subset. |

The scoring today is the rule-based analytics ported from the Neuviaa prototype
(`rules.py`), registered per condition through `pipeline.register_detector`. A
detector is any callable of `(ScreeningInput) -> ConditionRisk`, so a trained ML
model can replace a single condition without touching the API or the frontend;
`ConditionRisk.detector` records which one produced each result, which keeps a
mixed rules/ML screening auditable.

**Frontend layout.** The form sections
(`src/components/health/ScreeningFields.tsx`) and the results rendering
(`ScreeningResults.tsx`) are shared by both pages; only the sections each role
gets and the wording differ. Risk-level styling lives in `src/lib/riskLevels.ts`.

**Storage.** Screening runs are recorded in the `disease_screenings` Supabase
table, tagged `submitted_by` = `patient` or `doctor`, so each side can reopen
past results. The table is applied in the hosted project as the
`disease_screenings` migration; `supabase/disease_screenings.sql` is its source,
kept for recreating it in a fresh project. Its RLS lets a patient file and read
only her own checks, and a doctor read and file for patients they treat. If the
table is missing the feature still works — results render normally and simply
are not persisted.

*These scores are decision aids for a clinician, not a diagnosis.*

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

## Deployment (Vercel)

The frontend deploys as its own Vercel project: Root Directory = repo root,
Framework Preset = Vite. Set the frontend environment variables above in that
project's settings, then redeploy.

The backend is **not** combined into the same Vercel project as the
frontend. This was tried (routing backend paths to a Python function under
`/api` alongside the Vite frontend) and hit a platform-level wall: that build
path ignores both of Vercel's documented ways to pin the Python version
(`.python-version` and `pyproject.toml`'s `requires-python`), and numpy has no
prebuilt wheel at all for the Python version Vercel defaults to there, so the
build fails trying to compile numpy/pandas from source. The backend-only
build path (Root Directory = `backend/`, Flask framework preset) does not
have this problem and is known to work — deploy the backend as a separate
Vercel project using that layout if you need it live. Nothing in the current
frontend calls the backend in production, so this only matters once a
feature needs it.
