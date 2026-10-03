-- find_public_bookings is open to anyone (no login). Searching by email alone
-- returned the full booking id, name, email, show, dates and amount of up to 50
-- bookings, and the page jumped straight to the booking. Typing anyone's email
-- was enough to read their reservation.
--
-- A lookup now needs BOTH the email and the 8-character reference from the
-- confirmation email, and only that one booking can match.

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

    -- Both are required, and the reference must be the full 8 characters.
    IF v_email IS NULL OR v_ref IS NULL OR LENGTH(v_ref) <> 8 THEN
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
                'status',        booking->>'status',
                'arrivalDate',   booking->>'arrivalDate',
                'departureDate', booking->>'departureDate',
                'showId',        p.id,
                'showName',      p.project_name,
                'createdAt',     booking->>'createdAt'
            ) AS rec
        FROM public.projects p,
             jsonb_array_elements(COALESCE(p.project_data->'stallingService'->'bookings', '[]'::jsonb)) booking
        WHERE LOWER(booking->>'email') = v_email
          AND LOWER(SUBSTRING(booking->>'id', 1, 8)) = v_ref
        ORDER BY booking->>'createdAt' DESC NULLS LAST
        LIMIT 5
    ) sub;

    RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_public_bookings(text, text) TO anon, authenticated;
