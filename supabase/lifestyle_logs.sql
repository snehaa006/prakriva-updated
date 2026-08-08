-- lifestyle_logs — one row per patient per calendar day holding the Lifestyle
-- Tracker's sleep, activity and hydration entries. The activity streak and the
-- hydration goal history are derived from these rows
-- (src/lib/lifestyleLog.ts).
--
-- The frontend is local-first: every entry is cached in localStorage and then
-- mirrored here (src/services/lifestyleLogService.ts), so a missing table
-- degrades gracefully — the tracker keeps working per-device and simply isn't
-- backed up or shared across devices.
--
-- Replaces junk_food_streak_logs, whose tab was retired in favour of the diet
-- plan / daily nutrition view (which reads meal_tracking instead). If that
-- table exists in your project it is now unused and safe to drop.
--
-- Apply from the Supabase SQL editor, or `supabase db execute -f` against the
-- project.

create table if not exists public.lifestyle_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  log_date date not null,
  -- Null until the patient logs sleep for that day; 0 would read as "slept
  -- zero hours" and drag the weekly average down.
  sleep_hours numeric(4, 1),
  sleep_quality text check (sleep_quality in ('deep', 'disturbed', 'insufficient')),
  -- Minutes per exercise id, e.g. {"brisk-walk": 30, "pranayama": 10}. Keyed by
  -- the ids in src/lib/exerciseRecommendations.ts, which vary per patient
  -- because the exercises are recommended from her conditions.
  activity_minutes jsonb not null default '{}'::jsonb,
  water_glasses integer not null default 0,
  -- Stored per day so raising the goal later doesn't retroactively fail days
  -- that met the old one.
  water_goal integer not null default 8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One entry per patient per day; logging again the same day corrects it
  -- rather than creating a duplicate (the frontend upserts on this pair).
  unique (patient_id, log_date)
);

create index if not exists lifestyle_logs_patient_date_idx
  on public.lifestyle_logs (patient_id, log_date desc);

alter table public.lifestyle_logs enable row level security;

-- A personal wellbeing log — only the patient herself reads or writes it,
-- unlike disease_screenings which a treating doctor also reads.
create policy "patients read their own lifestyle logs"
  on public.lifestyle_logs for select
  to authenticated
  using (patient_id = auth.uid());

create policy "patients record their own lifestyle logs"
  on public.lifestyle_logs for insert
  to authenticated
  with check (patient_id = auth.uid());

-- Needed so a day can be corrected (more water, more minutes) via upsert
-- rather than only ever being insertable once.
create policy "patients update their own lifestyle logs"
  on public.lifestyle_logs for update
  to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());
