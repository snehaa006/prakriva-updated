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
- **Deployment**: a single Vercel project serves the built frontend as static
  assets and the Flask backend as a Python serverless function on the same
  domain (see `vercel.json`).

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
- `vercel.json` — routes backend endpoints (`/health`, `/generate`,
  `/plan/*`, `/user/*`, `/dosha/*`, `/calories/*`, `/analytics`,
  `/datasets/*`, `/test/*`, `/debug/*`) to the Python function; everything
  else is served as the static frontend build (SPA fallback to
  `index.html`).

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

This repo deploys as **one Vercel project** with the project's Root Directory
set to the repo root (not `backend/`). `vercel.json` builds the frontend via
`@vercel/static-build` (output `dist/`) and the backend via `@vercel/python`
(`backend/app.py`), and routes backend paths to the Python function while
everything else falls through to the static frontend.

Set the environment variables above in the Vercel project settings, then
redeploy.
