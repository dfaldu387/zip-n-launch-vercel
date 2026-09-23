-- Robert (2026-09-23): let each show choose whether the exhibitor pays
-- Stripe's card-processing fee at checkout, or the show's payout absorbs it
-- (project_data.stallingService.processingFeeMode, 'show' | 'customer',
-- same UI/save pattern as billingMode). The public pages/edge functions need
-- to read it the same way they already read billingMode.

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
            'youtube',   v_pd->'marketing'->>'youtube')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_show(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_show_id   uuid;
    v_show_name text;
    v_pd        jsonb;
    v_booking   jsonb;
    v_stalls    jsonb;
    v_rv        jsonb;
    v_item      jsonb;
    v_nights    numeric;
    v_total     numeric := 0;
    v_paid      numeric;
BEGIN
    IF p_booking_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT p.id, p.project_name, p.project_data, booking
      INTO v_show_id, v_show_name, v_pd, v_booking
      FROM public.projects p,
           jsonb_array_elements(COALESCE(p.project_data->'stallingService'->'bookings', '[]'::jsonb)) booking
     WHERE booking->>'id' = p_booking_id::text
     LIMIT 1;

    IF v_booking IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_agg(jsonb_build_object(
        'barnName',    barn->>'name',
        'stallNumber', stall->>'number',
        'stallId',     stall->>'id',
        'assignedAt',  stall->>'assignedAt'
    ))
      INTO v_stalls
      FROM jsonb_array_elements(COALESCE(v_pd->'stallingService'->'barns', '[]'::jsonb)) barn,
           jsonb_array_elements(COALESCE(barn->'stalls', '[]'::jsonb)) stall
     WHERE stall->>'bookingId' = p_booking_id::text;

    SELECT jsonb_agg(jsonb_build_object(
        'areaName',   area->>'name',
        'spotNumber', spot->>'number',
        'spotId',     spot->>'id',
        'assignedAt', spot->>'assignedAt'
    ))
      INTO v_rv
      FROM jsonb_array_elements(COALESCE(v_pd->'stallingService'->'rvAreas', '[]'::jsonb)) area,
           jsonb_array_elements(COALESCE(area->'spots', '[]'::jsonb)) spot
     WHERE spot->>'bookingId' = p_booking_id::text;

    v_nights := COALESCE(NULLIF(v_booking->>'nights', '')::numeric, 1);
    IF v_nights <= 0 THEN
        v_nights := 1;
    END IF;

    IF jsonb_typeof(v_booking->'items') = 'array'
       AND jsonb_array_length(v_booking->'items') > 0 THEN

        v_total := public.compute_booking_stall_total(v_booking->'items', v_pd, p_booking_id::text, v_nights);

        FOR v_item IN SELECT * FROM jsonb_array_elements(v_booking->'items') LOOP
            IF v_item->>'type' <> 'stall' THEN
                v_total := v_total + COALESCE(NULLIF(v_item->>'amount', '')::numeric, 0);
            END IF;
        END LOOP;
    ELSE
        v_total := COALESCE(NULLIF(v_booking->>'amount', '')::numeric, 0);
    END IF;

    IF v_total <= 0 THEN
        v_total := COALESCE(
            NULLIF(v_booking->>'totalAmount', '')::numeric,
            NULLIF(v_booking->>'amount', '')::numeric,
            0);
    END IF;

    IF COALESCE(v_booking->>'paidAmount', '') <> '' THEN
        v_paid := (v_booking->>'paidAmount')::numeric;
    ELSIF v_booking->>'paymentStatus' = 'paid' THEN
        v_paid := v_total;
    ELSE
        v_paid := 0;
    END IF;

    v_booking := v_booking || jsonb_build_object(
        'liveTotal',  v_total,
        'paidAmount', v_paid,
        'balanceDue', GREATEST(v_total - v_paid, 0)
    );

    RETURN jsonb_build_object(
        'booking',         v_booking,
        'assignedStalls',  COALESCE(v_stalls, '[]'::jsonb),
        'assignedRvSpots', COALESCE(v_rv, '[]'::jsonb),
        'show', jsonb_build_object(
            'id',   v_show_id,
            'name', v_show_name,
            'billingMode', COALESCE(v_pd->'stallingService'->>'billingMode', 'invoice_after'),
            'processingFeeMode', COALESCE(v_pd->'stallingService'->>'processingFeeMode', 'show')
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_booking(uuid) TO anon, authenticated;
