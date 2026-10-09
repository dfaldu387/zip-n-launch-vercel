-- Event Branding & Public Links: let the public show page (/show/:id) read the
-- "what the public sees" settings (hidden items + edited text) that the
-- Housing & Grounds Manager saves in project_data.publicPage.
--
-- Only change from the previous definition: one added key, 'publicPage'.
-- It holds nothing private — just which details to hide and the replacement
-- text the organizer typed for the public.

CREATE OR REPLACE FUNCTION public.get_public_show(p_show_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name text;
    v_pd   jsonb;
    v_svc  jsonb;
    v_det  jsonb;
    v_gen  jsonb;
BEGIN
    IF p_show_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT p.project_name, p.project_data
      INTO v_name, v_pd
      FROM public.projects p
     WHERE p.id = p_show_id;

    IF v_pd IS NULL THEN
        RETURN NULL;
    END IF;

    v_svc := COALESCE(v_pd->'stallingService', '{}'::jsonb);
    v_det := COALESCE(v_pd->'showDetails', '{}'::jsonb);
    v_gen := COALESCE(v_det->'general', '{}'::jsonb);

    RETURN jsonb_build_object(
        'id',   p_show_id,
        'name', v_name,

        -- Draft and Locked both mean "not taking bookings".
        'housingStatus', COALESCE(
            NULLIF(v_pd->'moduleStatuses'->>'housing', ''),
            NULLIF(v_svc->>'publishStatus', ''),
            'draft'),
        'billingMode', COALESCE(NULLIF(v_svc->>'billingMode', ''), 'invoice_after'),
        'processingFeeMode', COALESCE(NULLIF(v_svc->>'processingFeeMode', ''), 'show'),

        'showWindow', jsonb_build_object(
            'start', COALESCE(v_gen->>'startDate', v_pd->>'startDate'),
            'end',   COALESCE(v_gen->>'endDate',   v_pd->>'endDate')),

        -- Organizer's move-in / move-out limits, falling back to the show dates.
        'bookWindow', jsonb_build_object(
            'start', COALESCE(NULLIF(v_svc->>'moveInDate', ''),  v_gen->>'startDate', v_pd->>'startDate'),
            'end',   COALESCE(NULLIF(v_svc->>'moveOutDate', ''), v_gen->>'endDate',   v_pd->>'endDate')),

        'inventory', public.public_show_inventory(v_svc),

        -- Only the sections the public show page already displays. Everything
        -- else in project_data — bookings, staff, showBill, sponsors, schedule
        -- — is deliberately left out.
        'details', jsonb_build_object(
            'general',    v_gen,
            'venue',      COALESCE(v_det->'venue',      '{}'::jsonb),
            -- Older shows built in the flat wizard keep the venue at the top
            -- level; the public page falls back to these.
            'venueName',    v_pd->>'venueName',
            'venueAddress', v_pd->>'venueAddress',
            'officials',  COALESCE(v_det->'officials',  '{}'::jsonb),
            'fees',       COALESCE(v_det->'fees',       '[]'::jsonb),
            'entry',      COALESCE(v_det->'entry',      '{}'::jsonb),
            'scheduling', COALESCE(v_det->'scheduling', '{}'::jsonb),
            'awards',     COALESCE(v_det->'awards',     '{}'::jsonb)),

        'marketing', jsonb_build_object(
            'facebook',  v_pd->'marketing'->>'facebook',
            'instagram', v_pd->'marketing'->>'instagram',
            'youtube',   v_pd->'marketing'->>'youtube'),

        -- Hidden items + replacement text from Event Branding & Public Links.
        'publicPage', COALESCE(v_pd->'publicPage', '{}'::jsonb)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_show(uuid) TO anon, authenticated;
