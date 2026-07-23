-- Priority 4: let show staff post the COMPLETED score sheet so exhibitors can see it.
--
-- The printed sheet already carries a QR pointing at /s/:id, and that row in
-- score_sheet_qr_codes already knows the show, class, division, judge and date.
-- So the scored sheet just hangs off that same row — no new table needed.
--
-- Run this in the Supabase SQL editor BEFORE deploying. Safe to run twice.

-- 1. Where the completed sheet lives, and who put it there. Robert has to be able
--    to see who posted each sheet, so the name is stored alongside the user id —
--    the id alone means nothing when he is looking at a list.
alter table public.score_sheet_qr_codes
  add column if not exists posted_sheet_url  text,
  add column if not exists posted_sheet_path text,
  add column if not exists posted_at         timestamptz,
  add column if not exists posted_by         uuid,
  add column if not exists posted_by_name    text,
  add column if not exists posted_by_email   text;

-- 2. Only signed-in staff may attach a completed sheet. Anyone can still read the
--    row (the public read policy already exists — that is how /s/:id works today).
drop policy if exists "authenticated can post scored sheet" on public.score_sheet_qr_codes;
create policy "authenticated can post scored sheet"
  on public.score_sheet_qr_codes
  for update
  to authenticated
  using (true)
  with check (true);

-- 3. The completed sheet is stored in the existing public project_files bucket.
--    These policies are additive — they do not replace anything already there.
insert into storage.buckets (id, name, public)
values ('project_files', 'project_files', true)
on conflict (id) do nothing;

drop policy if exists "project_files posted sheets are public" on storage.objects;
create policy "project_files posted sheets are public"
  on storage.objects for select
  using (bucket_id = 'project_files');

-- Uploads are confined to a folder named after the uploader, so one user cannot
-- overwrite another's files.
drop policy if exists "project_files staff upload" on storage.objects;
create policy "project_files staff upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'project_files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "project_files staff replace own" on storage.objects;
create policy "project_files staff replace own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'project_files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
