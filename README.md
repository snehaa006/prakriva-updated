# Prakriva

An Ayurvedic diet/wellness planning app connecting doctors and patients. Doctors
manage patients, build recipes and diet charts, and review dosha/consultation
data; patients complete an Ayurvedic health questionnaire and get a
personalized diet plan.

## Tech stack

- **Frontend**: React + TypeScript + Vite, shadcn/ui + Radix + Tailwind CSS,
  React Router.
- **Backend**: Python/Flask API providing dosha estimation, calorie
  calculation, meal planning, and plan storage.
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
- `supabase/` — SQL migrations for the Supabase project.
- `public/` — static assets served as-is, including the standalone
  `mealCompatibility.html` visualisation (reachable at
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

Supabase is mocked at the client boundary (`src/test/supabaseMock.ts`), so the
real auth and license logic runs in tests; no test touches a live project.

## Environment variables

Copy `.env.example` to `.env` (frontend, repo root) and `backend/.env.example`
to `backend/.env` (backend), then fill in real values. Both `.env` files are
gitignored and must stay that way — only the `.env.example` templates are
committed.

| Variable | Where | Required | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Frontend | Yes | Supabase project URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) | Frontend | Yes | Supabase anon/publishable key. Safe to expose — protected by RLS. |
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
