-- Public booking lookup RPC.
-- Lets a customer find their booking by email and/or 8-char short ref.
-- Returns an array of lightweight booking summaries (NOT the full booking),
-- so the customer can pick one and navigate to /booking/<full_id>.

CREATE OR REPLACE FUNCTION public.find_public_bookings(
    p_email text DEFAULT NULL,
    p_short_ref text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email text;
    v_ref text;
    v_results jsonb;
BEGIN
    v_email := NULLIF(LOWER(TRIM(p_email)), '');
    v_ref   := NULLIF(LOWER(TRIM(p_short_ref)), '');

    -- Require at least one criterion so we don't dump everyone's bookings.
    IF v_email IS NULL AND v_ref IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT COALESCE(jsonb_agg(rec), '[]'::jsonb)
    INTO v_results
    FROM (
        SELECT
            jsonb_build_object(
                'bookingId',     booking->>'id',
                'shortRef',      UPPER(SUBSTRING(booking->>'id', 1, 8)),
                'exhibitorName', booking->>'exhibitorName',
                'email',         booking->>'email',
                'status',        booking->>'status',
                'arrivalDate',   booking->>'arrivalDate',
                'departureDate', booking->>'departureDate',
                'totalAmount',   COALESCE((booking->>'totalAmount')::numeric, (booking->>'amount')::numeric, 0),
                'showId',        p.id,
                'showName',      p.project_name,
                'createdAt',     booking->>'createdAt'
            ) AS rec
        FROM public.projects p,
             jsonb_array_elements(COALESCE(p.project_data->'stallingService'->'bookings', '[]'::jsonb)) booking
        WHERE
            (v_email IS NULL OR LOWER(booking->>'email') = v_email)
            AND
            (v_ref   IS NULL OR LOWER(SUBSTRING(booking->>'id', 1, 8)) = v_ref)
        ORDER BY booking->>'createdAt' DESC NULLS LAST
        LIMIT 50
    ) sub;

    RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_public_bookings(text, text) TO anon, authenticated;
