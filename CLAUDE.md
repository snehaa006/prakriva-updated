# CLAUDE.md

This file gives Claude Code guidance for working in this repository.

## Always keep the README up to date

**Whenever you add, remove, or change a feature, script, dependency, environment
variable, folder, or setup step, update `README.md` in the same change.** This
is a standing rule for every task in this repo, not just ones that mention
docs. Concretely:

- New page/route, component, or backend endpoint → add or update the relevant
  section of the README (feature list, API overview, etc.).
- New/changed npm script, CLI command, or backend entrypoint → update the
  "Getting Started" / "Scripts" section.
- New/changed environment variable → update `.env.example` **and** the README's
  environment variable table/list.
- New dependency that changes how the project is run or configured (e.g. a new
  service like Supabase, a new Python package required for the backend) →
  mention it in the README's tech stack / prerequisites.
- Structural changes (new top-level folder, renamed `backend`/`src` layout) →
  update the project structure section.

If a change is purely internal (refactor, tests, styling tweak) and nothing
user- or developer-facing changed, it's fine to leave the README untouched —
but say so explicitly rather than skipping silently.

Never let README.md drift out of sync with the actual state of the repo.

## Project overview

This is **Prakriva**, an Ayurvedic diet/wellness planning app with two parts:

- **Frontend** (`/src`): React + TypeScript + Vite, using shadcn/ui + Radix +
  Tailwind CSS. Routes are split into `patient/` and `doctor/` areas
  (`src/pages/patient`, `src/pages/doctor`) behind `PatientLayout` /
  `DoctorLayout`. App-wide state lives in `src/context` (`AppContext`,
  `FoodContext`). Data access to Supabase and other APIs lives in
  `src/services`.
- **Backend** (`/backend`): Python/Flask API (`app.py`) providing dosha
  estimation (`dosha_estimator.py`, `dosha_model.pkl`), calorie calculation
  (`calorie_calculator.py`), meal planning (`planner.py`), and dataset/DB
  access (`dataset_loader.py`, `db.py`). Config comes from `config.py` and
  `backend/.env`.
- **Supabase** (`/supabase`): backing database/auth for the frontend, using
  row-level security. Public keys go in the frontend `.env` file
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`); service-role keys are
  backend-only and must never be exposed to the browser.

## Commands

Frontend (run from repo root):
- `npm run dev` — start Vite dev server
- `npm run build` — production build
- `npm run build:dev` — development-mode build
- `npm run lint` — ESLint
- `npm run preview` — preview a production build
- `npm run test` / `test:watch` / `test:coverage` — Vitest

Backend (run from `/backend`):
- `python run.py` or `python app.py` — start the Flask API
- `python -m pytest tests/` — backend tests (no `.env` needed; `conftest.py`
  supplies placeholder Supabase credentials)

## Conventions

- Use the `@/` path alias for imports from `src` (see `vite.config.ts` /
  `tsconfig.json`) rather than long relative paths.
- UI primitives come from `src/components/ui` (shadcn); prefer composing those
  over hand-rolled markup for buttons, dialogs, forms, etc.
- Keep pages thin: Supabase/API calls belong in `src/services`, reusable domain
  rules in `src/lib`. `src/pages/auth` is the worked example of this split.
- Frontend tests live in `__tests__/` next to the code under test; shared test
  setup and the Supabase mock live in `src/test`.
- Keep secrets out of the frontend — anything sensitive belongs in
  `backend/.env`, not `.env`/`.env.example` at the root.
