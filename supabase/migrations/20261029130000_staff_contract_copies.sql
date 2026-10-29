-- The copy of the contract PDF that staff can download from the Staff Portal.
--
-- When a manager sends a contract, the PDF is also saved here (one row per person and show; a
-- re-send replaces it). The file lives in the existing PRIVATE bucket 'contract-documents', under
-- sent/<show id>/<uuid>.pdf, and opens only through a short-lived signed link.
--
-- The show owner / admins write it; the person it was sent to reads only their own.
-- Needs public.can_access_show_as_admin(uuid) from 20260910120000_contract_admin_read_access.sql
-- and the bucket from 20261028120000_staff_contract_documents.sql.

create table if not exists public.staff_contract_copies (
  show_id uuid not null,
  member_email text not null,
  file_name text not null,
  storage_path text not null,
  updated_at timestamptz not null default now(),
  primary key (show_id, member_email)
);

alter table public.staff_contract_copies enable row level security;

drop policy if exists "staff read own contract copy" on public.staff_contract_copies;
create policy "staff read own contract copy"
  on public.staff_contract_copies for select to authenticated
  using (
    lower(member_email) = lower(auth.jwt() ->> 'email')
    or public.can_access_show_as_admin(show_id)
  );

drop policy if exists "show admin insert contract copy" on public.staff_contract_copies;
create policy "show admin insert contract copy"
  on public.staff_contract_copies for insert to authenticated
  with check (public.can_access_show_as_admin(show_id));

drop policy if exists "show admin update contract copy" on public.staff_contract_copies;
create policy "show admin update contract copy"
  on public.staff_contract_copies for update to authenticated
  using (public.can_access_show_as_admin(show_id))
  with check (public.can_access_show_as_admin(show_id));

-- Storage: admins upload under sent/<show id>/, the named person reads their own file.
drop policy if exists "contract-documents admin upload sent copy" on storage.objects;
create policy "contract-documents admin upload sent copy"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'contract-documents'
    and (storage.foldername(name))[1] = 'sent'
    and public.can_access_show_as_admin(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "contract-documents staff read sent copy" on storage.objects;
create policy "contract-documents staff read sent copy"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'contract-documents'
    and (storage.foldername(name))[1] = 'sent'
    and exists (
      select 1 from public.staff_contract_copies c
      where c.storage_path = name
        and lower(c.member_email) = lower(auth.jwt() ->> 'email')
    )
  );
