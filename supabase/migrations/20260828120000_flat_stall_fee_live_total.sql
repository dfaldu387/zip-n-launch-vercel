-- A barn priced by a Flat stall fee (see buildBarnStallItems in
-- src/lib/extraStallFees.js) is charged that flat rate PER STALL, for the
-- whole stay — never multiplied by nights. get_public_booking() and
-- record_stall_booking_payment() didn't know about "flat" at all: every
-- 'stall' item was priced as count x nights x price. That was invisible
-- while a flat-priced barn's own pricePerNight was always $0 (nights x $0 =
-- $0 either way) — but now that the booking page correctly stores the real
-- flat rate on the stall item, these two functions would multiply it by
-- nights too and badly overcharge (e.g. 2 stalls x 5 nights x $300 = $3,000
-- instead of $600). record_stall_booking_payment() is what the Stripe
-- webhook uses to reconcile what a booking owes, so this is a real-money bug.
--
-- Fix: a small helper that sums the Flat fees currently scoped to a barn
-- (same appliesTo rules as feeScope()/feeAppliesToBarn() in
-- src/lib/extraStallFees.js — 'all', a single legacy barn id string, or an
-- array of barn ids). When a barn has one, charge count x flat rate. Only
-- when it doesn't does the old count x nights x pricePerNight math apply.

CREATE OR REPLACE FUNCTION public.barn_flat_rate(p_barn_id text, p_extra_stall_fees jsonb)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(SUM(COALESCE(NULLIF(fee->>'amount', '')::numeric, 0)), 0)
    FROM jsonb_array_elements(COALESCE(p_extra_stall_fees, '[]'::jsonb)) fee
    WHERE COALESCE(fee->>'unitType', 'per_stall') = 'flat'
      AND COALESCE(NULLIF(fee->>'amount', '')::numeric, 0) > 0
      AND (
            -- Missing / null / empty-string / 'all' / empty-array appliesTo → facility-wide.
            NOT (fee ? 'appliesTo')
            OR jsonb_typeof(fee->'appliesTo') = 'null'
            OR (jsonb_typeof(fee->'appliesTo') = 'string' AND COALESCE(fee->>'appliesTo', '') IN ('', 'all'))
            OR (jsonb_typeof(fee->'appliesTo') = 'array' AND jsonb_array_length(fee->'appliesTo') = 0)
            OR (jsonb_typeof(fee->'appliesTo') = 'array' AND fee->'appliesTo' ? 'all')
            -- Scoped to this barn specifically (legacy single-string or an array of ids).
            OR (jsonb_typeof(fee->'appliesTo') = 'string' AND fee->>'appliesTo' = p_barn_id)
            OR (jsonb_typeof(fee->'appliesTo') = 'array' AND fee->'appliesTo' ? p_barn_id)
      );
$$;

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
                IF v_flat_rate > 0 THEN
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
                IF v_flat_rate > 0 THEN
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
