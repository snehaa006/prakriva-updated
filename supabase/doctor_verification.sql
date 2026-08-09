-- Doctor verification: make "verified" mean something.
--
-- Before this file, a doctor's trust fields were whatever the browser said they
-- were. Two separate holes:
--
--   1. `handle_new_user()` read `licenseVerified` / `verificationScore` /
--      `verificationBadge` straight out of `auth.users.raw_user_meta_data`.
--      That metadata is supplied by the client in the `supabase.auth.signUp()`
--      call, so anyone posting `{"licenseVerified": true}` at the signup
--      endpoint got `verification_status = 'verified'`, `can_accept_patients`,
--      `account_status = 'active'` and a trust score of their choosing.
--
--   2. The `doctors_update_own` policy allowed UPDATE on *every* column where
--      `id = auth.uid()`, so an honestly-pending doctor could promote
--      themselves from the browser console with a one-line update.
--
-- The model here: the client may only ever state *claims* (license number,
-- council, degree, clinic). Every field a patient would read as a trust signal
-- is computed or set server-side, and only the service role can flip
-- verification on. The frontend's mocked council lookup is a convenience for
-- the signup form, not evidence.

-- ---------------------------------------------------------------------------
-- 1. Demo accounts need to be identifiable so they can be filtered or purged.
-- ---------------------------------------------------------------------------

alter table public.doctors
  add column if not exists is_demo boolean not null default false;

comment on column public.doctors.is_demo is
  'Seeded demonstration account, not a real practitioner. Purge before launch.';

-- ---------------------------------------------------------------------------
-- 2. Server-side scoring. Mirrors calculateVerificationScore /
--    getVerificationBadge in src/lib/licenseVerification.ts so the number a
--    patient sees is derived from stored columns rather than sent by the
--    client. Keep the two in sync if the weights change.
-- ---------------------------------------------------------------------------

create or replace function public.doctor_profile_score(d public.doctors)
returns integer
language sql
immutable
set search_path = public
as $$
  select least(
    (case when d.license_verified then 50
          when coalesce(d.license_number, '') <> '' then 10
          else 0 end)
    + (case when coalesce(d.medical_degree, '') <> '' then 10 else 0 end)
    + (case when coalesce(d.graduation_year, 0) > 0 then 5 else 0 end)
    + (case when coalesce(d.years_of_experience, 0) > 5 then 5 else 0 end)
    + (case when coalesce(d.ayurvedic_certification, '') <> '' then 8 else 0 end)
    + (case when coalesce(d.traditional_training, '') <> '' then 4 else 0 end)
    + (case when coalesce(array_length(d.ayurvedic_specialization, 1), 0) > 0 then 3 else 0 end)
    + (case when coalesce(d.clinic_name, '') <> '' then 5 else 0 end)
    + (case when coalesce(array_length(d.special_conditions, 1), 0) > 0 then 3 else 0 end)
    + (case when coalesce(array_length(d.languages, 1), 0) > 1 then 2 else 0 end)
    + (case when coalesce(array_length(d.consultation_modes, 1), 0) > 0 then 3 else 0 end)
    + (case when coalesce(d.consultation_fee, '') <> '' then 2 else 0 end),
    100);
$$;

create or replace function public.doctor_badge(p_score integer, p_license_verified boolean)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_license_verified and p_score >= 85 then 'Verified Ayurvedic Expert'
    when p_license_verified and p_score >= 70 then 'Verified Doctor'
    when p_license_verified                   then 'License Verified'
    when p_score >= 50                        then 'Pending Verification'
    else 'Verification Required'
  end;
$$;

-- Is the caller the backend rather than a browser? PostgREST issues
-- `SET LOCAL ROLE` per request, so a publishable-key session is always
-- `authenticated` or `anon` and can never satisfy this.
create or replace function public.is_privileged_writer()
returns boolean
language sql
stable
set search_path = public
as $$
  select current_user in ('postgres', 'supabase_admin', 'service_role')
      or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role';
$$;

-- ---------------------------------------------------------------------------
-- 3. Signup no longer confers trust. Claimed credentials are stored as claims;
--    every trust field starts at its unverified value regardless of metadata.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  user_role text := coalesce(meta ->> 'role', 'patient');
  full_name text := coalesce(meta ->> 'name', '');
begin
  if user_role not in ('doctor', 'patient') then
    user_role := 'patient';
  end if;

  insert into public.profiles (id, role, name, email)
  values (new.id, user_role, full_name, coalesce(new.email, ''))
  on conflict (id) do nothing;

  if user_role = 'doctor' then
    -- Claimed credentials only. licenseVerified / verificationScore /
    -- verificationBadge in the metadata are deliberately ignored: they are
    -- client-supplied and were the original privilege-escalation vector.
    insert into public.doctors (
      id, name, email,
      license_number, medical_council, graduation_year, medical_degree,
      ayurvedic_certification, ayurvedic_specialization, traditional_training,
      clinic_name, clinic_address, years_of_experience, consultation_fee,
      consultation_modes, languages, special_conditions,
      license_verified, license_verification_date, license_verification_details,
      verification_status, verification_level, verification_score,
      verification_badge, trust_score, badges,
      can_accept_patients, is_available, account_status, profile_completed
    )
    values (
      new.id,
      full_name,
      coalesce(new.email, ''),
      meta ->> 'licenseNumber',
      meta ->> 'medicalCouncil',
      coalesce((meta ->> 'graduationYear')::integer, 0),
      meta ->> 'medicalDegree',
      meta ->> 'ayurvedicCertification',
      coalesce(
        (select array_agg(value #>> '{}') from jsonb_array_elements(meta -> 'ayurvedicSpecialization')),
        '{}'::text[]
      ),
      meta ->> 'traditionalTraining',
      meta ->> 'clinicName',
      meta ->> 'clinicAddress',
      coalesce((meta ->> 'yearsOfExperience')::integer, 0),
      meta ->> 'consultationFee',
      coalesce(
        (select array_agg(value #>> '{}') from jsonb_array_elements(meta -> 'consultationModes')),
        '{in-person}'::text[]
      ),
      coalesce(
        (select array_agg(value #>> '{}') from jsonb_array_elements(meta -> 'languages')),
        '{English}'::text[]
      ),
      coalesce(
        (select array_agg(value #>> '{}') from jsonb_array_elements(meta -> 'specialConditions')),
        '{}'::text[]
      ),
      false,            -- license_verified
      null,             -- license_verification_date
      null,             -- license_verification_details: registry evidence only
      'pending',        -- verification_status
      'low',            -- verification_level
      0,                -- verification_score, recomputed by the guard trigger
      null,             -- verification_badge, likewise
      0,                -- trust_score
      '{}'::text[],     -- badges
      false,            -- can_accept_patients
      false,            -- is_available
      'pending_verification',
      true
    )
    on conflict (id) do nothing;
  else
    insert into public.patients (id, name, email)
    values (new.id, full_name, coalesce(new.email, ''))
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Guard trigger. Forces every trust column to its server-derived value on
--    any non-privileged write, and drops a doctor back to pending if they
--    change the license they are claiming.
-- ---------------------------------------------------------------------------

create or replace function public.doctors_enforce_verification()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  claim_changed boolean;
begin
  new.updated_at := now();

  if public.is_privileged_writer() then
    -- Backend writes are trusted, but keep the derived fields coherent.
    new.verification_score := public.doctor_profile_score(new);
    new.trust_score        := new.verification_score;
    new.verification_badge := public.doctor_badge(new.verification_score, new.license_verified);
    new.badges             := case
                                when new.license_verified then array[new.verification_badge]
                                else '{}'::text[]
                              end;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    claim_changed :=
      new.license_number  is distinct from old.license_number
      or new.medical_council is distinct from old.medical_council;

    if claim_changed then
      -- Re-claiming a different license invalidates the old verification.
      new.license_verified             := false;
      new.license_verification_date    := null;
      new.license_verification_details := null;
      new.verification_status          := 'pending';
      new.verification_level           := 'low';
      new.badges                       := '{}'::text[];
      new.can_accept_patients          := false;
      new.is_available                 := false;
      new.account_status               := 'pending_verification';
    else
      -- Anything the client tried to say about its own trustworthiness is
      -- discarded in favour of what is already on the row.
      new.license_verified             := old.license_verified;
      new.license_verification_date    := old.license_verification_date;
      new.license_verification_details := old.license_verification_details;
      new.verification_status          := old.verification_status;
      new.verification_level           := old.verification_level;
      new.badges                       := old.badges;
      new.can_accept_patients          := old.can_accept_patients;
      new.account_status               := old.account_status;
    end if;

    -- Reputation and workload counters are never client-writable.
    new.rating              := old.rating;
    new.total_reviews       := old.total_reviews;
    new.total_consultations := old.total_consultations;
    new.pending_requests    := old.pending_requests;
    new.is_active           := old.is_active;
    new.is_demo             := old.is_demo;
    new.email               := old.email;
    new.created_at          := old.created_at;

    -- A doctor may only mark themselves available once cleared to take patients.
    if not new.can_accept_patients then
      new.is_available := false;
    end if;
  else
    -- A doctor row inserted from the browser starts with no standing at all.
    new.license_verified             := false;
    new.license_verification_date    := null;
    new.license_verification_details := null;
    new.verification_status          := 'pending';
    new.verification_level           := 'low';
    new.badges                       := '{}'::text[];
    new.can_accept_patients          := false;
    new.is_available                 := false;
    new.account_status               := 'pending_verification';
    new.is_demo                      := false;
    new.rating                       := 0;
    new.total_reviews                := 0;
    new.total_consultations          := 0;
    new.pending_requests             := 0;
  end if;

  new.verification_score := public.doctor_profile_score(new);
  new.trust_score        := new.verification_score;
  new.verification_badge := public.doctor_badge(new.verification_score, new.license_verified);

  return new;
end;
$$;

drop trigger if exists doctors_enforce_verification on public.doctors;
create trigger doctors_enforce_verification
  before insert or update on public.doctors
  for each row execute function public.doctors_enforce_verification();

-- ---------------------------------------------------------------------------
-- 5. Column privileges. Belt to the trigger's braces: Postgres rejects the
--    update before RLS is even consulted, so a browser attempt to write a
--    trust column fails loudly with "permission denied for column".
-- ---------------------------------------------------------------------------

revoke update on public.doctors from authenticated;
grant update (
  name,
  phone_number,
  license_number,
  medical_council,
  graduation_year,
  medical_degree,
  ayurvedic_certification,
  ayurvedic_specialization,
  traditional_training,
  clinic_name,
  clinic_address,
  years_of_experience,
  consultation_fee,
  consultation_modes,
  languages,
  special_conditions,
  working_hours,
  bio,
  education,
  is_available,
  profile_completed
) on public.doctors to authenticated;

-- ---------------------------------------------------------------------------
-- 6. The directory only shows doctors who actually cleared verification.
--    A doctor always sees their own row so their dashboard works while pending.
-- ---------------------------------------------------------------------------

drop policy if exists doctors_select_all on public.doctors;
create policy doctors_select_directory on public.doctors
  for select to authenticated
  using (
    id = auth.uid()
    or (verification_status = 'verified' and license_verified and is_active)
  );

-- ---------------------------------------------------------------------------
-- 7. Booking gate. Enforced in the database so it holds even if the UI filter
--    is bypassed, and the pending-requests counter is maintained here rather
--    than by the patient's client (which RLS correctly refused to let it do).
-- ---------------------------------------------------------------------------

create or replace function public.consultation_requests_require_verified_doctor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.doctors;
begin
  select * into d from public.doctors where id = new.doctor_id;

  if not found then
    raise exception 'Doctor % does not exist', new.doctor_id
      using errcode = '23503';
  end if;

  if d.verification_status <> 'verified'
     or not d.license_verified
     or not d.can_accept_patients
     or not d.is_active then
    raise exception '% is not a verified practitioner and cannot accept consultation requests', d.name
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists consultation_requests_require_verified_doctor
  on public.consultation_requests;
create trigger consultation_requests_require_verified_doctor
  before insert on public.consultation_requests
  for each row execute function public.consultation_requests_require_verified_doctor();

create or replace function public.consultation_requests_bump_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.doctors
     set pending_requests = greatest(coalesce(pending_requests, 0), 0)
                            + case when new.status = 'pending' then 1 else 0 end
   where id = new.doctor_id;
  return null;
end;
$$;

drop trigger if exists consultation_requests_bump_pending
  on public.consultation_requests;
create trigger consultation_requests_bump_pending
  after insert on public.consultation_requests
  for each row execute function public.consultation_requests_bump_pending();

-- PostgREST exposes every function in `public` as an RPC endpoint, and these
-- three have no business being called directly — the two above are
-- SECURITY DEFINER, so leaving them reachable hands the browser a function
-- running with the owner's rights. Triggers are unaffected: EXECUTE is checked
-- when the trigger is created, not on each firing.
revoke execute on function public.consultation_requests_require_verified_doctor()
  from public, anon, authenticated;
revoke execute on function public.consultation_requests_bump_pending()
  from public, anon, authenticated;
revoke execute on function public.doctors_enforce_verification()
  from public, anon, authenticated;

revoke execute on function public.doctor_profile_score(public.doctors) from anon;
revoke execute on function public.doctor_badge(integer, boolean) from anon;

-- ---------------------------------------------------------------------------
-- 8. The only route to verified. Service role only — EXECUTE is revoked from
--    the browser roles, and the function is SECURITY INVOKER so it runs with
--    the caller's privileges and trips the guard trigger if misused.
-- ---------------------------------------------------------------------------

create or replace function public.verify_doctor(
  p_doctor_id uuid,
  p_verified  boolean default true,
  p_details   jsonb   default null
)
returns public.doctors
language plpgsql
set search_path = public
as $$
declare
  r public.doctors;
begin
  if not public.is_privileged_writer() then
    raise exception 'verify_doctor may only be called with the service role'
      using errcode = '42501';
  end if;

  update public.doctors
     set license_verified             = p_verified,
         license_verification_date    = case when p_verified then now() else null end,
         license_verification_details = case when p_verified then p_details else null end,
         verification_status          = case when p_verified then 'verified' else 'pending' end,
         verification_level           = case when p_verified then 'high' else 'low' end,
         can_accept_patients          = p_verified,
         account_status               = case when p_verified then 'active' else 'pending_verification' end,
         is_available                 = p_verified
   where id = p_doctor_id
  returning * into r;
  -- verification_score, trust_score, verification_badge and badges are all
  -- derived by the doctors_enforce_verification trigger from the updated row.

  if not found then
    raise exception 'No doctor with id %', p_doctor_id using errcode = 'P0002';
  end if;

  return r;
end;
$$;

comment on function public.verify_doctor(uuid, boolean, jsonb) is
  'Set a doctor''s verification state after a council check. Service role only; pass p_verified => false to revoke.';

revoke execute on function public.verify_doctor(uuid, boolean, jsonb) from public;
revoke execute on function public.verify_doctor(uuid, boolean, jsonb) from anon, authenticated;
grant execute on function public.verify_doctor(uuid, boolean, jsonb) to service_role;

-- is_privileged_writer keeps its default PUBLIC grant on purpose: the guard
-- trigger is SECURITY INVOKER, so an ordinary doctor editing their own profile
-- has to be able to call it. It only reports the caller's own role.

-- ---------------------------------------------------------------------------
-- 9. Existing rows were all created through the compromised trigger, so none of
--    their verification state was ever established. Reset them to pending; the
--    demo accounts are re-verified deliberately in demo_doctors.sql.
-- ---------------------------------------------------------------------------

update public.doctors
   set license_verified             = false,
       license_verification_date    = null,
       license_verification_details = null,
       verification_status          = 'pending',
       verification_level           = 'low',
       badges                       = '{}'::text[],
       can_accept_patients          = false,
       is_available                 = false,
       account_status               = 'pending_verification'
 where true;

-- Reconcile pending_requests, which the old client-side bump never managed to
-- write (RLS refused it), so the counter starts from the truth.
update public.doctors d
   set pending_requests = coalesce(
     (select count(*) from public.consultation_requests c
       where c.doctor_id = d.id and c.status = 'pending'),
     0
   );
