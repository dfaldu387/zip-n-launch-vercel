-- Delivery sheet QR (Robert, 2026-11-01): one extra QR at the top of the Load Sheet.
-- Scanning it opens a no-login phone page listing every supply order in the show, so
-- the driver can mark lines Delivered from the list (and, next, from the stalling map).
--
-- The link carries showId + project_data.deliveryShowSecret (32 random hex chars made
-- the first time a Load Sheet is printed). This function only READS: it returns each
-- order's own delivery secret so the phone page can reuse the existing per-line
-- functions (get_delivery_line / set_delivery_line_status) and the delivered email —
-- nothing about how a delivery is saved changes. A wrong or missing secret is refused
-- with one generic error.

CREATE OR REPLACE FUNCTION public.get_delivery_sheet(
    p_show_id uuid,
    p_secret  text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_data  jsonb;
    v_name  text;
    v_lines jsonb;
BEGIN
    IF p_show_id IS NULL OR COALESCE(p_secret, '') = '' THEN
        RAISE EXCEPTION 'Invalid delivery link' USING ERRCODE = '22023';
    END IF;

    SELECT project_data, project_name INTO v_data, v_name
      FROM public.projects
     WHERE id = p_show_id;

    IF v_data IS NULL
       OR COALESCE(v_data->>'deliveryShowSecret', '') = ''
       OR v_data->>'deliveryShowSecret' <> p_secret THEN
        RAISE EXCEPTION 'Invalid delivery link' USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(jsonb_agg(
               public._delivery_line_view(v_data, b, v_name, NULL)
               || jsonb_build_object(
                    'bookingId', b->>'id',
                    'secret',    v_data->'deliverySecrets'->>(b->>'id')
                  )
               ORDER BY ord), '[]'::jsonb)
      INTO v_lines
      FROM jsonb_array_elements(COALESCE(v_data->'stallingService'->'bookings', '[]'::jsonb))
           WITH ORDINALITY AS t(b, ord)
     WHERE COALESCE(b->>'status', '') <> 'cancelled'
       AND COALESCE(v_data->'deliverySecrets'->>(b->>'id'), '') <> ''
       AND EXISTS (
            SELECT 1
              FROM jsonb_array_elements(COALESCE(b->'items', '[]'::jsonb)) it
             WHERE it->>'type' = 'supply' AND COALESCE(it->>'refId', '') <> ''
       );

    RETURN jsonb_build_object('showName', v_name, 'lines', v_lines);
END;
$$;

REVOKE ALL ON FUNCTION public.get_delivery_sheet(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_delivery_sheet(uuid, text) TO anon, authenticated;
