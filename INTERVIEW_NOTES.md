# Prakriva — Interview Revision Notes

A short, plain-language revision sheet for talking about this project in an SDE
interview. Covers: what the project is, how each part works, the CS
fundamentals behind it, and the AI/ML pieces.

---

## 1. The 60-second pitch

> "Prakriva is an Ayurvedic diet and wellness app with two types of users —
> doctors and patients. Patients fill a health questionnaire, get their body
> type (dosha) predicted, get a personalised diet plan, and track periods,
> skin, sleep and water. Doctors manage those patients, build recipes and diet
> charts, and run a maternal health risk screening that flags anaemia,
> gestational diabetes, preeclampsia and thyroid risk.
>
> Frontend is React + TypeScript + Vite. Backend is a Python Flask API with the
> ML models. Data and auth are on Supabase (Postgres with row-level security).
> The whole app is multilingual and there's an in-app chatbot."

Three things worth adding if they ask "what was hard":
- Keeping ML predictions **reproducible** (I reimplemented model inference in
  plain numpy so predictions don't change with library versions).
- Keeping secrets **off the browser** (service keys and LLM keys stay on Flask).
- Making the app **fast and resilient** (caching layers, key rotation,
  fallbacks at every step).

---

## 2. Architecture (draw this on the whiteboard)

```
  Browser (React + TS + Vite)
        |                    \
        | supabase-js          \  fetch (VITE_API_URL)
        v                        v
  Supabase Postgres  <------  Flask API (Python)
  (Auth + RLS)      service    - dosha model (RandomForest)
                    role key   - calorie calculator
                               - meal / diet planner
                               - disease detection (XGBoost, LogReg, NN)
                               - Gemini / Groq LLM calls
```

- Frontend deploys to **Vercel**, backend to **Render** (`render.yaml`).
- Frontend talks to Supabase **directly** for normal CRUD (fast, no server hop),
  and to Flask only for things that need models or secrets.

---

## 3. Frontend — concepts to know

| Concept | Where it is | One-line explanation |
|---|---|---|
| SPA + client routing | `src/App.tsx`, React Router | One HTML page; the router swaps components instead of reloading. |
| Protected routes | `ProtectedRoute`, `PatientProtectedRoute`, `TrackRoute` | A wrapper component that checks auth/role/care-track before rendering, else `<Navigate>` redirects. |
| Global state | `src/context/AppContext.tsx`, `FoodContext`, `I18nContext` | React **Context API** — avoids prop drilling for user, language, food data. |
| Server state | `@tanstack/react-query` + `useCachedPageData` | Caches API results so switching tabs doesn't refetch and flash a spinner. `staleTime` 5 min, `gcTime` 30 min. |
| Custom hooks | `src/hooks/*` | Reusable stateful logic: `useCachedPageData`, `usePersistentState`, `useDoctorPatients`, `useCountUp`. |
| Component library | `src/components/ui` (shadcn + Radix) | Unstyled accessible primitives + Tailwind classes. |
| Forms + validation | `react-hook-form` + `zod` | Schema describes valid data; resolver runs it on submit. |
| Types | TypeScript, `src/types/*` | Compile-time safety; interfaces shared between pages and services. |
| Layered code | pages → services → lib | Pages stay thin; Supabase/API calls in `src/services`, pure rules in `src/lib`. |
| Testing | Vitest + React Testing Library (46 test files) | Tests sit in `__tests__/` next to the code; Supabase is mocked. |

**Why the layering matters (good answer):** business rules in `src/lib` are pure
functions — no network, no React — so they can be unit-tested in milliseconds.
Components only render.

### React fundamentals they may ask
- **Virtual DOM / reconciliation** — React diffs a virtual tree and patches only
  what changed.
- **Hooks rules** — only at the top level, only in components/hooks.
- `useState` vs `useRef` — state re-renders, ref doesn't.
- `useEffect` cleanup — used for subscriptions like Supabase's
  `onAuthStateChange` and the DOM translator.
- **Keys in lists** — stable identity so React reuses DOM nodes.
- **Context re-render cost** — every consumer re-renders when the value changes;
  that's why server data lives in React Query, not Context.

---

## 4. Backend — concepts to know

| Concept | Where | Explanation |
|---|---|---|
| REST API | `backend/app.py` (~40 routes) | Resource URLs + HTTP verbs, JSON in/out. e.g. `POST /generate`, `POST /dosha/predict`, `POST /disease/screen`. |
| App factory | `create_app()` | Builds the Flask app so tests can create a fresh instance. |
| Request validation | `backend/models.py` (Pydantic) | Incoming JSON is parsed into typed models; bad input → 400, not a crash. |
| Central error handling | `@app.errorhandler` + `exceptions.py` | Custom exception classes map to clean JSON error responses. |
| Rate limiting | `flask-limiter` | Per-IP quotas per route (e.g. 20/min for dosha, 20/hour for LLM routes) — protects cost and stops abuse. |
| Caching | `flask-caching` `@cache.memoize(3600)` | Datasets loaded once per hour instead of per request. |
| CORS | `flask-cors` | Browser only allows cross-origin calls the server permits; Vercel preview URLs matched by regex. |
| Reverse proxy awareness | `ProxyFix(x_for=1)` | Render terminates TLS, so real client IP comes from `X-Forwarded-For`. Without it, all users share one rate-limit bucket. Trust exactly **one** hop so callers can't spoof. |
| Auth | `backend/auth.py` | Bearer JWT verified with Supabase; `require_self` / `require_admin` decorators. |
| Config | `config.py` + `.env` | 12-factor style: environment variables, never hardcoded secrets. |
| Logging | `loguru` + request ID in `before_request` | Every request traceable. |
| Testing | `pytest` (8 test modules) | `conftest.py` injects placeholder credentials so tests need no real `.env`. |

**Key security line to say out loud:**
> "The backend holds the Supabase **service-role key**, which bypasses row-level
> security. So identity must come from the verified JWT, never from a `user_id`
> in the request body — otherwise every endpoint becomes an 'any patient's
> records' endpoint. And everything fails closed."

---

## 5. Database, auth, security

- **Supabase = hosted Postgres + Auth + Storage.**
- **Row Level Security (RLS):** policies on each table so a patient's query can
  only return her own rows — enforced by Postgres, not by frontend code.
  Example: `using (patient_id = auth.uid())`.
- **Trigger on signup:** `on_auth_user_created` reads the new user's metadata
  and creates `profiles` + `doctors`/`patients` rows automatically.
- **Client-controlled data is a claim, not a fact:** signup metadata can say
  "I'm a verified doctor", so the trigger ignores it and every doctor starts as
  `pending`.
- **Column-level guard trigger** (`guard_privileged_columns.sql`): RLS says
  *which row* you can update, not *which column*. Without the trigger a patient
  could run `UPDATE profiles SET role='doctor'` on her own row. A trigger
  compares OLD vs NEW and rejects changes to privileged columns.
- **Keys:** `VITE_`-prefixed vars are compiled into the browser bundle →
  publishable/anon key only. Service role key and Gemini/Groq/OpenAI keys live
  in backend env only.
- **Constraints used:** primary keys (uuid), foreign keys with
  `on delete cascade`, `unique (patient_id, log_date)` so re-logging a day
  **upserts** instead of duplicating, `check` constraints for enums, and
  composite indexes like `(patient_id, log_date desc)` for fast recent-first
  reads.

---

## 6. AI / ML — point to point

### 6.1 Dosha prediction (body-type classification)
- **Model:** `RandomForestClassifier` (200 trees), scikit-learn, trained in
  `train_dosha_model.py`, saved with `pickle` as `dosha_model.pkl`.
- **Preprocessing:** categorical features → `LabelEncoder`, numeric →
  `StandardScaler`. **Encoders and scaler are pickled with the model**, because
  inference must use the exact same transforms as training.
- **Data split:** `train_test_split(test_size=0.2, random_state=42)`; accuracy
  printed on the held-out set.
- **Hybrid approach** (`predict_dosha_hybrid`): the ML model predicts, and
  optionally an LLM also predicts from the profile. The two are merged by
  **confidence-weighted averaging**, and the final confidence is scaled by how
  much they agree. If the LLM key is missing, ML alone is used; if both fail,
  a safe default is returned.
- **Why RandomForest:** tabular data, mixed categorical features, small dataset,
  handles non-linearity, resistant to overfitting through bagging, and gives
  class probabilities (used as confidence).

### 6.2 Maternal disease detection (the most interesting part)
Five conditions: **anaemia, pregnancy risk, GDM, preeclampsia, thyroid.**

- **Strategy pattern / detector registry** (`disease_detection/pipeline.py`):
  a detector is any function `(ScreeningInput) -> ConditionRisk`.
  Rule-based scorers are registered first as a baseline; trained models are
  registered over them with `register_detector(..., replace=True)`.
  Nothing downstream knows which kind answered — `ConditionRisk.detector`
  records the version (`"anaemia-xgb-v1"`, `"rules-v1"`) so results stay
  auditable.
- **Models used:**
  - Anaemia + pregnancy risk → **XGBoost** (gradient boosted trees).
  - GDM and preeclampsia → **logistic regression**.
  - Thyroid → a small **neural network** (Dense + BatchNorm + ReLU, sigmoid out).
- **Reproducible inference in numpy:** instead of calling sklearn/Keras at
  runtime, the trained weights are exported to JSON/npz and the forward pass is
  recomputed by hand:
  - Logistic regression = `standardise → dot product → sigmoid`.
  - Neural net = `ReLU(xW+b)` layers with batch-norm folded into a fixed affine
    transform (dropout is identity at inference), so it's just four matrix
    multiplications.
  - Conversion scripts **assert** the numpy output matches the original
    library's `predict_proba` — so predictions can't drift when a dependency
    upgrades.
- **Missing data handling:** continuous features are **median-imputed** using
  the *training* medians, and the response lists which features were imputed
  (honest output). But if the defining input is missing — e.g. haemoglobin for
  anaemia — the detector **falls back to the rules** instead of inventing a
  value, because a defaulted haemoglobin makes the score meaningless.
- **Output:** a 0-100 score, a risk level (LOW < 30 ≤ MODERATE < 60 ≤ HIGH),
  human-readable reasons, and recommendations.

### 6.3 LLMs (Gemini / Groq / OpenAI)
- Used for **explanation and generation**, never for scoring: the model gets
  the already-computed risk scores and measurements and writes the narrative.
  It's explicitly told not to invent numbers, because a screening tool whose
  risk level changes run to run would be unsafe and unauditable.
- **Privacy:** no name, email or patient ID is ever sent — only measurements.
- **Key rotation:** a pool of keys with per-key **cooldowns** (429 → 60s,
  401/403 → 15 min, 5xx → 30s); the last working key is tried first. Groq is the
  cross-provider fallback when Gemini is exhausted.
- Also powers: diet-chart generation, lab-report extraction, the skin-tracker
  photo read, and the two chatbots (patient companion + doctor assistant).

### 6.4 Non-ML "algorithms" worth mentioning
- **Calorie engine:** BMR via **Harris-Benedict** and **Mifflin-St Jeor**, then
  activity multiplier → TDEE, then a goal adjustment (±400 kcal).
- **Food filtering & scoring** (`filter_and_score.py`): filter out allergens
  (regex matching over name + ingredients), then **score and rank** remaining
  foods against the user's dosha, then pass only the top snippet to the planner.
  This is a classic *filter → score → rank → top-k* pipeline, and it also keeps
  the LLM prompt small.
- **Meal planning:** LLM plan first; a deterministic **template fallback** per
  dosha if the LLM is unavailable. The API never hard-fails.

---

## 7. CS fundamentals used here (with the concrete example)

| Fundamental | Where it shows up |
|---|---|
| **Time/space complexity** | Food filtering is O(n) per rule over the dataset; ranking is O(n log n); indexed Postgres lookups are O(log n) vs O(n) table scans. |
| **Hash maps** | Translation phrase cache (`Map<string,string>`), feature encoders, detector registry `Dict[str, Detector]` — all O(1) lookup. |
| **Caching + cache invalidation** | Three levels: React Query (in-memory, `staleTime`), localStorage (`src/lib/localCache.ts` with `storedAt` timestamps + max-age), Flask memoize (TTL 3600s). Classic time-based invalidation. |
| **LRU-ish eviction** | Translation cache caps at 6000 phrases per language to stay inside the localStorage quota. |
| **Concurrency control** | Translation batching: chunks of ~1200 chars, **max 4 requests in flight**, plus an in-flight map to **deduplicate** identical requests. |
| **Timeouts & backoff** | 6s request timeout, 60s backoff after failure — a hung socket must not block the UI. |
| **Idempotency** | `unique (patient_id, log_date)` + upsert: logging the same day twice corrects, never duplicates. |
| **Design patterns** | Strategy (detector registry), Factory (`create_app`), Singleton (cached model state, Supabase client), Decorator (`@require_self`, `@limiter.limit`), Repository (`db.py`, `src/services`), Provider/Observer (React Context, auth state listener). |
| **SOLID** | Single responsibility (pages vs services vs lib), Open/Closed (add a detector without touching the pipeline), Dependency inversion (pipeline depends on the detector *signature*, not on XGBoost). |
| **OOP** | `DoshaPredictor`, `MealPlanner`, `SupabaseManager`, `CalorieCalculator`; dataclasses for prediction outputs; enums for dosha/risk levels. |
| **Networking / HTTP** | REST verbs, status codes (400/401/403/429/500), CORS preflight, JWT bearer auth, reverse proxies and `X-Forwarded-For`. |
| **Databases** | Normalisation (profiles → doctors/patients), FKs with cascade, indexes, triggers, transactions, JSONB for flexible columns like `activity_minutes`. |
| **Security** | Principle of least privilege (anon key in browser, service key on server), fail-closed auth, never trust client input, secrets in env vars, rate limiting, SQL injection avoided by the parameterised client. |
| **Graceful degradation** | Every external dependency has a fallback: no LLM → templates; no model input → rules; no Supabase table → localStorage-only; no network → cached translations. |
| **Testing** | Unit tests for pure logic, mocked Supabase for service tests, component tests with Testing Library, pytest for backend routes. |

---

## 8. Likely interview questions → short answers

**Q: Why React Query when you already have Context?**
Context is for client state that rarely changes (user, language). React Query is
for *server* state — it adds caching, staleness, background refetch and
deduplication, which Context would make me hand-roll.

**Q: Why Flask, not doing everything in Node?**
The ML stack is Python (scikit-learn, XGBoost, numpy, pandas). Keeping models
where their libraries live avoids serving models over an extra bridge.

**Q: How do you keep a patient from reading another patient's data?**
Two layers. Postgres RLS enforces it for every browser query, so even a crafted
request returns nothing. The Flask API holds the service-role key which bypasses
RLS, so it verifies the JWT itself and derives identity from the token, never
from the request body.

**Q: Your model predictions must be identical every run — how?**
Weights are exported and the forward pass is recomputed in numpy, with a
conversion script that asserts it matches the training library's output. That
removes the dependency-version drift you get from unpickling a model.

**Q: What happens when the LLM API is down or over quota?**
Key rotation with cooldowns, then a different provider (Groq), then a
deterministic fallback (templates for meal plans, the FoodOScope recipe path for
diet charts). The feature degrades; the request never 500s.

**Q: How did you make the app feel fast?**
Cached page data so navigating back to a tab renders instantly and revalidates
underneath, `staleTime` tuned to 5 minutes, dataset memoization on the server,
and a 150ms delay on the spinner so a cached load never flashes one.

**Q: Biggest bug/learning?**
The rate limiter behind Render's proxy: `remote_addr` was the proxy, so every
user shared one bucket and the health checker could rate-limit real users.
Fixed with `ProxyFix(x_for=1)` — trusting exactly one hop, since trusting more
lets a caller spoof its own quota.

**Q: What would you improve next?**
Move rate-limit storage to Redis so it works with multiple workers; add proper
model monitoring/metrics; expand test coverage on the doctor flows; add CI
checks for the model-conversion assertions.

---

## 9. Numbers and facts to quote

- ~40 REST endpoints in `backend/app.py`; 5 screening conditions; 5 trained models.
- 46 frontend test files (Vitest + RTL), 8 backend test modules (pytest).
- Frontend: React 18, TypeScript, Vite, Tailwind, shadcn/Radix, React Router 6,
  React Query 5, react-hook-form + zod, Recharts.
- Backend: Flask, Pydantic, scikit-learn, XGBoost, numpy, pandas, loguru,
  flask-limiter, flask-caching, supabase-py.
- Deployment: Vercel (frontend) + Render (backend) + Supabase (DB/auth).
- Caching levels: React Query → localStorage → Flask memoize.
- Risk bands: LOW < 30 ≤ MODERATE < 60 ≤ HIGH.

---

## 10. Files to open if they ask "show me the code"

| To show | File |
|---|---|
| Routing + route guards | `src/App.tsx` |
| Caching design | `src/hooks/useCachedPageData.ts`, `src/lib/localCache.ts` |
| Clean service layer | `src/services/authService.ts` |
| Concurrency + backoff | `src/services/translationService.ts` |
| API design, rate limits, error handling | `backend/app.py` |
| Auth reasoning | `backend/auth.py` |
| Extensible ML design | `backend/disease_detection/pipeline.py` |
| Hand-written inference | `backend/disease_detection/ml/inference.py` |
| Model training | `backend/train_dosha_model.py` |
| Security trigger | `supabase/guard_privileged_columns.sql` |
