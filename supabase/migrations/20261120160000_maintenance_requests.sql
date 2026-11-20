-- Grounds maintenance requests (Robert, 2026-11-19).
--
-- The show office keeps a list of grounds / maintenance requests (a broken water line, a
-- light out in a barn ...). Each one is acknowledged, then marked done, and the office can
-- choose to PUBLISH it so it shows on the public Event page.
--
-- Why its own table and not project_data: get_public_project() hands almost all of
-- project_data to anyone, so a private note or a phone number kept there would be public.
-- Here the office reads and writes through row-level security, and the public page can
-- only call get_public_maintenance_notices(), which returns the published rows and only
-- the fields meant to be public (what, where, status) - never who reported it.
--
-- Needs public.can_access_show_as_admin(uuid) from 20260910120000_contract_admin_read_access.sql.
-- Safe to run twice.

create table if not exists public.maintenance_requests (
  id              uuid primary key default gen_random_uuid(),
  show_id         uuid not null,
  title           text not null check (char_length(btrim(title)) between 1 and 160),
  location        text not null default '' check (char_length(location) <= 120),
  details         text not null default '' check (char_length(details) <= 2000),   -- private
  reported_by     text not null default '' check (char_length(reported_by) <= 120),  -- private
  contact         text not null default '' check (char_length(contact) <= 120),      -- private
  priority        text not null default 'normal' check (priority in ('normal', 'urgent')),
  status          text not null default 'new' check (status in ('new', 'acknowledged', 'done', 'cancelled')),
  is_public       boolean not null default false,
  created_at      timestamptz not null default now(),
  acknowledged_at timestamptz,
  done_at         timestamptz,
  updated_at      timestamptz not null default now()
);

create index if not exists maintenance_requests_show_idx
  on public.maintenance_requests (show_id, created_at desc);

alter table public.maintenance_requests enable row level security;

drop policy if exists "show admin reads maintenance requests" on public.maintenance_requests;
create policy "show admin reads maintenance requests"
  on public.maintenance_requests for select to authenticated
  using (public.can_access_show_as_admin(show_id));

drop policy if exists "show admin adds maintenance requests" on public.maintenance_requests;
create policy "show admin adds maintenance requests"
  on public.maintenance_requests for insert to authenticated
  with check (public.can_access_show_as_admin(show_id));

drop policy if exists "show admin updates maintenance requests" on public.maintenance_requests;
create policy "show admin updates maintenance requests"
  on public.maintenance_requests for update to authenticated
  using (public.can_access_show_as_admin(show_id))
  with check (public.can_access_show_as_admin(show_id));

drop policy if exists "show admin deletes maintenance requests" on public.maintenance_requests;
create policy "show admin deletes maintenance requests"
  on public.maintenance_requests for delete to authenticated
  using (public.can_access_show_as_admin(show_id));

-- Keep updated_at honest on every change.
create or replace function public.maintenance_requests_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists maintenance_requests_touch on public.maintenance_requests;
create trigger maintenance_requests_touch
  before update on public.maintenance_requests
  for each row execute function public.maintenance_requests_touch();

-- ── What the public Event page may see ───────────────────────────────────────
-- Published requests only (never cancelled), newest first, and only the public fields.
create or replace function public.get_public_maintenance_notices(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when p_id is null then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
             'id',        r.id,
             'title',     r.title,
             'location',  r.location,
             'status',    r.status,
             'updatedAt', r.updated_at
           ) order by r.created_at desc)
      from (
        select * from public.maintenance_requests
         where show_id = p_id and is_public and status in ('new', 'acknowledged', 'done')
         order by created_at desc
         limit 50
      ) r
  ), '[]'::jsonb) end;
$$;

revoke all on function public.get_public_maintenance_notices(uuid) from public;
grant execute on function public.get_public_maintenance_notices(uuid) to anon, authenticated;
