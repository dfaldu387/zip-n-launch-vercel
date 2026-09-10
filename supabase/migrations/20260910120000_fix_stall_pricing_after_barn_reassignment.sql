-- Fix: a stall bought under the Flat Fee option (or the Nightly Fee option —
-- see the split selector added in 20260902090000) lost track of which option
-- it was bought under whenever the organizer physically assigned it to a
-- DIFFERENT barn than it was ordered in. get_public_booking() and
-- record_stall_booking_payment() only remembered one feeType per BARN, so
-- once the assigned barn changed, both stalls got billed at one combined
-- "mixed" per-stall rate instead of their own Flat/Nightly rate.
--
-- Caught live: a booking sold as 1 Flat-fee stall + 1 Nightly-fee stall in
-- Barn A (feeType stamped on each item — see buildBarnStallOptionItems in
-- extraStallFees.js), both stalls later assigned into Barn B. The booking
-- status page total, and what Stripe would actually charge, jumped from the
-- correct $531 to $783 — a real ~50% overcharge. The client-side pricing
-- module (src/lib/bookingPricing.js) had the exact same bug and was fixed
-- there first; this migration ports the identical fix into SQL.
--
-- Root fix: track feeType/nights per ORDERED UNIT (one per stall ordered),
-- not per barn, so pairing an ordered unit with whichever stall actually
-- fulfilled it never loses which purchase option that unit was bought under
-- — the same fix as bookingPricing.js's buildStallRows.
--
-- New shared helper so get_public_booking and record_stall_booking_payment
-- never diverge from each other (or from the invoice PDF) again — one
-- function, not two hand-rolled copies.

CREATE OR REPLACE FUNCTION public.compute_booking_stall_total(
    p_items         jsonb,
    p_project_data  jsonb,
    p_booking_id    text,
    p_default_nights numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_units          jsonb := '[]'::jsonb;
    v_item           jsonb;
    v_qty            int;
    v_item_nights    numeric;
    v_ordered_total  int;
    v_used           jsonb := '[]'::jsonb;
    v_used_count     int;
    v_assigned_total numeric := 0;
    v_fallback_total numeric := 0;
    v_deficit        int;
    v_take           int;
    v_nightly_rate   numeric;
    v_flat_rate      numeric;
    v_fee_type       text;
BEGIN
    IF p_items IS NULL THEN
        RETURN 0;
    END IF;

    -- Unroll every 'stall' item into one unit per stall ORDERED, each
    -- carrying that item's own feeType/nights.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        IF v_item->>'type' = 'stall' THEN
            v_qty := COALESCE(NULLIF(v_item->>'qty', '')::int, 0);
            v_item_nights := COALESCE(NULLIF(v_item->>'nights', '')::numeric, p_default_nights);
            FOR i IN 1..GREATEST(v_qty, 0) LOOP
                v_units := v_units || jsonb_build_object('feeType', v_item->>'feeType', 'nights', v_item_nights);
            END LOOP;
        END IF;
    END LOOP;
    v_ordered_total := jsonb_array_length(v_units);

    -- Stalls actually physically assigned to this booking (any barn), capped
    -- to the total ordered, in a stable order so pairing is deterministic.
    IF v_ordered_total > 0 THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object('barnId', barn_id, 'pricePerNight', price_per_night)), '[]'::jsonb)
          INTO v_used
          FROM (
              SELECT barn->>'id' AS barn_id,
                     COALESCE(NULLIF(barn->>'pricePerNight', '')::numeric, 0) AS price_per_night
                FROM jsonb_array_elements(COALESCE(p_project_data->'stallingService'->'barns', '[]'::jsonb)) barn,
                     jsonb_array_elements(COALESCE(barn->'stalls', '[]'::jsonb)) stall
               WHERE stall->>'bookingId' = p_booking_id
               ORDER BY barn->>'name', stall->>'number'
               LIMIT v_ordered_total
          ) s;
    END IF;
    v_used_count := jsonb_array_length(v_used);

    -- Pair unit[i] with used[i] and bill each (assigned barn, feeType) group
    -- at the assigned barn's CURRENT rate for exactly that fee type — never
    -- combining a Flat-bought stall with a Nightly-bought one just because
    -- they landed in the same barn.
    IF v_used_count > 0 THEN
        SELECT COALESCE(SUM(
            CASE
                WHEN fee_type = 'flat'      THEN cnt * public.barn_flat_rate(barn_id, p_project_data->'stallingService'->'extraStallFees')
                WHEN fee_type = 'per_night' THEN cnt * barn_nights * nightly_rate
                ELSE                             cnt * (barn_nights * nightly_rate + public.barn_flat_rate(barn_id, p_project_data->'stallingService'->'extraStallFees'))
            END
        ), 0)
          INTO v_assigned_total
          FROM (
              SELECT (u.value->>'barnId') AS barn_id,
                     COALESCE(un.value->>'feeType', '') AS fee_type,
                     count(*) AS cnt,
                     max(COALESCE(NULLIF(u.value->>'pricePerNight', '')::numeric, 0)) AS nightly_rate,
                     max(COALESCE(NULLIF(un.value->>'nights', '')::numeric, p_default_nights)) AS barn_nights
                FROM jsonb_array_elements(v_used) WITH ORDINALITY AS u(value, idx)
                JOIN jsonb_array_elements(v_units) WITH ORDINALITY AS un(value, idx) ON un.idx = u.idx
               GROUP BY barn_id, COALESCE(un.value->>'feeType', '')
          ) grouped;
    END IF;

    -- Whatever isn't physically assigned yet: priced from each line's own
    -- originally-ordered barn, same as before this fix — current flat rate
    -- if it has one, else the unitPrice frozen at booking time.
    v_deficit := GREATEST(v_ordered_total - v_used_count, 0);
    IF v_deficit > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
            EXIT WHEN v_deficit <= 0;
            CONTINUE WHEN v_item->>'type' <> 'stall';

            v_qty := COALESCE(NULLIF(v_item->>'qty', '')::int, 0);
            v_take := LEAST(v_qty, v_deficit);
            CONTINUE WHEN v_take <= 0;
            v_deficit := v_deficit - v_take;

            v_item_nights := COALESCE(NULLIF(v_item->>'nights', '')::numeric, p_default_nights);
            v_nightly_rate := COALESCE(NULLIF(v_item->>'unitPrice', '')::numeric, 0);
            v_flat_rate := public.barn_flat_rate(v_item->>'refId', p_project_data->'stallingService'->'extraStallFees');
            v_fee_type := v_item->>'feeType';

            IF v_fee_type = 'flat' THEN
                v_fallback_total := v_fallback_total + v_take * v_flat_rate;
            ELSIF v_fee_type = 'per_night' THEN
                v_fallback_total := v_fallback_total + v_take * v_item_nights * v_nightly_rate;
            ELSE
                v_fallback_total := v_fallback_total + v_take * (v_item_nights * v_nightly_rate + v_flat_rate);
            END IF;
        END LOOP;
    END IF;

    RETURN v_assigned_total + v_fallback_total;
END;
$$;

-- ── get_public_booking: rebuild the live total using the shared helper ──

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
            'name', v_show_name
        )
    );
END;
$$;

-- ── record_stall_booking_payment: same helper, same fix ──

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
    v_prev_paid numeric;
    v_new_paid  numeric;
    v_status    text;
BEGIN
    IF p_show_id IS NULL OR COALESCE(p_booking_id, '') = '' THEN
        RAISE EXCEPTION 'show id and booking id are required' USING ERRCODE = '22023';
    END IF;

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

        v_total := public.compute_booking_stall_total(v_booking->'items', v_data, p_booking_id, v_nights);

        FOR v_item IN SELECT * FROM jsonb_array_elements(v_booking->'items') LOOP
            IF v_item->>'type' <> 'stall' THEN
                v_total := v_total + COALESCE(NULLIF(v_item->>'amount', '')::numeric, 0);
            END IF;
        END LOOP;
    ELSE
        v_total := COALESCE(NULLIF(v_booking->>'amount', '')::numeric, 0);
    END IF;

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

GRANT EXECUTE ON FUNCTION public.get_public_booking(uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.record_stall_booking_payment(uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_stall_booking_payment(uuid, text, numeric) TO service_role;
