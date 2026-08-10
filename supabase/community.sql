-- Community — peer support circles patients join and chat in.
--
-- Three tables:
--   community_groups      the circles on offer (pregnancy, PCOS, thyroid, …)
--   community_memberships one row per patient per circle, request-to-join
--   community_messages    the chat inside a circle
--
-- A patient is let straight into a circle her own record matches — pregnant
-- into the Pregnancy Circle, PCOS into the PCOS circle — because making her
-- wait outside the one place written for her is the thing that reads as broken.
-- The first patient into an empty circle is admitted for the same practical
-- reason: otherwise nobody could ever approve anyone. Everybody else asks, and
-- an existing member admits her. That keeps moderation inside the circle rather
-- than requiring an admin the app does not have, without stranding the women
-- the circle exists for.
--
-- Everything private lives behind `public.community_member()`: a patient can
-- only read the chat of a circle she has been approved into, so a pregnancy or
-- PCOS conversation is never readable by a signed-in stranger.
--
-- Apply from the Supabase SQL editor, or `supabase db execute -f` against the
-- project. The frontend degrades gracefully while this is unapplied: the
-- Community page shows an empty state instead of erroring
-- (src/services/communityService.ts).

-- ── Groups ──────────────────────────────────────────────────────────────────

create table if not exists public.community_groups (
  id uuid primary key default gen_random_uuid(),
  -- Stable handle the frontend matches profiles against
  -- (src/lib/community.ts) — renaming a circle must not change who it suits.
  slug text not null unique,
  name text not null,
  description text not null,
  -- Who it is for, in one line, shown on the join dialog.
  who_its_for text not null,
  -- Condition keys from src/lib/exerciseRecommendations.ts, plus the life
  -- stages in the profile questionnaire. A patient whose profile or screening
  -- matches any of these sees the circle recommended to her.
  matches text[] not null default '{}',
  -- Denormalised so the browse list can show "42 members" without reading
  -- memberships it is not allowed to see. Maintained by trigger below.
  member_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.community_groups enable row level security;

-- The catalogue itself is public to signed-in users — you have to be able to
-- see a circle exists before you can ask to join it. Nothing private is here.
drop policy if exists "signed in users browse active circles" on public.community_groups;
create policy "signed in users browse active circles"
  on public.community_groups for select
  to authenticated
  using (is_active);

-- ── Memberships ─────────────────────────────────────────────────────────────

create table if not exists public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.community_groups (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  -- What she is called in the chat. Defaulted to a first name + initial by the
  -- frontend, and editable, so nobody is forced to post under her full name.
  display_name text not null,
  -- The note that goes with the request ("34 weeks, first baby").
  intro text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  -- One request per patient per circle; asking again reuses the same row.
  unique (group_id, patient_id)
);

create index if not exists community_memberships_group_status_idx
  on public.community_memberships (group_id, status);

create index if not exists community_memberships_patient_idx
  on public.community_memberships (patient_id);

alter table public.community_memberships enable row level security;

/**
 * Is the caller an approved member of this circle?
 *
 * SECURITY DEFINER on purpose: the membership policies below have to consult
 * community_memberships, and a policy that queries its own table recurses.
 * Running as the owner reads the table without RLS and breaks that cycle — the
 * same reason `doctor_treats` is defined this way.
 */
create or replace function public.community_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_memberships m
    where m.group_id = gid
      and m.patient_id = auth.uid()
      and m.status = 'approved'
  );
$$;

revoke execute on function public.community_member(uuid) from anon;
grant execute on function public.community_member(uuid) to authenticated;

/**
 * The plan key a free-text condition maps to, mirroring `matchConditionKey`
 * in src/lib/exerciseRecommendations.ts.
 *
 * This is duplicated in SQL rather than read off the request because the
 * frontend cannot be trusted with it: whether a patient is admitted to the
 * PCOS circle without approval has to be decided from what is stored about
 * her, not from a list of keys her browser posted. Keep the two in step —
 * `ALIASES` there is the source these rows are transcribed from, and the
 * ordering matters ("gestational diabetes" must reach `gdm`, not `diabetes`).
 */
create or replace function public.community_condition_key(raw text)
returns text
language sql
immutable
as $$
  with needle(ord, key, needle) as (
    values
      (1, 'anaemia', 'anaemia'), (1, 'anaemia', 'anemia'),
      (1, 'anaemia', 'low haemoglobin'), (1, 'anaemia', 'low hemoglobin'),
      (1, 'anaemia', 'iron deficiency'),
      (2, 'gdm', 'gestational diabetes'), (2, 'gdm', 'gdm'),
      (3, 'diabetes', 'diabetes'), (3, 'diabetes', 'diabetic'),
      (3, 'diabetes', 'type 2'), (3, 'diabetes', 'type ii'),
      (3, 'diabetes', 'insulin resistance'), (3, 'diabetes', 'prediabetes'),
      (4, 'preeclampsia', 'preeclampsia'), (4, 'preeclampsia', 'pre eclampsia'),
      (4, 'preeclampsia', 'eclampsia'),
      (5, 'hypertension', 'hypertension'), (5, 'hypertension', 'high blood pressure'),
      (5, 'hypertension', 'high bp'), (5, 'hypertension', 'raised bp'),
      (6, 'thyroid', 'thyroid'), (6, 'thyroid', 'hypothyroid'),
      (6, 'thyroid', 'hyperthyroid'), (6, 'thyroid', 'hashimoto'),
      (6, 'thyroid', 'goitre'), (6, 'thyroid', 'goiter'),
      (7, 'pcos', 'pcos'), (7, 'pcos', 'pcod'), (7, 'pcos', 'polycystic'),
      (8, 'mental_health', 'depression'), (8, 'mental_health', 'anxiety'),
      (8, 'mental_health', 'stress'), (8, 'mental_health', 'mental health'),
      (8, 'mental_health', 'panic'), (8, 'mental_health', 'insomnia'),
      (8, 'mental_health', 'mood'),
      (9, 'uti', 'uti'), (9, 'uti', 'urinary tract'),
      (9, 'uti', 'urine infection'), (9, 'uti', 'cystitis'),
      (10, 'miscarriage', 'miscarriage'), (10, 'miscarriage', 'pregnancy loss'),
      (10, 'miscarriage', 'recurrent loss'),
      (11, 'pregnancy_risk', 'high risk pregnancy'), (11, 'pregnancy_risk', 'pregnancy risk'),
      (12, 'obesity', 'obesity'), (12, 'obesity', 'obese'),
      (12, 'obesity', 'overweight'), (12, 'obesity', 'weight gain'),
      (12, 'obesity', 'weight loss'),
      (13, 'arthritis', 'arthritis'), (13, 'arthritis', 'joint pain'),
      (13, 'arthritis', 'osteoarthritis'), (13, 'arthritis', 'rheumatoid'),
      (13, 'arthritis', 'knee pain'),
      (14, 'asthma', 'asthma'), (14, 'asthma', 'breathing'),
      (14, 'asthma', 'respiratory'), (14, 'asthma', 'copd'), (14, 'asthma', 'bronchitis'),
      (15, 'back_pain', 'back pain'), (15, 'back_pain', 'backache'),
      (15, 'back_pain', 'spondyl'), (15, 'back_pain', 'slipped disc'),
      (15, 'back_pain', 'sciatica'),
      (16, 'digestive', 'ibs'), (16, 'digestive', 'constipation'),
      (16, 'digestive', 'bloating'), (16, 'digestive', 'acidity'),
      (16, 'digestive', 'reflux'), (16, 'digestive', 'gerd'),
      (16, 'digestive', 'digestive'), (16, 'digestive', 'indigestion'),
      (17, 'heart_disease', 'heart disease'), (17, 'heart_disease', 'cardiac'),
      (17, 'heart_disease', 'cardiovascular'), (17, 'heart_disease', 'cholesterol'),
      (17, 'heart_disease', 'angina')
  ),
  -- Underscores and hyphens become spaces so a canonical screening key
  -- ('pregnancy_risk', 'mental_health') matches its own phrase needle.
  norm as (select btrim(regexp_replace(lower(coalesce(raw, '')), '[_-]+', ' ', 'g')) as text)
  select n.key
  from needle n, norm
  where norm.text <> '' and position(n.needle in norm.text) > 0
  order by n.ord
  limit 1;
$$;

/**
 * The circle keys a patient's own record matches — the SQL counterpart of
 * `profileMatchKeys` in src/lib/community.ts.
 *
 * Reads her reported conditions, the findings of her latest screening (low-risk
 * ones dropped, as `conditionsFromScreening` does) and her life stage.
 * SECURITY DEFINER because the trigger below runs it for the patient joining,
 * and her screenings are not readable through her own RLS policies in every
 * case; it is only ever called with the caller's own id.
 */
create or replace function public.community_profile_keys(pid uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select coalesce(assessment_data, '{}'::jsonb) as a
    from public.patients where id = pid
  ),
  reported as (
    select jsonb_array_elements_text(p.a->'currentConditions') as raw
    from p where jsonb_typeof(p.a->'currentConditions') = 'array'
    union all
    select p.a->>'currentConditionsOther'
    from p where jsonb_typeof(p.a->'currentConditionsOther') = 'string'
  ),
  latest as (
    select coalesce(result, '{}'::jsonb) as result
    from public.disease_screenings
    where patient_id = pid
    order by created_at desc
    limit 1
  ),
  screened as (
    select c->>'condition' as raw
    from latest, jsonb_array_elements(latest.result->'conditions') c
    where jsonb_typeof(latest.result->'conditions') = 'array'
      and coalesce(c->>'risk_level', '') <> 'low'
  ),
  matched as (
    select public.community_condition_key(raw) as key from reported
    union
    select public.community_condition_key(raw) from screened
    union
    -- The open circle suits everyone, so it is always joinable outright.
    select 'general'
    union
    select case (select a->>'lifeStage' from p)
             when 'pregnancy' then 'pregnancy'
             when 'postpartum' then 'postpartum'
             when 'menopause' then 'menopause'
           end
    union
    select case when (select a->>'isBreastfeeding' from p) = 'yes'
                then 'breastfeeding' end
  )
  select coalesce(array_agg(key), '{}') from matched where key is not null;
$$;

revoke execute on function public.community_profile_keys(uuid) from anon;
grant execute on function public.community_profile_keys(uuid) to authenticated;

/**
 * Admit whoever belongs here, stamp every later decision, and make sure the
 * only thing an update can actually change is the status.
 *
 * A request never arrives approved — status is forced to 'pending' on insert
 * regardless of what the browser sent — except in two cases:
 *
 *   1. The circle has no approved members yet. Somebody has to be first, or a
 *      brand-new circle has nobody able to approve anyone and stays empty.
 *   2. Her own record already matches what the circle is for: a patient whose
 *      profile says she is pregnant is not made to wait outside the Pregnancy
 *      Circle for a stranger to notice her, and the same goes for PCOS,
 *      thyroid, anaemia and the rest. The match is computed here from what is
 *      stored about her, so a browser cannot claim its way in.
 *
 * Approval by an existing member is what remains for everyone else — someone
 * asking into a circle her record says nothing about.
 *
 * The UPDATE branch is the second layer under the "members decide" policy
 * below. That policy has to allow an approved member to write another member's
 * row (that is what approving *is*), so without this a member could rewrite a
 * peer's display name or move her request into a different circle. Everything
 * except the status is restored from the stored row, and a caller who is not
 * an approved member cannot change the status at all — which is what stops a
 * pending patient from waving herself through.
 */
create or replace function public.community_admit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.community_memberships m
      where m.group_id = new.group_id and m.status = 'approved'
    ) or exists (
      select 1 from public.community_groups g
      where g.id = new.group_id
        and g.matches && public.community_profile_keys(new.patient_id)
    ) then
      new.status := 'approved';
      new.decided_at := now();
      new.decided_by := new.patient_id;
    else
      new.status := 'pending';
      new.decided_at := null;
      new.decided_by := null;
    end if;

    return new;
  end if;

  new.id := old.id;
  new.group_id := old.group_id;
  new.patient_id := old.patient_id;
  new.display_name := old.display_name;
  new.intro := old.intro;
  new.requested_at := old.requested_at;

  if new.status is distinct from old.status then
    if not public.community_member(old.group_id) then
      raise exception 'only an approved member of this circle can decide on requests';
    end if;
    new.decided_at := now();
    new.decided_by := auth.uid();
  else
    new.decided_at := old.decided_at;
    new.decided_by := old.decided_by;
  end if;

  return new;
end;
$$;

drop trigger if exists community_memberships_admit on public.community_memberships;
create trigger community_memberships_admit
  before insert or update on public.community_memberships
  for each row execute function public.community_admit();

/** Keep `community_groups.member_count` in step with approved memberships. */
create or replace function public.community_recount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  -- NEW is unassigned in a DELETE trigger and reading it raises, so this has to
  -- branch on TG_OP: coalescing the two — or even a CASE across them — still
  -- evaluates the unassigned record.
  if tg_op = 'DELETE' then
    gid := old.group_id;
  else
    gid := new.group_id;
  end if;

  update public.community_groups g
     set member_count = (
       select count(*) from public.community_memberships m
       where m.group_id = gid and m.status = 'approved'
     )
   where g.id = gid;

  return null;
end;
$$;

drop trigger if exists community_memberships_recount on public.community_memberships;
create trigger community_memberships_recount
  after insert or update or delete on public.community_memberships
  for each row execute function public.community_recount();

-- A patient always sees her own request; approved members additionally see the
-- circle's roster and its pending requests, which is what makes peer approval
-- possible.
drop policy if exists "patients read their own memberships" on public.community_memberships;
create policy "patients read their own memberships"
  on public.community_memberships for select
  to authenticated
  using (patient_id = auth.uid() or public.community_member(group_id));

-- She can only ask on her own behalf. The trigger above decides the status.
drop policy if exists "patients request to join" on public.community_memberships;
create policy "patients request to join"
  on public.community_memberships for insert
  to authenticated
  with check (patient_id = auth.uid());

-- Approving and declining is done by members of the circle. A pending patient
-- fails `community_member`, so nobody can wave herself through.
drop policy if exists "members decide on requests" on public.community_memberships;
create policy "members decide on requests"
  on public.community_memberships for update
  to authenticated
  using (public.community_member(group_id))
  with check (public.community_member(group_id));

-- Leaving a circle (or withdrawing a request) is the patient's own to do.
drop policy if exists "patients leave circles they joined" on public.community_memberships;
create policy "patients leave circles they joined"
  on public.community_memberships for delete
  to authenticated
  using (patient_id = auth.uid());

-- ── Messages ────────────────────────────────────────────────────────────────

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.community_groups (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  -- Copied from the membership at send time so the thread still reads correctly
  -- after she changes her display name or leaves.
  author_name text not null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists community_messages_group_created_idx
  on public.community_messages (group_id, created_at desc);

alter table public.community_messages enable row level security;

-- The whole privacy model in two policies: only approved members of a circle
-- read or write its chat.
drop policy if exists "members read their circle's chat" on public.community_messages;
create policy "members read their circle's chat"
  on public.community_messages for select
  to authenticated
  using (public.community_member(group_id));

drop policy if exists "members post to their circle" on public.community_messages;
create policy "members post to their circle"
  on public.community_messages for insert
  to authenticated
  with check (author_id = auth.uid() and public.community_member(group_id));

-- No update policy: a message cannot be silently rewritten after it is read.
-- Deleting your own is allowed — everyone should be able to take back what
-- they said about their own health.
drop policy if exists "authors delete their own messages" on public.community_messages;
create policy "authors delete their own messages"
  on public.community_messages for delete
  to authenticated
  using (author_id = auth.uid());

-- Realtime: the chat subscribes to inserts on this table. Harmless to repeat —
-- adding a table already in the publication raises, so it is guarded.
do $$
begin
  alter publication supabase_realtime add table public.community_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

-- ── Seed circles ────────────────────────────────────────────────────────────
--
-- `matches` drives the "recommended for you" badges: the slugs are matched
-- against the patient's screening findings, reported conditions and life stage
-- in src/lib/community.ts. Edit the copy freely; keep the slugs.

insert into public.community_groups (slug, name, description, who_its_for, matches)
values
  (
    'pregnancy',
    'Pregnancy Circle',
    'Week-by-week company through pregnancy — symptoms, cravings, scans, and the questions that feel too small to ask a doctor.',
    'Anyone who is currently pregnant, at any trimester.',
    array['pregnancy', 'pregnancy_risk', 'gdm', 'preeclampsia', 'miscarriage']
  ),
  (
    'pcos',
    'PCOS & PCOD Circle',
    'Cycles, insulin resistance, weight, hair and mood — what has actually worked for other women living with PCOS.',
    'Women diagnosed with PCOS or PCOD, or being investigated for it.',
    array['pcos']
  ),
  (
    'thyroid',
    'Thyroid Circle',
    'Hypo and hyper thyroid life: energy crashes, dose changes, test results and how to plan around a flat day.',
    'Women with a thyroid condition, or a thyroid risk flagged by their health check.',
    array['thyroid']
  ),
  (
    'anaemia',
    'Iron & Anaemia Circle',
    'Getting haemoglobin back up — iron that does not wreck your stomach, foods that help, and pacing yourself meanwhile.',
    'Women with anaemia or low haemoglobin.',
    array['anaemia']
  ),
  (
    'diabetes',
    'Blood Sugar Circle',
    'Gestational and type 2 diabetes together: post-meal walks, carb swaps, glucose readings and the days it does not behave.',
    'Women managing gestational diabetes, prediabetes or type 2 diabetes.',
    array['gdm', 'diabetes']
  ),
  (
    'new-mothers',
    'New Mothers Circle',
    'The fourth trimester — feeding, recovery, sleep in fragments, and mothers who are awake at 3am too.',
    'Women in the first year after giving birth.',
    array['postpartum', 'breastfeeding']
  ),
  (
    'mental-health',
    'Mind & Mood Circle',
    'Anxiety, low mood and the pressure nobody names. A quiet room to say how it actually is.',
    'Anyone struggling with stress, anxiety or low mood, at any stage.',
    array['mental_health']
  ),
  (
    'womens-wellness',
    'Women''s Wellness Circle',
    'The open circle — food, movement, cycles, menopause, and everything that does not fit a diagnosis.',
    'Open to every woman on Prakriva.',
    array['general']
  )
on conflict (slug) do nothing;
