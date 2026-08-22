-- Applied to project pghvmhakfwtxkwvlxokc. This file is the record of what is
-- deployed; it is idempotent and safe to re-run.
--
-- Stops a row's owner from editing the columns that decide what they are.
--
-- The update policies check *which row* you may write, never *which columns*:
--     profiles_update_own  WITH CHECK (id = auth.uid())
-- `profiles.role` lives in that row, so a patient could run
-- `UPDATE profiles SET role = 'doctor'` on her own record and the policy would
-- allow it — she does own the row. On `doctors` the same gap exposed
-- `license_verified`, letting an account mark its own medical licence valid.
--
-- Column privileges cannot express this: the owner legitimately updates other
-- fields on the same row, so revoking UPDATE would break ordinary edits. A
-- trigger compares old to new and only objects when a privileged value changes.

-- NOTE ON SECURITY DEFINER: an earlier version tested
-- `current_user in ('service_role', 'postgres', …)`, which is always true
-- inside a SECURITY DEFINER function — that is exactly what rewrites
-- current_user to the owner. The caller's real role survives only in the JWT
-- claims, which SECURITY DEFINER does not touch, so read it from there.
create or replace function public.is_privileged_writer()
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
    claims text := current_setting('request.jwt.claims', true);
    claim_role text;
begin
    -- No claims: a direct database connection (dashboard, migration, psql).
    -- A browser can never reach Postgres this way.
    if claims is null or claims = '' then
        return true;
    end if;

    begin
        claim_role := (claims::json ->> 'role');
    exception when others then
        return false;   -- unparseable claims grant nothing
    end;

    if claim_role = 'service_role' then
        return true;
    end if;

    return exists (
        select 1 from public.profiles
        where id = (select auth.uid()) and role = 'admin'
    );
end;
$$;

revoke execute on function public.is_privileged_writer() from anon, authenticated;

create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
    if new.role is distinct from old.role and not public.is_privileged_writer() then
        raise exception 'role cannot be changed' using errcode = '42501';
    end if;
    return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update on public.profiles
    for each row execute function public.guard_profile_role();

create or replace function public.guard_doctor_verification()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
    if not public.is_privileged_writer() and (
           new.license_verified   is distinct from old.license_verified
        or new.verification_status is distinct from old.verification_status
        or new.account_status      is distinct from old.account_status
        or new.license_verification_date    is distinct from old.license_verification_date
        or new.license_verification_details is distinct from old.license_verification_details
    ) then
        raise exception 'verification fields are set by review, not by the account holder'
            using errcode = '42501';
    end if;
    return new;
end;
$$;

drop trigger if exists doctors_guard_verification on public.doctors;
create trigger doctors_guard_verification before update on public.doctors
    for each row execute function public.guard_doctor_verification();

create or replace function public.guard_patient_status()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
    if new.status is distinct from old.status and not public.is_privileged_writer() then
        raise exception 'status cannot be changed' using errcode = '42501';
    end if;
    return new;
end;
$$;

drop trigger if exists patients_guard_status on public.patients;
create trigger patients_guard_status before update on public.patients
    for each row execute function public.guard_patient_status();
