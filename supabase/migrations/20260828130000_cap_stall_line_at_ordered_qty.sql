-- A booking's stall lines were priced from stalls assigned to that ONE line's
-- own barn — but nothing stops an organizer from assigning a stall to a
-- different barn than it was ordered in (e.g. a booking ordered 1 stall in
-- Barn A + 1 in Barn B, but the organizer placed both physical stalls in
-- Barn B). Before this fix, the Barn A line still fell back to its own
-- ordered qty of 1 (billing for a stall that isn't there), while the Barn B
-- line billed for both physically-present stalls — billing THREE stalls
-- total for a two-stall order.
--
-- Fix: bill each stall at wherever it REALLY is right now. Moving a stall to
-- a different barn changes what it costs — Barn A ($300) + Barn B ($350)
-- both moved into Barn B bills $700 (2 × Barn B's rate), not the original
-- $650 order total. This mirrors the exhibitor-facing price everywhere else
-- on this page: live, from the barn's current rate. It is still capped at
-- the TOTAL number of stalls ordered, so an organizer's over-assignment
-- mistake never bills for more stalls than were bought. Whatever part of the
-- order isn't physically assigned yet falls back to each line's own
-- originally-ordered barn/price, same as before.
--
-- Mirrors the same rework just made to src/lib/bookingPricing.js.

CREATE OR REPLACE FUNCTION public.get_public_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_show_id       uuid;
    v_show_name     text;
    v_pd            jsonb;
    v_booking       jsonb;
    v_stalls        jsonb;
    v_rv            jsonb;
    v_item          jsonb;
    v_grp           RECORD;
    v_nights        numeric;
    v_total         numeric := 0;
    v_ordered_total numeric;
    v_assigned_used numeric := 0;
    v_deficit       numeric;
    v_qty           numeric;
    v_take          numeric;
    v_price         numeric;
    v_flat_rate     numeric;
    v_paid          numeric;
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

        SELECT COALESCE(SUM(COALESCE(NULLIF(it->>'qty', '')::numeric, 0)), 0)
          INTO v_ordered_total
          FROM jsonb_array_elements(v_booking->'items') it
         WHERE it->>'type' = 'stall';

        -- Stalls really assigned to this booking right now, in ANY barn,
        -- capped at the ordered total, grouped by the barn each one is
        -- ACTUALLY in today.
        IF v_ordered_total > 0 THEN
            FOR v_grp IN
                SELECT barn_id, count(*)::numeric AS n
                  FROM (
                      SELECT barn->>'id' AS barn_id, stall->>'id' AS stall_id
                        FROM jsonb_array_elements(COALESCE(v_pd->'stallingService'->'barns', '[]'::jsonb)) barn,
                             jsonb_array_elements(COALESCE(barn->'stalls', '[]'::jsonb)) stall
                       WHERE stall->>'bookingId' = p_booking_id::text
                       ORDER BY stall_id
                       LIMIT v_ordered_total::bigint
                  ) used
                 GROUP BY barn_id
            LOOP
                v_flat_rate := public.barn_flat_rate(v_grp.barn_id, v_pd->'stallingService'->'extraStallFees');
                IF v_flat_rate > 0 THEN
                    v_total := v_total + v_grp.n * v_flat_rate;
                ELSE
                    SELECT COALESCE(NULLIF(barn->>'pricePerNight', '')::numeric, 0)
                      INTO v_price
                      FROM jsonb_array_elements(COALESCE(v_pd->'stallingService'->'barns', '[]'::jsonb)) barn
                     WHERE barn->>'id' = v_grp.barn_id
                     LIMIT 1;
                    v_total := v_total + v_grp.n * v_nights * COALESCE(v_price, 0);
                END IF;
                v_assigned_used := v_assigned_used + v_grp.n;
            END LOOP;
        END IF;

        -- Whatever part of the order isn't physically assigned yet, priced
        -- from each line's own originally-ordered barn/price.
        v_deficit := v_ordered_total - v_assigned_used;
        IF v_deficit > 0 THEN
            FOR v_item IN SELECT * FROM jsonb_array_elements(v_booking->'items') LOOP
                EXIT WHEN v_deficit <= 0;
                CONTINUE WHEN v_item->>'type' <> 'stall';
                v_qty := COALESCE(NULLIF(v_item->>'qty', '')::numeric, 0);
                v_take := LEAST(v_qty, v_deficit);
                CONTINUE WHEN v_take <= 0;
                v_deficit := v_deficit - v_take;

                v_flat_rate := public.barn_flat_rate(v_item->>'refId', v_pd->'stallingService'->'extraStallFees');
                IF v_flat_rate > 0 THEN
                    v_total := v_total + v_take * v_flat_rate;
                ELSE
                    v_price := COALESCE(NULLIF(v_item->>'unitPrice', '')::numeric, 0);
                    v_total := v_total + v_take * v_nights * v_price;
                END IF;
            END LOOP;
        END IF;

        -- Non-stall items keep their stored amount.
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_booking->'items') LOOP
            CONTINUE WHEN v_item->>'type' = 'stall';
            v_total := v_total + COALESCE(NULLIF(v_item->>'amount', '')::numeric, 0);
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
    v_data          jsonb;
    v_bookings      jsonb;
    v_booking       jsonb;
    v_index         int;
    v_item          jsonb;
    v_grp           RECORD;
    v_nights        numeric;
    v_total         numeric := 0;
    v_stored        numeric;
    v_ordered_total numeric;
    v_assigned_used numeric := 0;
    v_deficit       numeric;
    v_qty           numeric;
    v_take          numeric;
    v_price         numeric;
    v_flat_rate     numeric;
    v_prev_paid     numeric;
    v_new_paid      numeric;
    v_status        text;
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

        SELECT COALESCE(SUM(COALESCE(NULLIF(it->>'qty', '')::numeric, 0)), 0)
          INTO v_ordered_total
          FROM jsonb_array_elements(v_booking->'items') it
         WHERE it->>'type' = 'stall';

        -- Stalls really assigned to this booking right now, in ANY barn,
        -- capped at the ordered total, grouped by the barn each one is
        -- ACTUALLY in today.
        IF v_ordered_total > 0 THEN
            FOR v_grp IN
                SELECT barn_id, count(*)::numeric AS n
                  FROM (
                      SELECT barn->>'id' AS barn_id, stall->>'id' AS stall_id
                        FROM jsonb_array_elements(COALESCE(v_data->'stallingService'->'barns', '[]'::jsonb)) barn,
                             jsonb_array_elements(COALESCE(barn->'stalls', '[]'::jsonb)) stall
                       WHERE stall->>'bookingId' = p_booking_id
                       ORDER BY stall_id
                       LIMIT v_ordered_total::bigint
                  ) used
                 GROUP BY barn_id
            LOOP
                v_flat_rate := public.barn_flat_rate(v_grp.barn_id, v_data->'stallingService'->'extraStallFees');
                IF v_flat_rate > 0 THEN
                    v_total := v_total + v_grp.n * v_flat_rate;
                ELSE
                    SELECT COALESCE(NULLIF(barn->>'pricePerNight', '')::numeric, 0)
                      INTO v_price
                      FROM jsonb_array_elements(COALESCE(v_data->'stallingService'->'barns', '[]'::jsonb)) barn
                     WHERE barn->>'id' = v_grp.barn_id
                     LIMIT 1;
                    v_total := v_total + v_grp.n * v_nights * COALESCE(v_price, 0);
                END IF;
                v_assigned_used := v_assigned_used + v_grp.n;
            END LOOP;
        END IF;

        -- Whatever part of the order isn't physically assigned yet, priced
        -- from each line's own originally-ordered barn/price.
        v_deficit := v_ordered_total - v_assigned_used;
        IF v_deficit > 0 THEN
            FOR v_item IN SELECT * FROM jsonb_array_elements(v_booking->'items') LOOP
                EXIT WHEN v_deficit <= 0;
                CONTINUE WHEN v_item->>'type' <> 'stall';
                v_qty := COALESCE(NULLIF(v_item->>'qty', '')::numeric, 0);
                v_take := LEAST(v_qty, v_deficit);
                CONTINUE WHEN v_take <= 0;
                v_deficit := v_deficit - v_take;

                v_flat_rate := public.barn_flat_rate(v_item->>'refId', v_data->'stallingService'->'extraStallFees');
                IF v_flat_rate > 0 THEN
                    v_total := v_total + v_take * v_flat_rate;
                ELSE
                    v_price := COALESCE(NULLIF(v_item->>'unitPrice', '')::numeric, 0);
                    v_total := v_total + v_take * v_nights * v_price;
                END IF;
            END LOOP;
        END IF;

        -- Non-stall items keep their stored amount.
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_booking->'items') LOOP
            CONTINUE WHEN v_item->>'type' = 'stall';
            v_total := v_total + COALESCE(NULLIF(v_item->>'amount', '')::numeric, 0);
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
