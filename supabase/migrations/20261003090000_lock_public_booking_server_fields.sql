-- append_public_booking is callable by anyone with the public key (no login).
-- It used to store the booking exactly as the browser sent it, so a hand-made
-- request could arrive as status "confirmed", paymentStatus "paid", with a
-- paidAmount and pre-assigned stalls. Money and workflow fields are now set
-- here, never taken from the caller. Everything else behaves as before; the
-- row lock (FOR UPDATE) from 20260810130000 is kept.
--
-- Step A only: prices of RV / support / supply items are still taken from the
-- caller and need a server-side recompute (separate step).

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
    v_clean jsonb;
    v_enriched jsonb;
    v_is_supply boolean;
BEGIN
    IF p_project_id IS NULL THEN
        RAISE EXCEPTION 'project_id is required' USING ERRCODE = '22023';
    END IF;
    IF p_booking IS NULL OR jsonb_typeof(p_booking) <> 'object' THEN
        RAISE EXCEPTION 'booking must be a JSON object' USING ERRCODE = '22023';
    END IF;

    v_booking_id := COALESCE(NULLIF(p_booking->>'id','')::uuid, gen_random_uuid());
    v_is_supply  := p_booking->>'orderType' = 'live-supply';

    -- Fields only the office or the Stripe webhook may set.
    v_clean := p_booking
        - 'paidAmount' - 'paidAt'
        - 'assignedStalls' - 'assignedRvSpots'
        - 'fulfillmentStatus';

    v_enriched := v_clean || jsonb_build_object(
        'id', v_booking_id::text,
        'createdAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'source', CASE WHEN v_is_supply THEN 'live_supply' ELSE 'public_booking' END,
        'status', 'pending',
        'paymentStatus', 'unpaid'
    );
    IF v_is_supply THEN
        v_enriched := v_enriched || jsonb_build_object('fulfillmentStatus', 'new');
    END IF;

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
