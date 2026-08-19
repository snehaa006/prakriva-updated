-- Profile photos.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is idempotent: re-running it is safe.
--
-- `src/services/avatarService.ts` already knows how to store a photo. What it
-- cannot do is create the bucket, so on a project where this file has never
-- been applied every upload falls back to keeping the picture as a data URL in
-- localStorage: it shows, and it survives a refresh, but only on that one
-- device and it never reaches the account (`saveAvatar` returns
-- `synced: false` for exactly this case). Applying this is what turns a photo
-- into something that follows the account to a phone and a laptop alike.
--
-- There is no new table and no new column: the resulting URL is written to the
-- Supabase auth user's metadata, which every session already carries.
--
-- **This bucket is public, unlike `acne-photos`.** The service renders avatars
-- through `getPublicUrl`, and they are shown to people who are not the owner —
-- a doctor sees her patients on the patient list, patients see doctors on the
-- Consult cards, and community posts carry a face. A signed URL would have to
-- be minted per viewer per avatar and would expire mid-session. The trade is
-- deliberate and narrow: read is public, but *writing* is still restricted to
-- the owner's own folder, and the only thing in here is a picture the account
-- holder chose to publish to the app. Nothing clinical ever goes in this
-- bucket — skin photos stay in the private one.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5 MB. The client downscales to a 512px square JPEG first, so this
            -- is a backstop against a raw camera file, not the usual size.
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Ownership is the first path segment (`<user-id>/avatar.jpg`), which is what
-- makes a wrong prefix a server-side rejection rather than a trusted claim
-- from the client.

drop policy if exists "avatars are publicly readable" on storage.objects;
create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "users upload their own avatar" on storage.objects;
create policy "users upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Replacing a photo is an upsert over the same path, which storage performs as
-- an UPDATE. Without this policy the *second* upload fails where the first one
-- worked — the confusing half of "I can't change my picture".
drop policy if exists "users replace their own avatar" on storage.objects;
create policy "users replace their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete their own avatar" on storage.objects;
create policy "users delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
