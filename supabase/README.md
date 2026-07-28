# Supabase

This project uses Supabase (Postgres + Auth) instead of Firebase. There is no
data migration — the Firestore data was intentionally not carried over.

Project: `pghvmhakfwtxkwvlxokc` — https://pghvmhakfwtxkwvlxokc.supabase.co

## Schema

| Table                   | Replaces                                    |
| ----------------------- | ------------------------------------------- |
| `profiles`              | role marker (was implicit in which collection held the doc) |
| `doctors`               | `doctors`                                   |
| `patients`              | `patients` (+ `metadata/patientCounter`)    |
| `consultation_requests` | `consultationRequests` + `doctors/{id}/requests` |
| `notifications`         | `patients/{id}/notifications` + `doctors/{id}/notifications` |
| `diet_plans`            | `patients/{id}/dietPlans`                   |
| `meal_feedback`         | `patients/{id}/mealFeedback`                |
| `meal_tracking`         | `patients/{id}/mealTracking/{date}`         |
| `appointments`          | `doctors/{id}/appointments`                 |
| `generated_plans`       | `generated_plans` (backend)                 |
| `doctor_edits`          | `doctor_edits` (backend)                    |
| `user_feedback`         | `user_feedback` (backend)                   |

Notes on the shape:

- Nested plan bodies stay documents (`jsonb`): `diet_plans.meals`,
  `patients.assessment_data`, `consultation_requests.full_patient_profile`.
  Everything that gets filtered or sorted on is a real column.
- `patients.patient_code` (P001, P002, …) is a sequence default. The old
  read-increment-write of a counter document could hand the same id to two
  concurrent signups.
- The doctor's `doctors/{id}/requests` mirror is gone; `consultation_requests`
  is queried by `doctor_id` directly.
- `meal_tracking` has a unique index on `(patient_id, date)`, which is what the
  Firestore document id of `{date}` gave us.

## Auth

`public.handle_new_user()` runs on insert into `auth.users`. It reads the role
(and, for doctors, the verification payload) out of the signup metadata and
creates the `profiles` row plus the matching `doctors`/`patients` row. Doing it
in a trigger rather than a follow-up insert from the browser means it still
works when email confirmation is on and there is no session yet.

## Row level security

RLS is on for every table. The browser holds only the publishable key, so these
policies are the access control:

- Patients read and write their own rows. Doctors additionally see patients they
  have a non-rejected consultation request with (`public.doctor_treats`).
- The doctor directory is readable by any signed-in user; a doctor writes only
  their own row.
- `generated_plans`, `doctor_edits` and `user_feedback` have RLS on with **no
  policies at all**, so the publishable key can never reach them. The Python
  backend uses the service-role key, which bypasses RLS by design. The
  "RLS Enabled No Policy" advisor notice on those three tables is expected.
- `current_role_is` and `doctor_treats` are `SECURITY DEFINER` and must stay
  executable by `authenticated`, because RLS policy expressions are evaluated as
  the querying role. `EXECUTE` is revoked from `anon`.

## Configuration

Frontend (`.env.local`, and Vercel project env vars):

    VITE_SUPABASE_URL=https://pghvmhakfwtxkwvlxokc.supabase.co
    VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

Backend (`backend/.env`, and Vercel env vars — never expose these to the browser):

    SUPABASE_URL=https://pghvmhakfwtxkwvlxokc.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=...

`supabase-py` 2.15.1 validates that the key is a JWT, so use the legacy
`service_role` key rather than a `sb_secret_...` key.

## Migrations

Migrations are applied in the hosted project. To materialise them as local
files:

    supabase link --project-ref pghvmhakfwtxkwvlxokc
    supabase db pull

Applied so far: `init_core_schema`, `backend_plan_tables`,
`enable_rls_policies`, `handle_new_user_trigger`, `harden_functions`,
`appointments_and_meal_tracking`, `consultation_response_message`,
`patient_self_service_diet_plans`, `notification_patient_columns`,
`diet_plan_authorship`, `diet_plan_builder_payloads`.
