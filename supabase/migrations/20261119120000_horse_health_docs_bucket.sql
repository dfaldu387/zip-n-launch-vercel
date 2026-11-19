-- Private bucket for horse health papers (Health Certificate / CVI and Coggins).
--
-- Vet papers are private. The bucket is NOT public: a file opens only through a
-- short-lived signed link that a signed-in user asks for. Files are stored as
-- <show id>/<booking id>/<uuid>.<ext>. Exhibitors upload through an edge function
-- (Phase B), which uses the service role, so no anonymous policy is needed here.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'horse-health-docs', 'horse-health-docs', false, 15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "horse-health-docs signed-in read" on storage.objects;
create policy "horse-health-docs signed-in read"
  on storage.objects for select to authenticated
  using (bucket_id = 'horse-health-docs');

drop policy if exists "horse-health-docs signed-in upload" on storage.objects;
create policy "horse-health-docs signed-in upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'horse-health-docs');

drop policy if exists "horse-health-docs signed-in delete" on storage.objects;
create policy "horse-health-docs signed-in delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'horse-health-docs');
