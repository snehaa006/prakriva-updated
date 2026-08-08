-- disease_screenings — one row per run of the maternal disease detection
-- pipeline (backend `/disease/screen`). Rows come from two places: the patient's
-- own health check (`submitted_by = 'patient'`, no doctor attached) and the
-- doctor's screening page (`submitted_by = 'doctor'`). The frontend degrades
-- gracefully when this table is absent: results still render, they just are not
-- stored.
--
-- Apply from the Supabase SQL editor, or `supabase db execute -f` against the
-- project. The policies reuse the existing `public.doctor_treats(patient_id)`
-- helper that the other doctor-facing tables use; confirm its argument type in
-- your project before applying if it was changed.

create table if not exists public.disease_screenings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  -- Null on a patient's own health check — she may not have a doctor yet.
  doctor_id uuid references public.doctors (id) on delete set null,
  submitted_by text not null default 'doctor' check (
    submitted_by in ('patient', 'doctor')
  ),
  -- The submitted form and the pipeline verdict are kept verbatim so a stored
  -- screening stays reproducible after the scoring rules change.
  inputs jsonb not null,
  result jsonb not null,
  -- Denormalised for filtering/sorting without unpacking `result`.
  overall_risk_level text not null check (
    overall_risk_level in ('low', 'moderate', 'high')
  ),
  highest_risk_condition text,
  created_at timestamptz not null default now(),
  -- A clinician-run screening must record who ran it.
  constraint disease_screenings_doctor_required_for_clinician_runs check (
    submitted_by = 'patient' or doctor_id is not null
  )
);

create index if not exists disease_screenings_patient_created_idx
  on public.disease_screenings (patient_id, created_at desc);

create index if not exists disease_screenings_doctor_created_idx
  on public.disease_screenings (doctor_id, created_at desc);

alter table public.disease_screenings enable row level security;

-- A doctor reads and writes screenings for patients they treat; the patient
-- reads her own and records her own health checks. Nobody edits or deletes a
-- recorded screening from the browser.
create policy "doctors read screenings for their patients"
  on public.disease_screenings for select
  to authenticated
  using (public.doctor_treats(patient_id));

create policy "patients read their own screenings"
  on public.disease_screenings for select
  to authenticated
  using (patient_id = auth.uid());

create policy "doctors record screenings for their patients"
  on public.disease_screenings for insert
  to authenticated
  with check (
    submitted_by = 'doctor'
    and doctor_id = auth.uid()
    and public.doctor_treats(patient_id)
  );

-- A patient can only file a self-report against herself, and cannot pass it off
-- as a clinician's screening.
create policy "patients record their own health checks"
  on public.disease_screenings for insert
  to authenticated
  with check (
    submitted_by = 'patient'
    and patient_id = auth.uid()
    and doctor_id is null
  );
