-- PCOD/PCOS care track — the health-track column, the three trackers behind it,
-- and the private storage bucket the skin photos live in.
--
-- Why this exists
-- ---------------
-- Prakriva began as a maternal app: every patient was assumed pregnant, so the
-- maternal screening (`disease_screenings`) and the pregnancy nutrition targets
-- applied to everyone. A PCOD/PCOS patient has no screening to run — she
-- already has the diagnosis, and the models behind that page are trained on
-- pregnancy conditions. What her plan is built from instead is her own
-- tracking: cycles, weight and skin, read alongside the exercise minutes
-- already in `lifestyle_logs`.
--
-- `patients.health_tracks` is what decides which of those worlds a patient
-- sees. It is a set rather than one value, because pregnancy and PCOS commonly
-- coexist and a patient carrying both needs both. It is set from signup
-- metadata by the trigger below, and back-filled from the browser on first
-- sign-in for accounts created before this migration (see
-- src/services/healthTrackService.ts).
--
-- Every table here degrades gracefully in the frontend: a project that has not
-- applied this file keeps working, the trackers simply fall back to
-- localStorage (cycles, weight) or report themselves unavailable (skin, which
-- needs the bucket).
--
-- Apply from the Supabase SQL editor, or `supabase db execute -f` against the
-- project. The policies reuse the existing `public.doctor_treats(patient_id)`
-- helper the other doctor-facing tables use.

-- ---------------------------------------------------------------------------
-- 1. Which care pathways a patient signed up for.
--
--    A **set**, not one value. Pregnancy and PCOS routinely coexist — PCOS is
--    one of the more common reasons a pregnancy is higher-risk, and a patient
--    does not stop having it the month she conceives. A single-valued column
--    would force her to pick which half of her care to give up. An empty array
--    is an answer (general wellness); null means she was never asked.
-- ---------------------------------------------------------------------------

alter table public.patients
  add column if not exists health_tracks text[]
    check (health_tracks <@ array['pregnancy', 'pcos']::text[]);

comment on column public.patients.health_tracks is
  'Care pathways chosen at signup, any of {pregnancy, pcos}. Empty array = '
  'general wellness; null = never asked. Decides which patient tabs exist and '
  'which nutritional targets the diet plan generator starts from (pregnancy '
  'wins when both apply). Null on accounts created before the tracks existed; '
  'the frontend resolves those from assessment_data.';

-- Carry over the single-valued `health_track` if an earlier revision of this
-- file was already applied. Guarded so a fresh project skips it entirely.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'patients'
      and column_name = 'health_track'
  ) then
    update public.patients
       set health_tracks = case
             when health_track in ('pregnancy', 'pcos') then array[health_track]
             when health_track = 'general' then '{}'::text[]
             else null
           end
     where health_tracks is null;

    alter table public.patients drop column health_track;
  end if;
end
$$;

-- Unlike the doctor verification columns, this is not a trust signal: it
-- decides which of her own trackers a patient sees, not what she may reach.
-- So it is safe both for the client to state at signup and for her to change
-- later (she may become pregnant, or get a PCOS diagnosis). The existing
-- `patients` update policy already scopes that to her own row.

-- ---------------------------------------------------------------------------
-- 2. Carry the tracks through signup.
--
--    Replaces the patient branch of `handle_new_user()` from
--    doctor_verification.sql; the doctor branch is untouched, so apply that
--    file first if you are building a project from scratch.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user_patient_track()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  tracks text[];
begin
  if coalesce(meta ->> 'role', 'patient') <> 'patient' then
    return new;
  end if;

  -- Absent or malformed metadata leaves the column null ("never asked")
  -- rather than storing an empty array, which would claim she answered
  -- "general wellness" on her behalf.
  if jsonb_typeof(meta -> 'healthTracks') <> 'array' then
    return new;
  end if;

  select coalesce(array_agg(value #>> '{}'), '{}'::text[])
    into tracks
    from jsonb_array_elements(meta -> 'healthTracks')
   where value #>> '{}' in ('pregnancy', 'pcos');

  update public.patients
     set health_tracks = tracks
   where id = new.id
     and health_tracks is null;

  return new;
end;
$$;

comment on function public.handle_new_user_patient_track() is
  'Copies the signup metadata health tracks onto the patients row. Runs after '
  'handle_new_user() has created that row.';

-- Name-ordered after `on_auth_user_created`, so the patients row exists by the
-- time this fires. Postgres runs same-event triggers alphabetically.
drop trigger if exists on_auth_user_created_track on auth.users;
create trigger on_auth_user_created_track
  after insert on auth.users
  for each row
  execute function public.handle_new_user_patient_track();

-- ---------------------------------------------------------------------------
-- 3. menstrual_cycle_logs — one row per recorded period.
-- ---------------------------------------------------------------------------

create table if not exists public.menstrual_cycle_logs (
  -- Client-generated, so a cached entry and its server row are the same row
  -- (src/services/cycleLogService.ts is local-first, like the lifestyle logs).
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  start_date date not null,
  -- Null while the period is still ongoing; the analysis skips duration for
  -- those rather than treating them as a one-day bleed.
  end_date date,
  flow text check (flow in ('spotting', 'light', 'moderate', 'heavy')),
  -- Symptom ids from src/lib/cycleTracking.ts, e.g. {cramps,acne,bloating}.
  symptoms text[] not null default '{}'::text[],
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One entry per bleed. Logging the same start date again corrects it, which
  -- is what the frontend upserts on — two rows for one period would
  -- double-count the cycle history everything else is derived from.
  unique (patient_id, start_date),
  constraint menstrual_cycle_logs_end_after_start
    check (end_date is null or end_date >= start_date)
);

create index if not exists menstrual_cycle_logs_patient_date_idx
  on public.menstrual_cycle_logs (patient_id, start_date desc);

alter table public.menstrual_cycle_logs enable row level security;

-- A patient owns her cycle log. A treating doctor reads it — unlike the
-- lifestyle log, this is the clinical record her diet plan is generated from,
-- so a doctor who cannot see it cannot explain the plan she is signing off.
create policy "patients read their own cycle logs"
  on public.menstrual_cycle_logs for select
  to authenticated
  using (patient_id = auth.uid());

create policy "doctors read cycle logs for their patients"
  on public.menstrual_cycle_logs for select
  to authenticated
  using (public.doctor_treats(patient_id));

create policy "patients record their own cycle logs"
  on public.menstrual_cycle_logs for insert
  to authenticated
  with check (patient_id = auth.uid());

create policy "patients update their own cycle logs"
  on public.menstrual_cycle_logs for update
  to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

-- Deletable, unlike a recorded screening: a mistyped period date is the
-- patient's own data to correct, not a clinician's finding to preserve.
create policy "patients delete their own cycle logs"
  on public.menstrual_cycle_logs for delete
  to authenticated
  using (patient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. missed_cycle_months — months the patient reports having had no period.
--
--    Kept separate from the gaps between logged periods on purpose. A patient
--    who joins mid-way has gaps that are missing *data*, not missing periods,
--    and treating those as amenorrhoea would put a false clinical finding in
--    front of her doctor.
-- ---------------------------------------------------------------------------

create table if not exists public.missed_cycle_months (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  -- Stored as text "YYYY-MM": this is a calendar month, not a day, and a date
  -- column would invite a spurious day-of-month.
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (patient_id, month)
);

create index if not exists missed_cycle_months_patient_month_idx
  on public.missed_cycle_months (patient_id, month desc);

alter table public.missed_cycle_months enable row level security;

create policy "patients read their own missed months"
  on public.missed_cycle_months for select
  to authenticated
  using (patient_id = auth.uid());

create policy "doctors read missed months for their patients"
  on public.missed_cycle_months for select
  to authenticated
  using (public.doctor_treats(patient_id));

create policy "patients record their own missed months"
  on public.missed_cycle_months for insert
  to authenticated
  with check (patient_id = auth.uid());

create policy "patients update their own missed months"
  on public.missed_cycle_months for update
  to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

create policy "patients delete their own missed months"
  on public.missed_cycle_months for delete
  to authenticated
  using (patient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. weight_logs — one reading per patient per day.
-- ---------------------------------------------------------------------------

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  log_date date not null,
  -- Bounds mirror the signup field's. Anything outside is a typo (a weight in
  -- pounds, a stray digit) and would distort every trend read off it.
  weight_kg numeric(5, 1) not null check (weight_kg >= 25 and weight_kg <= 250),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Weighing yourself twice in a morning corrects the day rather than adding a
  -- second point.
  unique (patient_id, log_date)
);

create index if not exists weight_logs_patient_date_idx
  on public.weight_logs (patient_id, log_date desc);

alter table public.weight_logs enable row level security;

create policy "patients read their own weight logs"
  on public.weight_logs for select
  to authenticated
  using (patient_id = auth.uid());

create policy "doctors read weight logs for their patients"
  on public.weight_logs for select
  to authenticated
  using (public.doctor_treats(patient_id));

create policy "patients record their own weight logs"
  on public.weight_logs for insert
  to authenticated
  with check (patient_id = auth.uid());

create policy "patients update their own weight logs"
  on public.weight_logs for update
  to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

create policy "patients delete their own weight logs"
  on public.weight_logs for delete
  to authenticated
  using (patient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. acne_logs — dated skin check-ins, with an optional photo.
-- ---------------------------------------------------------------------------

create table if not exists public.acne_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  log_date date not null,
  -- The patient's own rating. Authoritative: she can see her face in daylight,
  -- and it is the only field the nutrition/skincare guidance branches on.
  severity text not null check (severity in ('clear', 'mild', 'moderate', 'severe')),
  regions text[] not null default '{}'::text[],
  notes text not null default '',
  -- Object path in the private `acne-photos` bucket, always `<patient-id>/…`.
  photo_path text,
  -- What the vision model reported (backend /analysis/acne-photo). Stored
  -- beside her rating rather than replacing it, and null whenever Gemini is
  -- unconfigured, unreachable, or could not judge the photo.
  ai_severity text check (ai_severity in ('clear', 'mild', 'moderate', 'severe')),
  ai_observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, log_date)
);

create index if not exists acne_logs_patient_date_idx
  on public.acne_logs (patient_id, log_date desc);

alter table public.acne_logs enable row level security;

create policy "patients read their own skin check-ins"
  on public.acne_logs for select
  to authenticated
  using (patient_id = auth.uid());

create policy "doctors read skin check-ins for their patients"
  on public.acne_logs for select
  to authenticated
  using (public.doctor_treats(patient_id));

create policy "patients record their own skin check-ins"
  on public.acne_logs for insert
  to authenticated
  with check (patient_id = auth.uid());

create policy "patients update their own skin check-ins"
  on public.acne_logs for update
  to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

create policy "patients delete their own skin check-ins"
  on public.acne_logs for delete
  to authenticated
  using (patient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7. The acne-photos bucket.
--
--    Private, always. These are photographs of a patient's face; a public
--    bucket would make every one of them readable by URL to anyone who
--    guessed a path. The frontend renders them through short-lived signed
--    URLs (src/services/acneLogService.ts).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'acne-photos',
  'acne-photos',
  false,
  8388608,  -- 8 MB, matching the backend's assessment limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Ownership is the first path segment, so a patient can only ever reach her
-- own folder — the client picks the path, and this is what makes a wrong
-- prefix a server-side rejection rather than a trusted claim.
create policy "patients read their own acne photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'acne-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "doctors read acne photos for their patients"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'acne-photos'
    and public.doctor_treats(((storage.foldername(name))[1])::uuid)
  );

create policy "patients upload their own acne photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'acne-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "patients delete their own acne photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'acne-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
