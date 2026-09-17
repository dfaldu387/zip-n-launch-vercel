-- Add an optional "Show inventory" count to the public stalling chart.
--
-- Robert: some organizers want visitors to see how full the show is
-- (e.g. "12 of 20 stalls booked"), others don't want to advertise that a
-- show is nearly empty or nearly full. So this is off by default and only
-- included when the organizer turns on chartPublish.showInventory in the
-- Publish Chart dialog. Counts are totals only (no exhibitor-level detail),
-- computed server-side so a client bug can't leak anything finer-grained.

CREATE OR REPLACE FUNCTION public.get_public_stalling_chart(p_show_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pd             jsonb;
    v_svc            jsonb;
    v_pub            jsonb;
    v_layers         jsonb;
    v_show_name      text;
    v_housing_status text;
    v_bookings       jsonb;
    v_show_inventory boolean;
BEGIN
    IF p_show_id IS NULL THEN
        RETURN jsonb_build_object('enabled', false);
    END IF;

    SELECT p.project_data, p.project_name INTO v_pd, v_show_name
      FROM public.projects p WHERE p.id = p_show_id;
    IF v_pd IS NULL THEN
        RETURN jsonb_build_object('enabled', false);
    END IF;

    v_svc := COALESCE(v_pd->'stallingService', '{}'::jsonb);
    v_pub := COALESCE(v_svc->'chartPublish', '{}'::jsonb);
    v_housing_status := COALESCE(
        NULLIF(v_pd->'moduleStatuses'->>'housing', ''),
        NULLIF(v_svc->>'publishStatus', ''),
        'draft');

    -- Nothing to show unless housing is published AND the organizer explicitly
    -- turned the public chart on.
    IF v_housing_status <> 'published' OR COALESCE((v_pub->>'enabled')::boolean, false) IS NOT TRUE THEN
        RETURN jsonb_build_object('enabled', false);
    END IF;

    v_layers := COALESCE(v_pub->'layers', '["number","name","trainer"]'::jsonb);
    v_show_inventory := COALESCE((v_pub->>'showInventory')::boolean, false);

    v_bookings := (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', b->>'id',
            'exhibitor', COALESCE(b->>'exhibitorName', ''),
            'trainer', CASE
                WHEN COALESCE(b->>'stallGroup', '') = '__none__' THEN ''
                WHEN COALESCE(b->>'stallGroup', '') <> ''        THEN b->>'stallGroup'
                WHEN COALESCE(b->>'trainerName', '') <> ''       THEN b->>'trainerName'
                ELSE COALESCE(b->>'exhibitorName', '')
            END
        )), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(v_svc->'bookings', '[]'::jsonb)) b
        WHERE COALESCE(b->>'status', '') <> 'cancelled'
    );

    RETURN jsonb_build_object(
        'enabled',      true,
        'showName',     v_show_name,
        'layers',       v_layers,
        'perBarnPages', COALESCE((v_pub->>'perBarnPages')::boolean, true),

        'inventory', CASE WHEN v_show_inventory THEN jsonb_build_object(
            'stallsTotal', (
                SELECT count(*) FROM jsonb_array_elements(COALESCE(v_svc->'barns', '[]'::jsonb)) barn,
                     jsonb_array_elements(COALESCE(barn->'stalls', '[]'::jsonb)) st
                WHERE COALESCE(st->>'type', 'stall') = 'stall'
            ),
            'stallsTaken', (
                SELECT count(*) FROM jsonb_array_elements(COALESCE(v_svc->'barns', '[]'::jsonb)) barn,
                     jsonb_array_elements(COALESCE(barn->'stalls', '[]'::jsonb)) st
                WHERE COALESCE(st->>'type', 'stall') = 'stall' AND COALESCE(st->>'bookingId', '') <> ''
            ),
            'rvTotal', (
                SELECT count(*) FROM jsonb_array_elements(COALESCE(v_svc->'rvAreas', '[]'::jsonb)) rv,
                     jsonb_array_elements(COALESCE(rv->'spots', '[]'::jsonb)) sp
            ),
            'rvTaken', (
                SELECT count(*) FROM jsonb_array_elements(COALESCE(v_svc->'rvAreas', '[]'::jsonb)) rv,
                     jsonb_array_elements(COALESCE(rv->'spots', '[]'::jsonb)) sp
                WHERE COALESCE(sp->>'bookingId', '') <> ''
            )
        ) END,

        'barns', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id',         barn->>'id',
                'name',       barn->>'name',
                'layoutCols', NULLIF(barn->>'layoutCols', '')::int,
                'stallCount', NULLIF(barn->>'stallCount', '')::int,
                'rowLabels',  COALESCE(barn->'rowLabels', '[]'::jsonb),
                'colLabels',  COALESCE(barn->'colLabels', '[]'::jsonb),
                'stalls', (
                    SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'id',       st->>'id',
                        'number',   st->>'number',
                        'type',     COALESCE(st->>'type', 'stall'),
                        'taken',    COALESCE(st->>'bookingId', '') <> '',
                        'exhibitor', CASE WHEN v_layers ? 'name' THEN
                            (SELECT bk->>'exhibitor' FROM jsonb_array_elements(v_bookings) bk WHERE bk->>'id' = st->>'bookingId')
                        END,
                        'trainer', CASE WHEN v_layers ? 'trainer' THEN
                            (SELECT bk->>'trainer' FROM jsonb_array_elements(v_bookings) bk WHERE bk->>'id' = st->>'bookingId')
                        END,
                        'groupKey', (SELECT bk->>'trainer' FROM jsonb_array_elements(v_bookings) bk WHERE bk->>'id' = st->>'bookingId')
                    ) ORDER BY ord), '[]'::jsonb)
                    FROM jsonb_array_elements(COALESCE(barn->'stalls', '[]'::jsonb)) WITH ORDINALITY AS x(st, ord)
                )
            ) ORDER BY ord), '[]'::jsonb)
            FROM jsonb_array_elements(COALESCE(v_svc->'barns', '[]'::jsonb)) WITH ORDINALITY AS y(barn, ord)
        ),

        'rvAreas', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id',         rv->>'id',
                'name',       rv->>'name',
                'spotCount',  COALESCE(NULLIF(rv->>'spotCount', '')::int, 0),
                'rowLabels',  COALESCE(rv->'rowLabels', '[]'::jsonb),
                'colLabels',  COALESCE(rv->'colLabels', '[]'::jsonb),
                'spots', (
                    SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'id',       sp->>'id',
                        'number',   sp->>'number',
                        'taken',    COALESCE(sp->>'bookingId', '') <> '',
                        'exhibitor', CASE WHEN v_layers ? 'name' THEN
                            (SELECT bk->>'exhibitor' FROM jsonb_array_elements(v_bookings) bk WHERE bk->>'id' = sp->>'bookingId')
                        END,
                        'trainer', CASE WHEN v_layers ? 'trainer' THEN
                            (SELECT bk->>'trainer' FROM jsonb_array_elements(v_bookings) bk WHERE bk->>'id' = sp->>'bookingId')
                        END,
                        'groupKey', (SELECT bk->>'trainer' FROM jsonb_array_elements(v_bookings) bk WHERE bk->>'id' = sp->>'bookingId')
                    ) ORDER BY ord), '[]'::jsonb)
                    FROM jsonb_array_elements(COALESCE(rv->'spots', '[]'::jsonb)) WITH ORDINALITY AS x(sp, ord)
                )
            ) ORDER BY ord), '[]'::jsonb)
            FROM jsonb_array_elements(COALESCE(v_svc->'rvAreas', '[]'::jsonb)) WITH ORDINALITY AS y(rv, ord)
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_stalling_chart(uuid) TO anon, authenticated;
