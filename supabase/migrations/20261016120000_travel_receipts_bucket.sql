-- Private bucket for travel receipts (flight, hotel, rental car, mileage).
--
-- Receipts are financial records, so this bucket is NOT public: a file opens only
-- through a short-lived signed link that a signed-in user asks for. Files are stored
-- as <user id>/<show id>/receipts/<uuid>.<ext>.

insert into storage.buckets (id, name, public)
values ('travel-receipts', 'travel-receipts', false)
on conflict (id) do update set public = false;

drop policy if exists "travel-receipts signed-in read" on storage.objects;
create policy "travel-receipts signed-in read"
  on storage.objects for select to authenticated
  using (bucket_id = 'travel-receipts');

drop policy if exists "travel-receipts signed-in upload" on storage.objects;
create policy "travel-receipts signed-in upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'travel-receipts');

drop policy if exists "travel-receipts signed-in delete" on storage.objects;
create policy "travel-receipts signed-in delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'travel-receipts');
