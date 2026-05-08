-- Public-booking RPC: lets anonymous exhibitors append a booking to a show's
-- stallingService.bookings array WITHOUT giving them blanket UPDATE on projects.
-- Uses SECURITY DEFINER so it bypasses RLS but only does the safe append.

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
    WHERE id = p_project_id;

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
