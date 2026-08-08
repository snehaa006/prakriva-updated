-- junk_food_streak_logs — one row per patient per calendar day, recording
-- whether she ate junk food that day. The Lifestyle Tracker's "No Junk Food
-- Streak" feature derives the current/longest streak from these rows
-- (src/lib/junkFoodStreak.ts). The frontend degrades gracefully when this
-- table is absent: the streak just shows as not-yet-tracked rather than erroring.
--
-- Apply from the Supabase SQL editor, or `supabase db execute -f` against the
-- project.

create table if not exists public.junk_food_streak_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  log_date date not null,
  ate_junk_food boolean not null,
  created_at timestamptz not null default now(),
  -- One entry per patient per day; logging again the same day corrects it
  -- rather than creating a duplicate (the frontend upserts on this pair).
  unique (patient_id, log_date)
);

create index if not exists junk_food_streak_logs_patient_date_idx
  on public.junk_food_streak_logs (patient_id, log_date desc);

alter table public.junk_food_streak_logs enable row level security;

-- Purely a personal habit log — only the patient herself ever reads or writes
-- it, unlike disease_screenings which a treating doctor also reads.
create policy "patients read their own junk food logs"
  on public.junk_food_streak_logs for select
  to authenticated
  using (patient_id = auth.uid());

create policy "patients record their own junk food logs"
  on public.junk_food_streak_logs for insert
  to authenticated
  with check (patient_id = auth.uid());

-- Needed so today's entry can be corrected (toggling clean/junk) via upsert
-- rather than only ever being insertable once.
create policy "patients update their own junk food logs"
  on public.junk_food_streak_logs for update
  to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());
