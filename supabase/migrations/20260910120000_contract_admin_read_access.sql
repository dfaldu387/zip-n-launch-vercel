-- Section Admins scoped to "Contract Management" can already open a contract
-- they have a direct link to, but can't discover it: contract rows
-- (projects.project_type = 'contract') carry no admins list of their own —
-- that list lives on the SHOW row they're linked to
-- (project_data->>'linkedProjectId'), which the app already checks in
-- MembershipRoute.jsx and ShowWorkspacePage.jsx.
--
-- This adds a read rule so a contract row is visible to whoever the linked
-- show's owner/admins say may access it. Additive only — it does not touch
-- or replace any existing policy on public.projects.

CREATE OR REPLACE FUNCTION public.can_access_show_as_admin(p_show_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.id = p_show_id
          AND (
                p.user_id = auth.uid()
             OR EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(to_jsonb(p.admins)) AS a
                  WHERE (a->>'user_id')::uuid = auth.uid()
                     OR lower(a->>'email') = lower(auth.jwt() ->> 'email')
                )
          )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_show_as_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS "Section admins can read linked contracts" ON public.projects;
CREATE POLICY "Section admins can read linked contracts"
ON public.projects FOR SELECT TO authenticated
USING (
    project_type = 'contract'
    AND (project_data->>'linkedProjectId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.can_access_show_as_admin((project_data->>'linkedProjectId')::uuid)
);
