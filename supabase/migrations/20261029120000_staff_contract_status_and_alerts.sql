-- Phase 5: two-way status between staff and the show manager.
--
-- 1. staff_contract_status: the contract state (sent / signed / approved ...) per person and show,
--    so the Staff Portal can show it. Staff cannot read the manager's contract row, so the manager's
--    page writes a small copy here. A person reads only their own row; the show owner / admins write.
-- 2. notify_show_owner(): lets a staff member who was sent a contract drop an alert into the show
--    owner's bell, without ever seeing the owner's email.
--
-- Needs public.can_access_show_as_admin(uuid) and public.has_contract_for_show(uuid)
-- from the two earlier contract migrations.

-- 1. Status copy
create table if not exists public.staff_contract_status (
  show_id uuid not null,
  member_email text not null,
  status text not null,
  updated_at timestamptz not null default now(),
  primary key (show_id, member_email)
);

alter table public.staff_contract_status enable row level security;

drop policy if exists "staff read own contract status" on public.staff_contract_status;
create policy "staff read own contract status"
  on public.staff_contract_status for select to authenticated
  using (
    lower(member_email) = lower(auth.jwt() ->> 'email')
    or public.can_access_show_as_admin(show_id)
  );

drop policy if exists "show admin insert contract status" on public.staff_contract_status;
create policy "show admin insert contract status"
  on public.staff_contract_status for insert to authenticated
  with check (public.can_access_show_as_admin(show_id));

drop policy if exists "show admin update contract status" on public.staff_contract_status;
create policy "show admin update contract status"
  on public.staff_contract_status for update to authenticated
  using (public.can_access_show_as_admin(show_id))
  with check (public.can_access_show_as_admin(show_id));

-- 2. Staff -> show owner alert
create or replace function public.notify_show_owner(p_show_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_email text;
  v_show_name text;
  v_my_email text := lower(auth.jwt() ->> 'email');
begin
  if v_my_email is null or not public.has_contract_for_show(p_show_id) then
    raise exception 'not allowed';
  end if;

  select lower(u.email), p.project_name
    into v_owner_email, v_show_name
  from public.projects p
  join auth.users u on u.id = p.user_id
  where p.id = p_show_id;

  if v_owner_email is null then
    return;
  end if;

  insert into public.judge_notifications
    (judge_email, project_id, project_name, notification_type, message, created_by)
  values
    (v_owner_email, p_show_id::text, coalesce(v_show_name, 'Horse Show'), 'staff_activity',
     left(coalesce(p_message, 'Staff activity'), 300), auth.uid()::text);
end;
$$;

grant execute on function public.notify_show_owner(uuid, text) to authenticated;
