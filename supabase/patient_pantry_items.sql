-- patient_pantry_items — the foods a patient has at home, plus the ones they
-- plan to buy. Source for the `patient_pantry_items` migration, kept here so
-- the table can be recreated in a fresh project.
--
-- Written from the patient's "My Kitchen" page (src/pages/patient/Pantry.tsx)
-- and read by the doctor's Food Explorer (PatientPantryPanel), so a plan can be
-- built around ingredients the patient actually owns.

create table if not exists public.patient_pantry_items (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  food_name text not null,
  -- The plain ingredient noun the recipe API is queried with ("rice"), while
  -- food_name keeps the label the patient picked ("Brown rice"). See
  -- src/data/ingredients.ts.
  search_term text not null default '',
  category text not null default 'other',
  quantity text not null default '',
  availability text not null default 'at_home'
    check (availability in ('at_home', 'to_buy')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patient_pantry_items_patient_idx
  on public.patient_pantry_items (patient_id, availability, food_name);

alter table public.patient_pantry_items enable row level security;

-- A patient owns their own pantry; a treating doctor may read it but never write.
create policy patient_pantry_items_select on public.patient_pantry_items
  for select to authenticated
  using (patient_id = auth.uid() or public.doctor_treats(patient_id));

create policy patient_pantry_items_insert on public.patient_pantry_items
  for insert to authenticated
  with check (patient_id = auth.uid());

create policy patient_pantry_items_update on public.patient_pantry_items
  for update to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

create policy patient_pantry_items_delete on public.patient_pantry_items
  for delete to authenticated
  using (patient_id = auth.uid());

create or replace function public.touch_patient_pantry_items()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists patient_pantry_items_touch on public.patient_pantry_items;
create trigger patient_pantry_items_touch
  before update on public.patient_pantry_items
  for each row execute function public.touch_patient_pantry_items();
