-- Robert's "RV and Camping Fee Logic Updates" video, task 6: the booking page
-- should show each barn's own move-in/move-out dates on the Select Items step,
-- not just buried in Step 2's date pickers ("people know exactly what they're
-- booking"). A barn can override the show's move-in/move-out window
-- (BarnCard's "This barn moves in/out on different dates than the show
-- default above" checkbox) — public_show_inventory did not expose that
-- override at all, so the booking page always fell back to the show-wide
-- window. Adds moveInDate/moveOutDate (null when the barn uses the show
-- default) to each barn. Everything else is unchanged from
-- 20260827120000_public_show_supply_delivery_flags.sql.

CREATE OR REPLACE FUNCTION public.public_show_inventory(p_svc jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH svc AS (
    SELECT COALESCE(p_svc, '{}'::jsonb) AS s
),
live AS (
    SELECT b AS bk
    FROM svc, jsonb_array_elements(COALESCE(s->'bookings', '[]'::jsonb)) b
    WHERE COALESCE(b->>'status', '') <> 'cancelled'
),
barn AS (
    SELECT b AS barn
    FROM svc, jsonb_array_elements(COALESCE(s->'barns', '[]'::jsonb)) b
),
assigned AS (
    SELECT barn->>'id' AS ref_id,
           stall->>'bookingId' AS booking_id,
           count(*)::numeric AS n
    FROM barn, jsonb_array_elements(COALESCE(barn->'stalls', '[]'::jsonb)) stall
    WHERE COALESCE(stall->>'bookingId', '') <> ''
      AND EXISTS (SELECT 1 FROM live WHERE live.bk->>'id' = stall->>'bookingId')
    GROUP BY 1, 2
),
ordered AS (
    SELECT live.bk->>'id' AS booking_id,
           it->>'refId'   AS ref_id,
           it->>'type'    AS kind,
           COALESCE(NULLIF(it->>'qty', '')::numeric, 0) AS qty
    FROM live, jsonb_array_elements(COALESCE(live.bk->'items', '[]'::jsonb)) it
    WHERE COALESCE(it->>'refId', '') <> ''
),
stall_outstanding AS (
    SELECT o.ref_id, sum(GREATEST(o.qty - COALESCE(a.n, 0), 0)) AS n
    FROM ordered o
    LEFT JOIN assigned a
           ON a.ref_id = o.ref_id AND a.booking_id = o.booking_id
    WHERE o.kind = 'stall'
    GROUP BY 1
),
stall_taken AS (
    SELECT ref_id, sum(n) AS n
    FROM (
        SELECT ref_id, n FROM assigned
        UNION ALL
        SELECT ref_id, n FROM stall_outstanding
    ) x
    GROUP BY 1
),
qty_taken AS (
    SELECT kind, ref_id, sum(qty) AS n
    FROM ordered
    WHERE kind IN ('rv', 'support', 'supply')
    GROUP BY 1, 2
)
SELECT jsonb_build_object(

    'barns', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id',            barn->>'id',
            'name',          barn->>'name',
            'stallSize',     barn->>'stallSize',
            'pricePerNight', COALESCE(NULLIF(barn->>'pricePerNight', '')::numeric, 0),
            -- null when the barn uses the show's default move-in/move-out —
            -- the booking page falls back to bookWindow in that case.
            'moveInDate',  NULLIF(barn->>'moveInDate', ''),
            'moveOutDate', NULLIF(barn->>'moveOutDate', ''),
            -- Aisles, rooms and blocked boxes are not bookable, so only real
            -- stalls count. Falls back to stallCount when no stalls are drawn.
            'total', COALESCE(
                NULLIF((SELECT count(*) FROM jsonb_array_elements(COALESCE(barn->'stalls', '[]'::jsonb)) st
                         WHERE COALESCE(st->>'type', 'stall') = 'stall'), 0)::numeric,
                NULLIF(barn->>'stallCount', '')::numeric,
                0),
            'taken', COALESCE((SELECT n FROM stall_taken t WHERE t.ref_id = barn->>'id'), 0)
        )), '[]'::jsonb)
        FROM barn
    ),

    'rvAreas', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id',                   rv->>'id',
            'name',                 rv->>'name',
            'pricingModel',         COALESCE(NULLIF(rv->>'pricingModel', ''), 'nightly'),
            'pricePerNight',        COALESCE(NULLIF(rv->>'pricePerNight', '')::numeric, 0),
            'flatRate',             COALESCE(NULLIF(rv->>'flatRate', '')::numeric, 0),
            'hookupType',           rv->>'hookupType',
            'powerType',            rv->>'powerType',
            'maxLength',            COALESCE(NULLIF(rv->>'maxLength', '')::numeric, 0),
            'hasWater',             COALESCE((rv->>'hasWater')::boolean, false),
            'hasSewer',             COALESCE((rv->>'hasSewer')::boolean, false),
            'hasWifi',              COALESCE((rv->>'hasWifi')::boolean, false),
            'isOverflow',           COALESCE((rv->>'isOverflow')::boolean, false),
            'total',                COALESCE(NULLIF(rv->>'spotCount', '')::numeric, 0),
            'taken', COALESCE((SELECT n FROM qty_taken q WHERE q.kind = 'rv' AND q.ref_id = rv->>'id'), 0)
        )), '[]'::jsonb)
        FROM svc, jsonb_array_elements(COALESCE(s->'rvAreas', '[]'::jsonb)) rv
    ),

    'supportSpaces', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id',            sp->>'id',
            'name',          sp->>'name',
            'size',          sp->>'size',
            'pricePerNight', COALESCE(NULLIF(sp->>'pricePerNight', '')::numeric, 0),
            'total',         COALESCE(NULLIF(sp->>'unitCount', '')::numeric, 0),
            'taken', COALESCE((SELECT n FROM qty_taken q WHERE q.kind = 'support' AND q.ref_id = sp->>'id'), 0)
        )), '[]'::jsonb)
        FROM svc, jsonb_array_elements(COALESCE(s->'supportSpaces', '[]'::jsonb)) sp
    ),

    'supplies', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id',       COALESCE(NULLIF(su->>'id', ''), su->>'name'),
            'name',     su->>'name',
            'unit',     su->>'unit',
            'price',    COALESCE(NULLIF(su->>'price', '')::numeric, 0),
            -- stockQty of 0 means "no limit", same as the booking page.
            'stockQty', COALESCE(NULLIF(su->>'stockQty', '')::numeric, 0),
            'sold', COALESCE((SELECT n FROM qty_taken q
                               WHERE q.kind = 'supply'
                                 AND q.ref_id = COALESCE(NULLIF(su->>'id', ''), su->>'name')), 0),
            'preBedding',      COALESCE((su->>'preBedding')::boolean, false),
            'deliveredAtShow', COALESCE((su->>'deliveredAtShow')::boolean, false)
        )), '[]'::jsonb)
        FROM svc, jsonb_array_elements(COALESCE(s->'supplies', '[]'::jsonb)) su
    ),

    -- Every stall fee, including a barn's own per-night rate. appliesTo is
    -- 'all' or a jsonb array of barn ids (or, from before multi-select, a
    -- single barn id string) — kept as raw jsonb so an array survives the
    -- round trip. The booking page turns these into line items using unitType.
    'extraStallFees', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id',        f->>'id',
            'name',      f->>'name',
            'appliesTo', CASE jsonb_typeof(f->'appliesTo')
                WHEN 'string' THEN CASE WHEN (f->>'appliesTo') = '' THEN to_jsonb('all'::text) ELSE f->'appliesTo' END
                WHEN 'array'  THEN CASE WHEN jsonb_array_length(f->'appliesTo') = 0 THEN to_jsonb('all'::text) ELSE f->'appliesTo' END
                ELSE to_jsonb('all'::text)
            END,
            'amount',    COALESCE(NULLIF(f->>'amount', '')::numeric, 0),
            'unitType',  COALESCE(NULLIF(f->>'unitType', ''), 'per_stall'),
            'dueDate',   NULLIF(f->>'dueDate', ''),
            'lateFee',   COALESCE(NULLIF(f->>'lateFee', '')::numeric, 0)
        )), '[]'::jsonb)
        FROM svc, jsonb_array_elements(COALESCE(s->'extraStallFees', '[]'::jsonb)) f
    )
);
$$;

REVOKE ALL ON FUNCTION public.public_show_inventory(jsonb) FROM PUBLIC;
