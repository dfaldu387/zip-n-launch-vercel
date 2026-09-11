-- send-booking-confirmation needs to know whether a show is Bill-at-booking
-- or Invoice-after-confirmation to word its immediate "you submitted a
-- reservation" email correctly (see 2026-09-11 decision: keep sending it
-- instantly as a safety net, but don't say "Confirmed" for a Bill-at-booking
-- reservation that hasn't been paid yet). get_public_booking already reads
-- the whole project row — just also return billingMode on the show object
-- instead of adding a second query.

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
        'stallId',     stall->>'id'
    ))
      INTO v_stalls
      FROM jsonb_array_elements(COALESCE(v_pd->'stallingService'->'barns', '[]'::jsonb)) barn,
           jsonb_array_elements(COALESCE(barn->'stalls', '[]'::jsonb)) stall
     WHERE stall->>'bookingId' = p_booking_id::text;

    SELECT jsonb_agg(jsonb_build_object(
        'areaName',   area->>'name',
        'spotNumber', spot->>'number',
        'spotId',     spot->>'id'
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
            'billingMode', COALESCE(v_pd->'stallingService'->>'billingMode', 'invoice_after')
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_booking(uuid) TO anon, authenticated;
