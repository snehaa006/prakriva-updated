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
| `SUPABASE_URL` | Backend | Yes | Falls back to `VITE_SUPABASE_URL` if unset. |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Yes | Falls back to `VITE_SUPABASE_ANON_KEY` if unset, but that runs backend Supabase calls as the anon role (subject to RLS) instead of the privileged service role — set this explicitly for full backend access. **Never expose to the browser.** |
| `OPENAI_API_KEY` | Backend | No | Only needed for OpenAI-backed features; the app boots fine without it. |
| `FLASK_ENV` | Backend | Recommended | Set to `production` on deployed environments to disable Flask debug/test routes. Defaults to `development`. |

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
