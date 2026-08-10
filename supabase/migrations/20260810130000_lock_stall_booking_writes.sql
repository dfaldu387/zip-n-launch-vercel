-- Stop a stall payment (or a booking) being wiped out by a save that lands at
-- the same moment.
--
-- Both writes were read-modify-write on the whole project_data blob:
--
--   Stripe webhook                  Show office on the Housing page
--   ──────────────                  ───────────────────────────────
--   reads the show (v1)
--                                   reads the show (v1)
--   marks the booking paid
--   writes v1 + payment
--                                   assigns a stall
--                                   writes v1 + stall     <- payment gone
--
-- Last write wins, so the exhibitor is charged and the office still shows
-- "unpaid" — or the office's stall work disappears instead.
--
-- The cure is SELECT ... FOR UPDATE: the second writer waits for the first to
-- finish and then reads the already-updated row, so nothing is overwritten.

-- ── 1. Record a payment against a housing booking, under a row lock ──────────
-- Replaces the read/modify/write that used to live in supabase/functions/
-- stripe-webhook/index.ts. The live-total maths is the same rule as
-- computeBookingTotal() there and in src/lib/bookingPricing.js: assigned
-- stalls x nights x the barn's CURRENT price per night, plus non-stall items.
-- Adding the payment is additive so a later top-up (pay the difference) counts.

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

                v_total := v_total + v_count * v_nights * COALESCE(v_price, 0);
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

-- Only the webhook calls this, and it runs as the service role.
REVOKE ALL ON FUNCTION public.record_stall_booking_payment(uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_stall_booking_payment(uuid, text, numeric) TO service_role;

-- ── 2. Same race in the public booking append ───────────────────────────────
-- Two exhibitors submitting at the same second could both read the same
-- bookings array, and the second write would drop the first booking. Only the
-- SELECT gains FOR UPDATE; the rest is unchanged.

CREATE OR REPLACE FUNCTION public.append_public_booking(
    p_project_id uuid,
    p_booking jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking_id uuid;
    v_current_data jsonb;
    v_enriched jsonb;
BEGIN
    IF p_project_id IS NULL THEN
        RAISE EXCEPTION 'project_id is required' USING ERRCODE = '22023';
    END IF;
    IF p_booking IS NULL OR jsonb_typeof(p_booking) <> 'object' THEN
        RAISE EXCEPTION 'booking must be a JSON object' USING ERRCODE = '22023';
    END IF;

    v_booking_id := COALESCE(NULLIF(p_booking->>'id','')::uuid, gen_random_uuid());

    v_enriched := p_booking || jsonb_build_object(
        'id', v_booking_id::text,
        'createdAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'source', COALESCE(p_booking->>'source', 'public_booking'),
        'status', COALESCE(p_booking->>'status', 'pending'),
        'paymentStatus', COALESCE(p_booking->>'paymentStatus', 'unpaid')
    );

    SELECT project_data INTO v_current_data
    FROM public.projects
    WHERE id = p_project_id
    FOR UPDATE;

    IF v_current_data IS NULL THEN
        RAISE EXCEPTION 'Show not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_current_data->'stallingService' IS NULL OR jsonb_typeof(v_current_data->'stallingService') <> 'object' THEN
        v_current_data := jsonb_set(v_current_data, '{stallingService}', '{}'::jsonb, true);
    END IF;
    IF v_current_data->'stallingService'->'bookings' IS NULL OR jsonb_typeof(v_current_data->'stallingService'->'bookings') <> 'array' THEN
        v_current_data := jsonb_set(v_current_data, '{stallingService,bookings}', '[]'::jsonb, true);
    END IF;

    v_current_data := jsonb_set(
        v_current_data,
        '{stallingService,bookings}',
        (v_current_data->'stallingService'->'bookings') || jsonb_build_array(v_enriched),
        true
    );

    UPDATE public.projects
    SET project_data = v_current_data
    WHERE id = p_project_id;

    RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_public_booking(uuid, jsonb) TO anon, authenticated;
