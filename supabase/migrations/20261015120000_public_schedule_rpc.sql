-- Public schedule for the event page.
--
-- get_public_project() deliberately strips `showBill` (it holds the internal
-- arena schedule), so the event page cannot read it. This function exposes the
-- schedule on purpose, and ONLY when the owner has set Schedule & Arena Setup
-- to Published. Locked, Draft or anything else returns NULL — nothing leaks.
--
-- source = 'builtin' → the page draws showBill (class names come from the
--                      disciplines that get_public_project already returns)
-- source = 'upload'  → the page shows the PDF from publicPage.documents, so no
--                      showBill is sent at all
CREATE OR REPLACE FUNCTION public.get_public_schedule(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pd     jsonb;
    v_source text;
BEGIN
    IF p_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(project_data, '{}'::jsonb) INTO v_pd
    FROM public.projects
    WHERE id = p_id;

    IF v_pd IS NULL THEN
        RETURN NULL;
    END IF;

    IF COALESCE(v_pd->'moduleStatuses'->>'editWizard', '') <> 'published' THEN
        RETURN NULL;
    END IF;

    v_source := CASE WHEN v_pd->>'publicScheduleSource' = 'upload' THEN 'upload' ELSE 'builtin' END;

    IF v_source = 'upload' THEN
        RETURN jsonb_build_object('source', 'upload');
    END IF;

    RETURN jsonb_build_object(
        'source',         'builtin',
        'showBill',       v_pd->'showBill',
        'disciplines',    COALESCE(v_pd->'disciplines', '[]'::jsonb)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_schedule(uuid) TO anon, authenticated;
