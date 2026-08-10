-- The exhibitor's own booking page was showing a total that isn't the one
-- charged, and never showed their RV spot numbers.
--
-- 1. Live total. Checkout charges assigned stalls x nights x the barn's CURRENT
--    price. The page showed the stored totalAmount, which freezes at booking
--    time. On production every Larimer County Fair booking has totalAmount 0, so
--    those exhibitors see no Total and no Pay button at all while checkout would
--    charge them in full. The reverse is just as bad: a price changed after
--    booking makes "Paid in full" wrong.
--
--    Same rule as record_stall_booking_payment() and src/lib/bookingPricing.js.
--
-- 2. RV spots. BookingStatusPage reads `assignedRvSpots`, which this function
--    never returned — so it always said "not assigned yet", even after the
--    organizer had assigned them.

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
    v_count     numeric;
    v_price     numeric;
    v_paid      numeric;
BEGIN
    IF p_booking_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Find the booking inside any project's stallingService.bookings array.
    SELECT p.id, p.project_name, p.project_data, booking
    INTO v_show_id, v_show_name, v_pd, v_booking
    FROM public.projects p,
         jsonb_array_elements(COALESCE(p.project_data->'stallingService'->'bookings', '[]'::jsonb)) booking
    WHERE booking->>'id' = p_booking_id::text
    LIMIT 1;

    IF v_booking IS NULL THEN
        RETURN NULL;
    END IF;

    -- Stalls in this show pinned to this booking.
    SELECT jsonb_agg(jsonb_build_object(
        'barnName',    barn->>'name',
        'stallNumber', stall->>'number',
        'stallId',     stall->>'id'
    ))
    INTO v_stalls
    FROM jsonb_array_elements(COALESCE(v_pd->'stallingService'->'barns', '[]'::jsonb)) barn,
         jsonb_array_elements(COALESCE(barn->'stalls', '[]'::jsonb)) stall
    WHERE stall->>'bookingId' = p_booking_id::text;

    -- RV / camping spots pinned to this booking.
    SELECT jsonb_agg(jsonb_build_object(
        'areaName',   area->>'name',
        'spotNumber', spot->>'number',
        'spotId',     spot->>'id'
    ))
    INTO v_rv
    FROM jsonb_array_elements(COALESCE(v_pd->'stallingService'->'rvAreas', '[]'::jsonb)) area,
         jsonb_array_elements(COALESCE(area->'spots', '[]'::jsonb)) spot
    WHERE spot->>'bookingId' = p_booking_id::text;

    -- ── Live total, the same figure Stripe is asked for ─────────────────────
    v_nights := COALESCE(NULLIF(v_booking->>'nights', '')::numeric, 1);
    IF v_nights <= 0 THEN
        v_nights := 1;
    END IF;

    IF jsonb_typeof(v_booking->'items') = 'array'
       AND jsonb_array_length(v_booking->'items') > 0 THEN

        FOR v_item IN SELECT * FROM jsonb_array_elements(v_booking->'items')
        LOOP
            IF v_item->>'type' = 'stall' THEN
                SELECT count(*)::numeric,
                       max(COALESCE(NULLIF(barn->>'pricePerNight', '')::numeric, 0))
                  INTO v_count, v_price
                  FROM jsonb_array_elements(COALESCE(v_pd->'stallingService'->'barns', '[]'::jsonb)) barn,
                       jsonb_array_elements(COALESCE(barn->'stalls', '[]'::jsonb)) stall
                 WHERE barn->>'id' = v_item->>'refId'
                   AND stall->>'bookingId' = p_booking_id::text;

                IF COALESCE(v_count, 0) = 0 THEN
                    v_count := COALESCE(NULLIF(v_item->>'qty', '')::numeric, 0);
                    v_price := COALESCE(NULLIF(v_item->>'unitPrice', '')::numeric, 0);
                END IF;

                v_total := v_total + v_count * v_nights * COALESCE(v_price, 0);
            ELSE
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

    -- liveTotal / paidAmount / balanceDue are what the page should display.
    -- totalAmount is left on the booking untouched for anything still reading it.
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
            'name', v_show_name
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_booking(uuid) TO anon, authenticated;
