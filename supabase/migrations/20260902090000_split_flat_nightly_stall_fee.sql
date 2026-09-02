-- The public booking page now lets an exhibitor pick Flat Fee OR Nightly Fee
-- as two separate purchase options per barn/RV area (never both at once —
-- Robert: "people either buy the flat fee for all nights, or they're buying
-- a night or two... those are separate"). A 'stall'/'rv' line item built by
-- the new selection UI carries which one was chosen as item.feeType
-- ('flat' | 'per_night').
--
-- get_public_booking() and record_stall_booking_payment() (the function the
-- Stripe webhook uses to reconcile what a booking owes) didn't know about
-- that choice — they charged the Flat rate whenever a barn happened to HAVE
-- a Flat fee configured, even when the exhibitor explicitly selected and was
-- shown the Nightly Fee option. That's a real-money mismatch between what
-- the customer saw at checkout and what Stripe actually charged.
--
-- Fix: prefer item.feeType when it's present. Older bookings (made before
-- this change) never stored feeType, so they keep the exact same fallback
-- behavior as before (flat rate if the barn has one, else nightly) — nothing
-- about an already-placed booking's total changes.

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
    v_flat_rate numeric;
    v_fee_type  text;
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

                v_flat_rate := public.barn_flat_rate(v_item->>'refId', v_pd->'stallingService'->'extraStallFees');
                v_fee_type  := v_item->>'feeType';

                IF v_fee_type = 'flat' THEN
                    v_total := v_total + v_count * v_flat_rate;
                ELSIF v_fee_type = 'per_night' THEN
                    v_total := v_total + v_count * v_nights * COALESCE(v_price, 0);
                ELSIF v_flat_rate > 0 THEN
                    -- Legacy item (no feeType recorded) — same fallback as before.
                    v_total := v_total + v_count * v_flat_rate;
                ELSE
                    v_total := v_total + v_count * v_nights * COALESCE(v_price, 0);
                END IF;
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

CREATE OR REPLACE FUNCTION public.record_stall_booking_payment(
    p_show_id uuid,
    p_booking_id text,
    p_paid numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_data      jsonb;
    v_bookings  jsonb;
    v_booking   jsonb;
    v_index     int;
    v_item      jsonb;
    v_nights    numeric;
    v_total     numeric := 0;
    v_stored    numeric;
    v_count     numeric;
    v_price     numeric;
    v_flat_rate numeric;
    v_fee_type  text;
    v_prev_paid numeric;
    v_new_paid  numeric;
    v_status    text;
BEGIN
    IF p_show_id IS NULL OR COALESCE(p_booking_id, '') = '' THEN
        RAISE EXCEPTION 'show id and booking id are required' USING ERRCODE = '22023';
    END IF;

    -- The lock. Everything below reads the freshest committed row.
    SELECT project_data INTO v_data
    FROM public.projects
    WHERE id = p_show_id
    FOR UPDATE;

    IF v_data IS NULL THEN
        RAISE EXCEPTION 'Show % not found', p_show_id USING ERRCODE = 'P0002';
    END IF;

    v_bookings := COALESCE(v_data->'stallingService'->'bookings', '[]'::jsonb);

    SELECT ord - 1, elem
      INTO v_index, v_booking
      FROM jsonb_array_elements(v_bookings) WITH ORDINALITY AS t(elem, ord)
     WHERE elem->>'id' = p_booking_id
     LIMIT 1;

    IF v_booking IS NULL THEN
        RAISE EXCEPTION 'Booking % not found on show %', p_booking_id, p_show_id
            USING ERRCODE = 'P0002';
    END IF;

    v_nights := COALESCE(NULLIF(v_booking->>'nights', '')::numeric, 1);
    IF v_nights <= 0 THEN
        v_nights := 1;
    END IF;

    IF jsonb_typeof(v_booking->'items') = 'array'
       AND jsonb_array_length(v_booking->'items') > 0 THEN

        FOR v_item IN SELECT * FROM jsonb_array_elements(v_booking->'items')
        LOOP
            IF v_item->>'type' = 'stall' THEN
                -- How many stalls in that barn are actually assigned to this
                -- booking, and what does that barn charge today.
                SELECT count(*)::numeric,
                       max(COALESCE(NULLIF(barn->>'pricePerNight', '')::numeric, 0))
                  INTO v_count, v_price
                  FROM jsonb_array_elements(
                           COALESCE(v_data->'stallingService'->'barns', '[]'::jsonb)
                       ) AS barn,
                       jsonb_array_elements(
                           COALESCE(barn->'stalls', '[]'::jsonb)
                       ) AS stall
                 WHERE barn->>'id' = v_item->>'refId'
                   AND stall->>'bookingId' = p_booking_id;

                -- Nothing assigned yet: fall back to what was ordered.
                IF COALESCE(v_count, 0) = 0 THEN
                    v_count := COALESCE(NULLIF(v_item->>'qty', '')::numeric, 0);
                    v_price := COALESCE(NULLIF(v_item->>'unitPrice', '')::numeric, 0);
                END IF;

                v_flat_rate := public.barn_flat_rate(v_item->>'refId', v_data->'stallingService'->'extraStallFees');
                v_fee_type  := v_item->>'feeType';

                IF v_fee_type = 'flat' THEN
                    v_total := v_total + v_count * v_flat_rate;
                ELSIF v_fee_type = 'per_night' THEN
                    v_total := v_total + v_count * v_nights * COALESCE(v_price, 0);
                ELSIF v_flat_rate > 0 THEN
                    -- Legacy item (no feeType recorded) — same fallback as before.
                    v_total := v_total + v_count * v_flat_rate;
                ELSE
                    v_total := v_total + v_count * v_nights * COALESCE(v_price, 0);
                END IF;
            ELSE
                v_total := v_total + COALESCE(NULLIF(v_item->>'amount', '')::numeric, 0);
            END IF;
        END LOOP;
    ELSE
        v_total := COALESCE(NULLIF(v_booking->>'amount', '')::numeric, 0);
    END IF;

    -- Stored totals freeze at booking time, so they are only a fallback.
    v_stored := COALESCE(
        NULLIF(v_booking->>'totalAmount', '')::numeric,
        NULLIF(v_booking->>'amount', '')::numeric,
        0
    );
    IF v_total <= 0 THEN
        v_total := v_stored;
    END IF;

    IF COALESCE(v_booking->>'paidAmount', '') <> '' THEN
        v_prev_paid := (v_booking->>'paidAmount')::numeric;
    ELSIF v_booking->>'paymentStatus' = 'paid' THEN
        v_prev_paid := v_total;
    ELSE
        v_prev_paid := 0;
    END IF;

    v_new_paid := v_prev_paid + COALESCE(p_paid, 0);
    v_status   := CASE WHEN v_new_paid >= v_total - 0.01 THEN 'paid' ELSE 'partial' END;

    v_booking := v_booking || jsonb_build_object(
        'paidAmount',    v_new_paid,
        'paymentStatus', v_status,
        'paidAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    );

    v_data := jsonb_set(
        v_data,
        '{stallingService,bookings}',
        jsonb_set(v_bookings, ARRAY[v_index::text], v_booking, false),
        true
    );

    UPDATE public.projects
       SET project_data = v_data
     WHERE id = p_show_id;

    RETURN jsonb_build_object(
        'bookingId',     p_booking_id,
        'paidAmount',    v_new_paid,
        'total',         v_total,
        'paymentStatus', v_status
    );
END;
$$;

-- CREATE OR REPLACE keeps existing grants, but restate them so this migration
-- is correct on its own regardless of history.
GRANT EXECUTE ON FUNCTION public.get_public_booking(uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.record_stall_booking_payment(uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_stall_booking_payment(uuid, text, numeric) TO service_role;
