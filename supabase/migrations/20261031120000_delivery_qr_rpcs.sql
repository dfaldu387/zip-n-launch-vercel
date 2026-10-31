-- Delivery QR codes (Robert, 2026-10-30 "Streamlining Hay Delivery with QR Scans").
--
-- A driver holds the printed Load Sheet, scans the QR on one order line, and on
-- their own phone — no login, they may just be a facility employee — marks that
-- line Out for delivery / Delivered and types who they are. The name lands in the
-- booking's Activity Log ("Hay (Mixed) marked Delivered by John").
--
-- The link is the credential, same idea as the judge/upload request links (see
-- supabase/functions/_token/README.md): project_data.deliverySecrets[bookingId] is
-- 32 random hex characters created the first time that order is printed on a Load
-- Sheet, and the QR carries showId + bookingId + secret. The secrets sit in their
-- own map, NOT on the booking, because the customer booking-status page returns the
-- whole booking record and must never see them. A wrong or missing secret is refused with
-- one generic error, so nothing can be probed.
--
-- Why SQL functions and not a direct write: they run as SECURITY DEFINER, lock the
-- show row (SELECT ... FOR UPDATE, like record_stall_booking_payment) so a delivery
-- scan can't be overwritten by a save landing at the same moment, and they can only
-- move the supply lines named on the QR — forward through the pipeline, never back.

-- ── helpers (not callable by the public) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public._delivery_stage_index(p_status text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_status
        WHEN 'received'         THEN 1
        WHEN 'out_for_delivery' THEN 2
        WHEN 'delivered'        THEN 3
        ELSE 0
    END;
$$;

-- What the delivery page draws for one booking: who it is for, where it goes, and
-- the supply lines on this QR with their current status. Shares the stage fallback
-- with src/lib/supplyStatus.js getItemStatus (no per-item entry -> the order's
-- legacy fulfillmentStatus, 'fulfilled' meaning delivered).
CREATE OR REPLACE FUNCTION public._delivery_line_view(
    p_data      jsonb,
    p_booking   jsonb,
    p_show_name text,
    p_item_ids  text[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_items  jsonb;
    v_barn   text;
    v_stalls text;
    v_legacy text;
BEGIN
    v_legacy := CASE
        WHEN p_booking->>'fulfillmentStatus' = 'fulfilled' THEN 'delivered'
        ELSE COALESCE(NULLIF(p_booking->>'fulfillmentStatus', ''), 'new')
    END;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'refId', it->>'refId',
               'name',  trim(regexp_replace(COALESCE(it->>'name', 'Item'), '\s*×\s*\d+\s*$', '')),
               'qty',   COALESCE(NULLIF(it->>'qty', '')::numeric, 0),
               'unit',  COALESCE((
                            SELECT su->>'unit'
                              FROM jsonb_array_elements(COALESCE(p_data->'stallingService'->'supplies', '[]'::jsonb)) su
                             WHERE COALESCE(NULLIF(su->>'id', ''), su->>'name') = it->>'refId'
                                OR su->>'name' = it->>'refId'
                                OR su->>'name' = trim(regexp_replace(COALESCE(it->>'name', ''), '\s*×\s*\d+\s*$', ''))
                             LIMIT 1
                        ), 'unit'),
               'status', COALESCE(NULLIF(p_booking->'itemStatuses'->(it->>'refId')->>'status', ''), v_legacy),
               'deliveredBy', p_booking->'itemStatuses'->(it->>'refId')->>'deliveredBy',
               'deliveredAt', p_booking->'itemStatuses'->(it->>'refId')->'stageTimestamps'->>'delivered'
           ) ORDER BY ord), '[]'::jsonb)
      INTO v_items
      FROM jsonb_array_elements(COALESCE(p_booking->'items', '[]'::jsonb)) WITH ORDINALITY AS t(it, ord)
     WHERE it->>'type' = 'supply'
       AND COALESCE(it->>'refId', '') <> ''
       AND (p_item_ids IS NULL OR cardinality(p_item_ids) = 0 OR (it->>'refId') = ANY (p_item_ids));

    IF p_booking->>'orderType' = 'live-supply' THEN
        -- At-show reorders have no assigned stalls; the customer typed where they are.
        v_barn   := NULL;
        v_stalls := NULLIF(p_booking->>'stallNumber', '');
    ELSE
        SELECT string_agg(DISTINCT barn->>'name', ', '),
               string_agg(stall->>'number', ', ')
          INTO v_barn, v_stalls
          FROM jsonb_array_elements(COALESCE(p_data->'stallingService'->'barns', '[]'::jsonb)) AS barn,
               jsonb_array_elements(COALESCE(barn->'stalls', '[]'::jsonb)) AS stall
         WHERE stall->>'bookingId' = p_booking->>'id';
    END IF;

    RETURN jsonb_build_object(
        'showName',   p_show_name,
        'orderRef',   upper(left(COALESCE(p_booking->>'id', ''), 8)),
        'customer',   COALESCE(NULLIF(p_booking->>'exhibitorName', ''), 'Customer'),
        'stableWith', COALESCE(NULLIF(p_booking->>'stableWith', ''), NULLIF(p_booking->>'trainerName', ''), ''),
        'barn',       COALESCE(v_barn, ''),
        'stalls',     COALESCE(v_stalls, ''),
        'items',      v_items
    );
END;
$$;

REVOKE ALL ON FUNCTION public._delivery_stage_index(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._delivery_line_view(jsonb, jsonb, text, text[]) FROM PUBLIC;

-- ── 1. Read one delivery line ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_delivery_line(
    p_show_id    uuid,
    p_booking_id text,
    p_secret     text,
    p_item_ids   text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_data    jsonb;
    v_name    text;
    v_booking jsonb;
BEGIN
    IF p_show_id IS NULL OR COALESCE(p_booking_id, '') = '' OR COALESCE(p_secret, '') = '' THEN
        RAISE EXCEPTION 'Invalid delivery link' USING ERRCODE = '22023';
    END IF;

    SELECT project_data, project_name INTO v_data, v_name
      FROM public.projects
     WHERE id = p_show_id;

    SELECT elem INTO v_booking
      FROM jsonb_array_elements(COALESCE(v_data->'stallingService'->'bookings', '[]'::jsonb)) AS elem
     WHERE elem->>'id' = p_booking_id
     LIMIT 1;

    IF v_booking IS NULL
       OR COALESCE(v_data->'deliverySecrets'->>p_booking_id, '') = ''
       OR v_data->'deliverySecrets'->>p_booking_id <> p_secret
       OR v_booking->>'status' = 'cancelled' THEN
        RAISE EXCEPTION 'Invalid delivery link' USING ERRCODE = '22023';
    END IF;

    RETURN public._delivery_line_view(v_data, v_booking, v_name, p_item_ids);
END;
$$;

-- ── 2. Move the lines on this QR forward, and record who did it ──────────────

CREATE OR REPLACE FUNCTION public.set_delivery_line_status(
    p_show_id      uuid,
    p_booking_id   text,
    p_secret       text,
    p_item_ids     text[],
    p_status       text,
    p_delivered_by text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_data      jsonb;
    v_name      text;
    v_bookings  jsonb;
    v_booking   jsonb;
    v_index     int;
    v_item      jsonb;
    v_ref       text;
    v_cur       text;
    v_legacy    text;
    v_stamps    jsonb;
    v_statuses  jsonb;
    v_log       jsonb;
    v_now       text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    v_who       text;
    v_label     text;
    v_all_done  boolean;
BEGIN
    IF p_show_id IS NULL OR COALESCE(p_booking_id, '') = '' OR COALESCE(p_secret, '') = '' THEN
        RAISE EXCEPTION 'Invalid delivery link' USING ERRCODE = '22023';
    END IF;
    IF p_status NOT IN ('out_for_delivery', 'delivered') THEN
        RAISE EXCEPTION 'Status not allowed' USING ERRCODE = '22023';
    END IF;

    -- Plain text only, 2-60 characters: this lands in the Activity Log.
    v_who := trim(regexp_replace(COALESCE(p_delivered_by, ''), '[[:cntrl:]]', ' ', 'g'));
    IF char_length(v_who) < 2 OR char_length(v_who) > 60 THEN
        RAISE EXCEPTION 'Enter the name of the person delivering' USING ERRCODE = '22023';
    END IF;

    -- The lock: a second scan (or a save on the Housing page) waits for this one.
    SELECT project_data, project_name INTO v_data, v_name
      FROM public.projects
     WHERE id = p_show_id
       FOR UPDATE;

    v_bookings := COALESCE(v_data->'stallingService'->'bookings', '[]'::jsonb);

    SELECT ord - 1, elem INTO v_index, v_booking
      FROM jsonb_array_elements(v_bookings) WITH ORDINALITY AS t(elem, ord)
     WHERE elem->>'id' = p_booking_id
     LIMIT 1;

    IF v_booking IS NULL
       OR COALESCE(v_data->'deliverySecrets'->>p_booking_id, '') = ''
       OR v_data->'deliverySecrets'->>p_booking_id <> p_secret
       OR v_booking->>'status' = 'cancelled' THEN
        RAISE EXCEPTION 'Invalid delivery link' USING ERRCODE = '22023';
    END IF;

    v_label := CASE p_status WHEN 'delivered' THEN 'Delivered' ELSE 'Out for delivery' END;
    v_legacy := CASE
        WHEN v_booking->>'fulfillmentStatus' = 'fulfilled' THEN 'delivered'
        ELSE COALESCE(NULLIF(v_booking->>'fulfillmentStatus', ''), 'new')
    END;
    v_statuses := COALESCE(v_booking->'itemStatuses', '{}'::jsonb);
    v_log      := COALESCE(v_booking->'activityLog', '[]'::jsonb);

    FOR v_item IN
        SELECT it
          FROM jsonb_array_elements(COALESCE(v_booking->'items', '[]'::jsonb)) AS it
         WHERE it->>'type' = 'supply'
           AND COALESCE(it->>'refId', '') <> ''
           AND (p_item_ids IS NULL OR cardinality(p_item_ids) = 0 OR (it->>'refId') = ANY (p_item_ids))
    LOOP
        v_ref := v_item->>'refId';
        v_cur := COALESCE(NULLIF(v_statuses->v_ref->>'status', ''), v_legacy);

        -- Forward only: a repeat scan or a wrong tap never undoes a delivery.
        IF public._delivery_stage_index(p_status) <= public._delivery_stage_index(v_cur) THEN
            CONTINUE;
        END IF;

        v_stamps := COALESCE(v_statuses->v_ref->'stageTimestamps', '{}'::jsonb)
                    || jsonb_build_object(p_status, v_now);

        v_statuses := jsonb_set(
            v_statuses,
            ARRAY[v_ref],
            jsonb_build_object(
                'status', p_status,
                'stageTimestamps', v_stamps,
                'deliveredBy', CASE WHEN p_status = 'delivered' THEN v_who
                                    ELSE v_statuses->v_ref->>'deliveredBy' END,
                'handledBy', v_who
            ),
            true
        );

        v_log := v_log || jsonb_build_array(jsonb_build_object(
            'at', v_now,
            'message', trim(regexp_replace(COALESCE(v_item->>'name', 'Item'), '\s*×\s*\d+\s*$', ''))
                       || ' marked ' || v_label || ' by ' || v_who
        ));
    END LOOP;

    v_booking := v_booking || jsonb_build_object('itemStatuses', v_statuses, 'activityLog', v_log);

    -- Keep the order-level fields (read by older screens) in step once every
    -- supply line on the order is delivered.
    SELECT bool_and(COALESCE(NULLIF(v_statuses->(it->>'refId')->>'status', ''), v_legacy) = 'delivered')
      INTO v_all_done
      FROM jsonb_array_elements(COALESCE(v_booking->'items', '[]'::jsonb)) AS it
     WHERE it->>'type' = 'supply' AND COALESCE(it->>'refId', '') <> '';

    IF COALESCE(v_all_done, false) THEN
        v_booking := v_booking || jsonb_build_object('fulfillmentStatus', 'delivered', 'fulfilledAt', v_now);
    END IF;

    v_data := jsonb_set(
        v_data,
        '{stallingService,bookings}',
        jsonb_set(v_bookings, ARRAY[v_index::text], v_booking, false),
        true
    );

    UPDATE public.projects SET project_data = v_data WHERE id = p_show_id;

    RETURN public._delivery_line_view(v_data, v_booking, v_name, p_item_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_delivery_line(uuid, text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_delivery_line_status(uuid, text, text, text[], text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_delivery_line(uuid, text, text, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_delivery_line_status(uuid, text, text, text[], text, text) TO anon, authenticated;
