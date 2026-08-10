-- Public show data, without handing out the whole show record.
--
-- The public pages (/book-stalls, /show/:id, /show/:id/book, order-supplies) all
-- read projects.project_data directly, with no login. Verified on production:
-- an anonymous request returns every exhibitor booking on the show — names,
-- emails, phones, private notes, amounts — plus fees, showBill, staff,
-- officials, sponsors and the full schedule. The pages need none of that; they
-- need inventory, prices and how much is left.
--
-- These functions return exactly that. Availability is counted here instead of
-- in the browser, which is also what a later server-side oversell check needs.
--
-- Stage A: the functions only. Nothing calls them yet and no policy changes.

-- ── Inventory + availability for one stallingService blob ────────────────────
-- Mirrors the maths the booking page does today (PublicBookingPage.jsx:
-- stallsTaken / spotsBooked / suppliesSold):
--   stalls taken = stalls pinned to a live booking
--                + what a live booking paid for but has not been given yet
--   rv / support / supply taken = quantity ordered on live bookings
-- Cancelled bookings never count, and a stall still pinned to a cancelled
-- booking is free.
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
            'earlyArrivalFeePerDay', COALESCE(NULLIF(rv->>'earlyArrivalFeePerDay', '')::numeric, 0),
            'lateDepartureFeePerDay', COALESCE(NULLIF(rv->>'lateDepartureFeePerDay', '')::numeric, 0),
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
                                 AND q.ref_id = COALESCE(NULLIF(su->>'id', ''), su->>'name')), 0)
        )), '[]'::jsonb)
        FROM svc, jsonb_array_elements(COALESCE(s->'supplies', '[]'::jsonb)) su
    )
);
$$;

-- ── One show, safe to hand to an anonymous browser ──────────────────────────
CREATE OR REPLACE FUNCTION public.get_public_show(p_show_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name text;
    v_pd   jsonb;
    v_svc  jsonb;
    v_det  jsonb;
    v_gen  jsonb;
BEGIN
    IF p_show_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT p.project_name, p.project_data
      INTO v_name, v_pd
      FROM public.projects p
     WHERE p.id = p_show_id;

    IF v_pd IS NULL THEN
        RETURN NULL;
    END IF;

    v_svc := COALESCE(v_pd->'stallingService', '{}'::jsonb);
    v_det := COALESCE(v_pd->'showDetails', '{}'::jsonb);
    v_gen := COALESCE(v_det->'general', '{}'::jsonb);

    RETURN jsonb_build_object(
        'id',   p_show_id,
        'name', v_name,

        -- Draft and Locked both mean "not taking bookings".
        'housingStatus', COALESCE(
            NULLIF(v_pd->'moduleStatuses'->>'housing', ''),
            NULLIF(v_svc->>'publishStatus', ''),
            'draft'),
        'billingMode', COALESCE(NULLIF(v_svc->>'billingMode', ''), 'invoice_after'),

        'showWindow', jsonb_build_object(
            'start', COALESCE(v_gen->>'startDate', v_pd->>'startDate'),
            'end',   COALESCE(v_gen->>'endDate',   v_pd->>'endDate')),

        -- Organizer's move-in / move-out limits, falling back to the show dates.
        'bookWindow', jsonb_build_object(
            'start', COALESCE(NULLIF(v_svc->>'moveInDate', ''),  v_gen->>'startDate', v_pd->>'startDate'),
            'end',   COALESCE(NULLIF(v_svc->>'moveOutDate', ''), v_gen->>'endDate',   v_pd->>'endDate')),

        'inventory', public.public_show_inventory(v_svc),

        -- Only the sections the public show page already displays. Everything
        -- else in project_data — bookings, staff, showBill, sponsors, schedule
        -- — is deliberately left out.
        'details', jsonb_build_object(
            'general',    v_gen,
            'venue',      COALESCE(v_det->'venue',      '{}'::jsonb),
            -- Older shows built in the flat wizard keep the venue at the top
            -- level; the public page falls back to these.
            'venueName',    v_pd->>'venueName',
            'venueAddress', v_pd->>'venueAddress',
            'officials',  COALESCE(v_det->'officials',  '{}'::jsonb),
            'fees',       COALESCE(v_det->'fees',       '[]'::jsonb),
            'entry',      COALESCE(v_det->'entry',      '{}'::jsonb),
            'scheduling', COALESCE(v_det->'scheduling', '{}'::jsonb),
            'awards',     COALESCE(v_det->'awards',     '{}'::jsonb)),

        'marketing', jsonb_build_object(
            'facebook',  v_pd->'marketing'->>'facebook',
            'instagram', v_pd->'marketing'->>'instagram',
            'youtube',   v_pd->'marketing'->>'youtube')
    );
END;
$$;

-- ── The /book-stalls list ───────────────────────────────────────────────────
-- Same filter the page applies today: real shows, housing published, and there
-- is something to book. Returns card-sized summaries only.
CREATE OR REPLACE FUNCTION public.list_public_shows()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH shows AS (
    SELECT p.id,
           p.project_name,
           p.created_at,
           COALESCE(p.project_data, '{}'::jsonb) AS pd
    FROM public.projects p
    WHERE p.project_type = 'show'
),
prepped AS (
    SELECT s.id,
           s.project_name,
           s.created_at,
           s.pd,
           COALESCE(s.pd->'showDetails'->'general', '{}'::jsonb) AS gen,
           COALESCE(s.pd->'showDetails'->'venue',   '{}'::jsonb) AS venue,
           COALESCE(
               NULLIF(s.pd->'moduleStatuses'->>'housing', ''),
               NULLIF(s.pd->'stallingService'->>'publishStatus', ''),
               'draft') AS housing_status,
           public.public_show_inventory(COALESCE(s.pd->'stallingService', '{}'::jsonb)) AS inv
    FROM shows s
),
carded AS (
    SELECT p.*,
           (SELECT COALESCE(sum((b->>'total')::numeric), 0)
              FROM jsonb_array_elements(p.inv->'barns') b)                       AS total_stalls,
           (SELECT COALESCE(sum(GREATEST((b->>'total')::numeric - (b->>'taken')::numeric, 0)), 0)
              FROM jsonb_array_elements(p.inv->'barns') b)                       AS stalls_available,
           (SELECT COALESCE(sum((r->>'total')::numeric), 0)
              FROM jsonb_array_elements(p.inv->'rvAreas') r)                     AS total_rv,
           (SELECT COALESCE(sum((sp->>'total')::numeric), 0)
              FROM jsonb_array_elements(p.inv->'supportSpaces') sp)              AS total_support,
           jsonb_array_length(p.inv->'supplies')                                 AS supplies_count,
           (SELECT min(x) FROM (
                SELECT (b->>'pricePerNight')::numeric AS x
                  FROM jsonb_array_elements(p.inv->'barns') b
                 WHERE (b->>'pricePerNight')::numeric > 0
                UNION ALL
                SELECT (r->>'pricePerNight')::numeric
                  FROM jsonb_array_elements(p.inv->'rvAreas') r
                 WHERE (r->>'pricePerNight')::numeric > 0
            ) prices)                                                            AS starting_price
    FROM prepped p
)
SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',                c.id,
    'name',              c.project_name,
    'createdAt',         c.created_at,
    -- Shows built in the flat wizard keep dates and venue at the top level of
    -- project_data; newer ones nest them under showDetails. Reading only the
    -- nested copy made every one of those shows say "Dates TBA".
    'startDate',         COALESCE(NULLIF(c.gen->>'startDate', ''), c.pd->>'startDate'),
    'endDate',           COALESCE(NULLIF(c.gen->>'endDate', ''),   c.pd->>'endDate'),
    'eventHost',         COALESCE(NULLIF(c.gen->>'eventHost', ''), c.pd->>'eventHost'),
    'facilityName',      COALESCE(NULLIF(c.venue->>'facilityName', ''), c.pd->>'venueName'),
    'address',           COALESCE(NULLIF(c.venue->>'address', ''),      c.pd->>'venueAddress'),
    'totalStalls',       c.total_stalls,
    'stallsAvailable',   c.stalls_available,
    'totalRvSpots',      c.total_rv,
    'totalSupportUnits', c.total_support,
    'suppliesCount',     c.supplies_count,
    'startingPrice',     COALESCE(c.starting_price, 0)
) ORDER BY c.created_at DESC), '[]'::jsonb)
FROM carded c
WHERE c.housing_status = 'published'
  AND (c.total_stalls + c.total_rv + c.total_support + c.supplies_count) > 0;
$$;

REVOKE ALL ON FUNCTION public.public_show_inventory(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_show(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_shows()   TO anon, authenticated;
