-- Delivery sheet, part 2 (Robert, 2026-11-01): the same phone page also shows the
-- Stalling map, so the driver can tap a stall and mark Delivered from the map.
-- Replaces get_delivery_sheet from 20261102120000 (same name + arguments) and adds a
-- "map" object: the barns with their stalls, the supply list, and each live order
-- trimmed to what the map draws. No phone numbers, emails or payment details.

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
    v_map   jsonb;
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

    SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id',                b->'id',
               'status',            b->'status',
               'orderType',         b->'orderType',
               'exhibitorName',     b->'exhibitorName',
               'trainerName',       b->'trainerName',
               'stableWith',        b->'stableWith',
               'stallGroup',        b->'stallGroup',
               'horseNames',        b->'horseNames',
               'horses',            b->'horses',
               'horseCount',        b->'horseCount',
               'stallId',           b->'stallId',
               'items',             b->'items',
               'itemStatuses',      b->'itemStatuses',
               'fulfillmentStatus', b->'fulfillmentStatus'
           ))), '[]'::jsonb)
      INTO v_map
      FROM jsonb_array_elements(COALESCE(v_data->'stallingService'->'bookings', '[]'::jsonb)) AS b
     WHERE COALESCE(b->>'status', '') <> 'cancelled';

    RETURN jsonb_build_object(
        'showName', v_name,
        'lines',    v_lines,
        'map',      jsonb_build_object(
            'bookings', v_map,
            'barns',    COALESCE(v_data->'stallingService'->'barns', '[]'::jsonb),
            'supplies', COALESCE(v_data->'stallingService'->'supplies', '[]'::jsonb)
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_delivery_sheet(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_delivery_sheet(uuid, text) TO anon, authenticated;
