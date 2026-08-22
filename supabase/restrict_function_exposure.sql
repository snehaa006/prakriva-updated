-- Applied to project pghvmhakfwtxkwvlxokc. Record of what is deployed;
-- idempotent and safe to re-run.
--
-- PostgREST publishes every function in an exposed schema as an RPC endpoint,
-- so a SECURITY DEFINER function is reachable at /rest/v1/rpc/<name> and runs
-- with its owner's privileges. Several here only ever ran as triggers.
--
-- Two groups, because a blanket revoke breaks the database:
--
--   * Trigger-only and unused functions lose EXECUTE entirely. Triggers keep
--     firing: PostgreSQL does not check EXECUTE on a trigger function against
--     the user performing the INSERT or UPDATE.
--
--   * doctor_treats, community_member and current_role_is are called from
--     inside 24 RLS policies between them, and policies evaluate as the
--     querying user -- revoking from `authenticated` would make all of them
--     fail. They lose PUBLIC and anon only.
--
-- Revoking from PUBLIC is the part that matters: EXECUTE is granted to PUBLIC
-- by default, so revoking from anon and authenticated alone changes nothing.

do $$
declare
    fn record;
    lock_down text[] := array[
        'community_admit', 'community_profile_keys', 'community_recount',
        'handle_new_user_patient_track', 'rls_auto_enable',
        'touch_patient_pantry_items', 'community_condition_key'
    ];
    policy_helpers text[] := array[
        'doctor_treats', 'community_member', 'current_role_is'
    ];
begin
    for fn in
        select p.oid::regprocedure as sig, p.proname
        from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and p.proname = any (lock_down || policy_helpers)
    loop
        execute format('revoke execute on function %s from public, anon, authenticated', fn.sig);
        if fn.proname = any (policy_helpers) then
            execute format('grant execute on function %s to authenticated', fn.sig);
        end if;
    end loop;
end $$;

-- A mutable search_path lets a caller prepend their own schema so an
-- unqualified name inside the function resolves to their object instead.
do $$
declare fn record;
begin
    for fn in
        select p.oid::regprocedure as sig from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and p.proname = 'community_condition_key'
    loop
        execute format('alter function %s set search_path to ''public''', fn.sig);
    end loop;
end $$;
