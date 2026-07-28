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
  `src/services` and `src/lib`.
- `backend/` — Flask API (`app.py`) providing dosha estimation
  (`dosha_estimator.py`, `dosha_model.pkl`), calorie calculation
  (`calorie_calculator.py`), meal planning (`planner.py`), and dataset/DB
  access (`dataset_loader.py`, `db.py`). Config comes from `config.py` and
  `backend/.env`.
- `supabase/` — SQL migrations for the Supabase project.
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

Backend (run from `/backend`):

- `pip install -r requirements.txt`
- `python run.py` or `python app.py` — start the Flask API
- Tests live in `backend/tests`

## Environment variables

Copy `.env.example` to `.env` (frontend, repo root) and `backend/.env`
(backend) and fill in real values.

| Variable | Where | Required | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Frontend | Yes | Supabase project URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) | Frontend | Yes | Supabase anon/publishable key. Safe to expose — protected by RLS. |
| `VITE_FOODOSCOPE_API_KEYS` | Frontend | No | Comma- (or newline-) separated FoodOScope/RecipeDB keys. The client rotates through them — see "FoodOScope API key rotation" below. Falls back to a bundled key if unset. |
| `VITE_FOODOSCOPE_API_KEY` / `VITE_FOODOSCOPE_API_KEY_1` … `_20` | Frontend | No | Alternative way to supply the same keys, one per variable. Merged with `VITE_FOODOSCOPE_API_KEYS`; duplicates are dropped. |
| `SUPABASE_URL` | Backend | Yes | Falls back to `VITE_SUPABASE_URL` if unset. |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Yes | Falls back to `VITE_SUPABASE_ANON_KEY` if unset, but that runs backend Supabase calls as the anon role (subject to RLS) instead of the privileged service role — set this explicitly for full backend access. **Never expose to the browser.** |
| `OPENAI_API_KEY` | Backend | No | Only needed for OpenAI-backed features; the app boots fine without it. |
| `FLASK_ENV` | Backend | Recommended | Set to `production` on deployed environments to disable Flask debug/test routes. Defaults to `development`. |

## FoodOScope API key rotation

Recipe data comes from the FoodOScope (RecipeDB) API, called directly from the
browser by `src/services/foodoscopeApi.ts`. That service accepts **multiple
keys** and rotates between them so a single exhausted or throttled key doesn't
take the recipe features down.

Where to put the keys:

- Root `.env` (and your Vercel frontend project's environment variables) —
  `VITE_FOODOSCOPE_API_KEYS=key-one,key-two,key-three`, and/or one key per
  variable via `VITE_FOODOSCOPE_API_KEY_1` … `VITE_FOODOSCOPE_API_KEY_20`. All
  forms are merged and de-duplicated. With none set, a bundled fallback key is
  used and a warning is logged in dev.
- `src/pages/patient/mealCompatibility.html` — this page is standalone HTML
  with no bundler, so its keys live in the `API_TOKENS` array at the top of its
  `<script>` block. Keep that list in sync with `.env` by hand.

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

These keys are **not secrets** — anything in a `VITE_`-prefixed variable ends
up in the JS bundle and is readable by users. FoodOScope keys are per-app quota
tokens, which is why they're allowed in the frontend; genuine secrets still
belong in `backend/.env`. If a key must stay private, proxy the calls through
the Flask backend instead.

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
