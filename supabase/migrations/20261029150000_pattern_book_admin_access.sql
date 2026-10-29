-- Staff Portal: pattern books for the people named in Step 8 (Admin, Owner, Second Admin).
--
-- 1. get_my_admin_pattern_books(): the pattern books where the signed-in person's email is the Admin, Owner or
--    Second Admin saved in Step 8 (project_data.adminOwner), so the book shows in their Staff Portal even
--    when nobody has sent them a notification.
-- 2. get_show_owner_name(): now also returns the creator's name to those same people (it already did so
--    for people who were sent a contract for the show). Returns nothing but the name.
--
-- Needs public.has_contract_for_show(uuid) from 20261028120000_staff_contract_documents.sql.
-- Replaces get_show_owner_name from 20261029140000_show_owner_name_for_staff.sql.

create or replace function public.get_my_admin_pattern_books()
returns setof public.projects
language sql
stable
security definer
set search_path = public
as $$
  select pr.*
  from public.projects pr
  where pr.project_type = 'pattern_book'
    and lower(coalesce(auth.jwt() ->> 'email', '')) <> ''
    and lower(auth.jwt() ->> 'email') in (
      lower(coalesce(pr.project_data #>> '{adminOwner,adminEmail}', '')),
      lower(coalesce(pr.project_data #>> '{adminOwner,ownerEmail}', '')),
      lower(coalesce(pr.project_data #>> '{adminOwner,secondAdminEmail}', ''))
    );
$$;

grant execute on function public.get_my_admin_pattern_books() to authenticated;

create or replace function public.get_show_owner_name(p_show_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.full_name
  from public.projects pr
  join public.profiles p on p.id = pr.user_id
  where pr.id = p_show_id
    and (
      public.has_contract_for_show(p_show_id)
      or lower(coalesce(auth.jwt() ->> 'email', '')) in (
        lower(coalesce(pr.project_data #>> '{adminOwner,adminEmail}', '')),
        lower(coalesce(pr.project_data #>> '{adminOwner,ownerEmail}', '')),
        lower(coalesce(pr.project_data #>> '{adminOwner,secondAdminEmail}', ''))
      )
    );
$$;

grant execute on function public.get_show_owner_name(uuid) to authenticated;
