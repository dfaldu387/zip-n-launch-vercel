-- Staff Portal: let a person with a sent contract see the NAME of the show's owner (so they know who to
-- contact). Staff cannot read other people's profiles directly, and this returns nothing but the name.
--
-- Needs public.has_contract_for_show(uuid) from 20261028120000_staff_contract_documents.sql.

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
    and public.has_contract_for_show(p_show_id);
$$;

grant execute on function public.get_show_owner_name(uuid) to authenticated;
