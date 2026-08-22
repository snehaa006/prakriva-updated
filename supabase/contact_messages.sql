-- Contact form messages from the public landing page.
--
-- Apply in the Supabase SQL editor. Without it the form still works — the
-- frontend falls back to a prefilled mailto: (see
-- src/services/contactService.ts) — so this is optional, not a prerequisite
-- for the page to render.
--
-- The security shape is the important part and it is deliberately lopsided:
-- anonymous visitors may INSERT and may do nothing else. No public SELECT
-- policy exists, so the anon key cannot read a single row back. A contact
-- table that is readable with the browser's own key is a mailing list anyone
-- can download, and it would carry every enquiry a patient ever wrote about
-- her own health.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role text not null default 'other' check (role in ('patient', 'practitioner', 'other')),
  message text not null check (char_length(message) between 10 and 2000),
  -- Set by whoever works the inbox; not writable from the browser.
  handled_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null
);

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

-- Unhandled first: the working view of this table is "what still needs a
-- reply", and a partial index keeps that query cheap as the table grows.
create index if not exists contact_messages_unhandled_idx
  on public.contact_messages (created_at desc)
  where handled_at is null;

alter table public.contact_messages enable row level security;

-- Anyone may write in, signed in or not. `with check (true)` is the whole
-- permission: the column constraints above are what stop a junk row, and the
-- absence of any SELECT/UPDATE/DELETE policy is what stops everything else.
drop policy if exists "anyone can send a contact message" on public.contact_messages;
create policy "anyone can send a contact message"
  on public.contact_messages
  for insert
  to anon, authenticated
  with check (true);

-- Reading and triaging happen with the service-role key (a backend job, or
-- the Supabase dashboard), which bypasses RLS. Nothing here grants the
-- browser's anon key read access, and nothing should.
revoke select, update, delete on public.contact_messages from anon, authenticated;

comment on table public.contact_messages is
  'Landing-page contact form. Insert-only for anon/authenticated; readable only via the service role.';
