-- Public booking-status lookup RPC.
-- Lets a customer (anon) look up their own booking by UUID and see:
--   - the full booking record (status, items, contact, totals)
--   - any stalls actually pinned to them in barn data
--   - light show info (id + name) for context
-- Returns NULL when no matching booking is found, which the UI renders as "not found".

CREATE OR REPLACE FUNCTION public.get_public_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_show_id uuid;
    v_show_name text;
    v_booking jsonb;
    v_assigned_stalls jsonb;
BEGIN
    IF p_booking_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Find the booking inside any project's stallingService.bookings array.
    SELECT p.id, p.project_name, booking
    INTO v_show_id, v_show_name, v_booking
    FROM public.projects p,
         jsonb_array_elements(COALESCE(p.project_data->'stallingService'->'bookings', '[]'::jsonb)) booking
    WHERE booking->>'id' = p_booking_id::text
    LIMIT 1;

    IF v_booking IS NULL THEN
        RETURN NULL;
    END IF;

    -- Collect any stalls in this show that are pinned to this booking.
    SELECT jsonb_agg(jsonb_build_object(
        'barnName', barn->>'name',
        'stallNumber', stall->>'number',
        'stallId', stall->>'id'
    ))
    INTO v_assigned_stalls
    FROM public.projects p,
         jsonb_array_elements(COALESCE(p.project_data->'stallingService'->'barns', '[]'::jsonb)) barn,
         jsonb_array_elements(COALESCE(barn->'stalls', '[]'::jsonb)) stall
    WHERE p.id = v_show_id
      AND stall->>'bookingId' = p_booking_id::text;

    RETURN jsonb_build_object(
        'booking', v_booking,
        'assignedStalls', COALESCE(v_assigned_stalls, '[]'::jsonb),
        'show', jsonb_build_object(
            'id', v_show_id,
            'name', v_show_name
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_booking(uuid) TO anon, authenticated;
