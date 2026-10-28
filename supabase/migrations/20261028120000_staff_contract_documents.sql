-- Staff upload their signed contract and W-9 from the Staff Portal.
--
-- Files go to a PRIVATE bucket and open only through a short-lived signed link.
-- Each upload is also recorded in staff_contract_documents so the show manager
-- can see it on the Contract Management page without any write to the manager's
-- contract row (no race with the manager's own saves).
--
-- A person may upload only for a show where a contract was sent to THEIR email
-- (the judge_notifications row of type 'contract_sent'), and sees only their own
-- rows. The show owner / admins can read every row for their show.
--
-- Needs public.can_access_show_as_admin(uuid) from 20260910120000_contract_admin_read_access.sql.
-- Paths are stored as <user id>/<show id>/<doc id>/<uuid>.<ext>.

-- 1. Has this signed-in person been sent a contract for this show?
create or replace function public.has_contract_for_show(p_show_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.judge_notifications n
    where n.project_id = p_show_id::text
      and n.notification_type = 'contract_sent'
      and lower(n.judge_email) = lower(auth.jwt() ->> 'email')
  );
$$;

grant execute on function public.has_contract_for_show(uuid) to authenticated;

-- 2. The upload records
create table if not exists public.staff_contract_documents (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null,
  member_email text not null,
  doc_id text not null check (doc_id in ('signed_contract', 'w9_form')),
  file_name text not null,
  file_size bigint,
  storage_path text not null,
  uploaded_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists staff_contract_documents_show_idx
  on public.staff_contract_documents (show_id, lower(member_email));

alter table public.staff_contract_documents enable row level security;

drop policy if exists "staff upload own contract docs" on public.staff_contract_documents;
create policy "staff upload own contract docs"
  on public.staff_contract_documents for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and lower(member_email) = lower(auth.jwt() ->> 'email')
    and public.has_contract_for_show(show_id)
  );

drop policy if exists "staff or show admin read contract docs" on public.staff_contract_documents;
create policy "staff or show admin read contract docs"
  on public.staff_contract_documents for select to authenticated
  using (
    lower(member_email) = lower(auth.jwt() ->> 'email')
    or public.can_access_show_as_admin(show_id)
  );

drop policy if exists "staff delete own contract docs" on public.staff_contract_documents;
create policy "staff delete own contract docs"
  on public.staff_contract_documents for delete to authenticated
  using (
    uploaded_by = auth.uid()
    and lower(member_email) = lower(auth.jwt() ->> 'email')
  );

-- 3. Private bucket
insert into storage.buckets (id, name, public)
values ('contract-documents', 'contract-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "contract-documents staff upload" on storage.objects;
create policy "contract-documents staff upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'contract-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.has_contract_for_show(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "contract-documents owner or show admin read" on storage.objects;
create policy "contract-documents owner or show admin read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'contract-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.can_access_show_as_admin(((storage.foldername(name))[2])::uuid)
    )
  );

drop policy if exists "contract-documents owner delete" on storage.objects;
create policy "contract-documents owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'contract-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
