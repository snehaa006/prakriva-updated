# Supabase

This project uses Supabase (Postgres + Auth) instead of Firebase. There is no
data migration — the Firestore data was intentionally not carried over.

Project: `pghvmhakfwtxkwvlxokc` — https://pghvmhakfwtxkwvlxokc.supabase.co

## Schema

| Table                   | Replaces                                    |
| ----------------------- | ------------------------------------------- |
| `profiles`              | role marker (was implicit in which collection held the doc) |
| `doctors`               | `doctors` (verification rules in `doctor_verification.sql`, demo rows in `demo_doctors.sql`) |
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
| `foodoscope_api_keys`   | — (new; FoodOScope keys the frontend rotates through) |
| `disease_screenings`    | — (new; maternal disease screening runs, see `disease_screenings.sql`) |
| `patient_pantry_items`  | — (new; foods a patient has at home / plans to buy, see `patient_pantry_items.sql`) |
| `community_groups`      | — (new; the peer support circles, see `community.sql`) |
| `community_memberships` | — (new; request-to-join rows, one per patient per circle) |
| `community_messages`    | — (new; the chat inside a circle)            |
| `menstrual_cycle_logs`  | — (new; the PCOD/PCOS period log, see `pcos_tracking.sql`) |
| `missed_cycle_months`   | — (new; months explicitly reported as having no period) |
| `weight_logs`           | — (new; one weight reading per patient per day)   |
| `acne_logs`             | — (new; dated skin check-ins, photos in the `acne-photos` bucket) |
| `contact_messages`      | — (new; the public landing page's contact form, see `contact_messages.sql`) |

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
- `contact_messages` is the one **insert-only** table: anon and authenticated
  may `INSERT` and have no `SELECT`, `UPDATE` or `DELETE` policy at all, so the
  browser's key cannot read a single row back. Triage happens with the
  service-role key. It is also optional — the frontend
  (`src/services/contactService.ts`) falls back to a prefilled `mailto:` when
  the table is missing, so the landing page works before this is applied.

## Auth

`public.handle_new_user()` runs on insert into `auth.users`. It reads the role
(and, for doctors, their claimed credentials) out of the signup metadata and
creates the `profiles` row plus the matching `doctors`/`patients` row. Doing it
in a trigger rather than a follow-up insert from the browser means it still
works when email confirmation is on and there is no session yet.

That metadata comes from the browser's `signUp()` call, so it is untrusted. The
trigger treats it as claims only: it stores the license number, council and
degree an applicant states, and ignores anything asserting a *result* —
`licenseVerified`, `verificationScore`, `verificationBadge`. Every doctor is
created `pending`. See "Doctor verification" below.

## Doctor verification

`doctor_verification.sql` holds the whole model. Two holes it closes: the
trigger above used to copy `licenseVerified` straight out of client metadata
(so `{"licenseVerified": true}` at the signup endpoint bought a verified,
patient-accepting account), and `doctors_update_own` allowed UPDATE on every
column of your own row (so a pending doctor could promote themselves from the
browser console).

- **Column grants.** `UPDATE` is revoked from `authenticated` and re-granted
  per column, covering profile fields only. Writing `verification_status`,
  `license_verified`, `trust_score`, `badges`, `rating` or the consultation
  counters is denied by Postgres before RLS is reached.
- **`doctors_enforce_verification`** (BEFORE INSERT OR UPDATE) is the second
  layer: on a non-privileged write it restores the protected columns from the
  stored row and recomputes `verification_score` / `verification_badge` /
  `badges` via `doctor_profile_score()` and `doctor_badge()`. Those two are SQL
  mirrors of `calculateVerificationScore` / `getVerificationBadge` in
  `src/lib/licenseVerification.ts` — keep the weights in step. Changing the
  claimed license or council resets the doctor to pending.
- **`verify_doctor(id, verified, details)`** is the only route to verified.
  `EXECUTE` is revoked from `anon` and `authenticated`, so it needs the
  service-role key. It is `SECURITY INVOKER` on purpose: it runs as the caller
  and would trip the guard trigger if it were ever reachable from the browser.
  `is_privileged_writer()` decides that, off `current_user` — PostgREST issues
  `SET LOCAL ROLE` per request, so a publishable-key session can never satisfy
  it. That function keeps its default `PUBLIC` grant because the guard trigger
  is `SECURITY INVOKER` and an ordinary doctor editing their profile has to be
  able to call it; it only reports the caller's own role.
- **The gate is real.** `doctors_select_directory` hides unverified doctors
  from patients (a doctor still reads their own row, so the dashboard works
  while pending), and `consultation_requests_require_verified_doctor` rejects
  bookings against an unverified doctor in the database.
- **`consultation_requests_bump_pending`** maintains `doctors.pending_requests`.
  It used to be updated by the patient's browser, which RLS correctly refused —
  a patient cannot write another user's `doctors` row — so the counter never
  actually moved.

`demo_doctors.sql` seeds three fictional demonstration practitioners flagged
`doctors.is_demo`, verified through `verify_doctor()` like any real approval.
Purge them before launch:

```sql
delete from auth.users where id in (select id from public.doctors where is_demo);
```

## Row level security

RLS is on for every table. The browser holds only the publishable key, so these
policies are the access control:

- Patients read and write their own rows. Doctors additionally see patients they
  have a non-rejected consultation request with (`public.doctor_treats`).
- The doctor directory is readable by any signed-in user, but only lists
  verified doctors; a doctor additionally reads their own row while pending,
  and writes only their own row — and only its non-verification columns. See
  "Doctor verification" above.
- `generated_plans`, `doctor_edits` and `user_feedback` have RLS on with **no
  policies at all**, so the publishable key can never reach them. The Python
  backend uses the service-role key, which bypasses RLS by design. The
  "RLS Enabled No Policy" advisor notice on those three tables is expected.
- `contact_messages` is the mirror image of that: one `INSERT` policy for anon
  and authenticated (`with check (true)` — the column constraints are what stop
  a junk row), and nothing else. No public `SELECT` is deliberate rather than an
  oversight; a contact table readable with the browser's own key is a mailing
  list anyone can download, carrying whatever a patient wrote about her health
  before she had an account. Reading and triaging use the service-role key.
- `disease_screenings` is written from both sides: a patient inserts only her
  own health check (`submitted_by = 'patient'`, `doctor_id is null`), a doctor
  only for patients they treat (`public.doctor_treats`) and only tagged as their
  own. Reads follow the same split. There is no update or delete policy, so a
  recorded screening is immutable from the browser.
- `patient_pantry_items` is owned by the patient: they insert, update and delete
  only rows where `patient_id = auth.uid()`. A treating doctor (`doctor_treats`)
  can read a patient's pantry but has no write policy, so the kitchen list is
  always the patient's own statement of what they have.
- The PCOD/PCOS trackers (`menstrual_cycle_logs`, `missed_cycle_months`,
  `weight_logs`, `acne_logs`) are owned by the patient: she inserts, updates
  and deletes only rows where `patient_id = auth.uid()`. A treating doctor
  (`doctor_treats`) reads them but has no write policy. They are deletable,
  unlike `disease_screenings` — a mistyped period date is the patient's own
  data to correct, not a clinician's finding to preserve.
- The `acne-photos` storage bucket is **private**. These are photographs of a
  patient's face; a public bucket would make every one readable by URL to
  anyone who guessed a path. The storage policies key off the first path
  segment (`<patient-id>/…`), so a patient can only reach her own folder and a
  wrong prefix is a server-side rejection rather than a trusted claim. The
  frontend renders them through short-lived signed URLs.
- The `avatars` storage bucket (`profile_avatars.sql`) is the one **public**
  bucket in this project, and deliberately so: avatars are shown to people who
  are not the owner (a doctor's patient list, the Consult cards, community
  posts), and `avatarService` renders them with `getPublicUrl` rather than
  minting a signed URL per viewer per face. Read is public; writing is still
  keyed off the first path segment (`<user-id>/avatar.jpg`), so an account can
  only ever write its own. It carries an UPDATE policy where `acne-photos` does
  not, because replacing a photo is an upsert over the existing object. Nothing
  clinical belongs in here — skin photos stay in the private bucket.
- `patients.health_tracks` is deliberately *not* protected like the doctor
  verification columns. It decides which of her own trackers a patient sees,
  not what she may reach, so it is safe both for the client to state at signup
  and for her to change later (she may become pregnant, or get a PCOS
  diagnosis). It is an **array** because pregnancy and PCOS commonly coexist —
  a single-valued column would make a pregnant PCOS patient pick which half of
  her care to give up. An empty array means general wellness; null means she
  was never asked.
- `foodoscope_api_keys` is `select`-able by `authenticated` where `is_active`,
  with no write policy: keys are added and retired from the dashboard (or the
  service role), never from the browser. These are FoodOScope quota tokens
  rather than secrets — any signed-in user can read them, which is the same
  exposure as baking them into the bundle. Nothing that must stay private
  belongs in this table.
- The community tables are gated on `public.community_member(group_id)`: only an
  approved member of a circle reads or writes its `community_messages`, so a
  signed-in stranger cannot read a pregnancy or PCOS conversation. Memberships
  are readable by the patient herself and by approved members of the same circle
  (which is what makes peer approval possible), insertable only for herself, and
  updatable only by approved members. `community_admit()` is the second layer
  under that update policy: it forces every new request to `pending` (except the
  founding member of an empty circle, admitted immediately so a new circle is
  joinable at all), restores every column but `status` on update, and refuses a
  status change from anyone who is not an approved member. There is no update
  policy on messages — a message cannot be rewritten after it is read — but an
  author may delete her own.
- `community_member` is `SECURITY DEFINER` for the same reason as `doctor_treats`,
  with one addition: a policy on `community_memberships` that queried
  `community_memberships` directly would recurse.
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
`diet_plan_authorship`, `diet_plan_builder_payloads`, `seed_demo_doctors`,
`foodoscope_api_keys`, `disease_screenings`, `patient_pantry_items`,
`diet_plans_medical_notes_array`, `create_lifestyle_logs`,
`patient_pantry_items_search_term`, `community_circles`, `pcos_tracking`.

`disease_screenings.sql`, `patient_pantry_items.sql`, `lifestyle_logs.sql`,
`community.sql` and `pcos_tracking.sql` in this folder are the sources for the
matching migrations, kept here so the tables can be recreated in a fresh
project.

`community_circles` added the Community tab's three tables, the
`community_member()` / `community_admit()` / `community_recount()` functions and
the eight seed circles. The file is re-runnable: every policy is dropped before
it is recreated and the seed insert is `on conflict (slug) do nothing`. It also
adds `community_messages` to the `supabase_realtime` publication so the chat
updates live; that step is guarded, so re-applying it is harmless.

`pcos_tracking` added the PCOD/PCOS care track: `patients.health_tracks`, the
`on_auth_user_created_track` trigger that fills it from signup metadata, the
four tracker tables, and the private `acne-photos` bucket. If an earlier
revision of the file was already applied, it migrates the single-valued
`health_track` column into the array and drops it. It depends on
`handle_new_user()` from `doctor_verification.sql` having already created the
`patients` row, so apply that file first in a fresh project — Postgres runs
same-event triggers in name order, and `on_auth_user_created` sorts before
`on_auth_user_created_track`.

Every table it adds degrades gracefully in the frontend: a project that has not
applied it keeps working, and the trackers fall back to localStorage (cycles,
weight) or report themselves unavailable (skin, which needs the bucket).

`create_lifestyle_logs` added the Lifestyle Tracker's daily sleep/activity/
hydration log. It replaced `junk_food_streak_logs`, whose tab was retired in
favour of the diet plan / daily nutrition view (which reads `meal_tracking`
instead). That table is still present but unused, and is safe to drop.

`patient_pantry_items_search_term` added the plain ingredient noun the recipe
API is queried with (`rice`) next to the label the patient picked (`Brown
rice`). See `src/data/ingredients.ts`.

`diet_plans_medical_notes_array` widened `diet_plans.medical_notes` from `text`
to `text[]`. The frontend has always produced a list of notes
(`GeneratedDietChart.medicalNotes`), so against the scalar column every
personalized-diet-chart save was rejected.
