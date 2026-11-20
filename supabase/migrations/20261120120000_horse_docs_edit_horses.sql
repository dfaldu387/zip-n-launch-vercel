-- Exhibitor link: rename, add and remove horses (Robert, 2026-11-19).
--
-- Run AFTER 20261119130000_horse_docs_public_upload.sql. Safe to run twice.
--
-- A booking keeps its horses in three fields that must always agree:
--   horseCount  (number)
--   horseNames  (non-blank names, in order)
--   horseDocs   (one entry per horse: { name, certificate?, coggins? })
-- Every edit below rewrites all three together, under the same row lock and the same
-- secret check as the upload functions. A name saved on a horseDocs entry (even an empty
-- one) is the horse's name; horseNames is only the fallback for bookings never edited.

-- ── helpers (not callable by the public) ─────────────────────────────────────

-- The exact horse list: one { name, ...papers } per horse.
CREATE OR REPLACE FUNCTION public._horse_doc_slots(p_booking jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    v_names jsonb := public._horse_doc_names(p_booking);
    v_docs  jsonb := CASE WHEN jsonb_typeof(p_booking->'horseDocs') = 'array' THEN p_booking->'horseDocs' ELSE '[]'::jsonb END;
    v_count int   := public._horse_doc_slot_count(p_booking);
    v_out   jsonb := '[]'::jsonb;
    i       int;
    v_doc   jsonb;
    v_name  text;
BEGIN
    FOR i IN 0 .. v_count - 1 LOOP
        v_doc := COALESCE(v_docs->i, '{}'::jsonb);
        IF jsonb_typeof(v_doc) <> 'object' THEN v_doc := '{}'::jsonb; END IF;
        v_name := CASE WHEN jsonb_typeof(v_doc->'name') = 'string' THEN v_doc->>'name'
                       ELSE COALESCE(v_names->>i, '') END;
        v_out := v_out || jsonb_build_array(v_doc || jsonb_build_object('name', v_name));
    END LOOP;
    RETURN v_out;
END;
$$;

-- The booking with its three horse fields rebuilt from a slot list.
CREATE OR REPLACE FUNCTION public._horse_doc_apply(p_booking jsonb, p_slots jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT p_booking || jsonb_build_object(
        'horseCount', jsonb_array_length(p_slots),
        'horseDocs',  p_slots,
        'horseNames', COALESCE((SELECT jsonb_agg(s->>'name' ORDER BY ord)
                                  FROM jsonb_array_elements(p_slots) WITH ORDINALITY AS t(s, ord)
                                 WHERE btrim(COALESCE(s->>'name', '')) <> ''), '[]'::jsonb)
    );
$$;

-- What the exhibitor's page draws (now from the exact list, so edited names show correctly).
CREATE OR REPLACE FUNCTION public._horse_doc_view(p_booking jsonb, p_show_name text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_slots  jsonb := public._horse_doc_slots(p_booking);
    v_horses jsonb := '[]'::jsonb;
    i        int;
    v_doc    jsonb;
BEGIN
    FOR i IN 0 .. jsonb_array_length(v_slots) - 1 LOOP
        v_doc := v_slots->i;
        v_horses := v_horses || jsonb_build_array(jsonb_build_object(
            'index',        i,
            'name',         COALESCE(v_doc->>'name', ''),
            'nameLocked',   false,
            'certificate',  CASE WHEN COALESCE(v_doc->'certificate'->>'file', v_doc->'certificate'->>'path', '') <> ''
                                 THEN jsonb_build_object('name', v_doc->'certificate'->>'name', 'uploadedAt', v_doc->'certificate'->>'uploadedAt')
                                 ELSE NULL END,
            'coggins',      CASE WHEN COALESCE(v_doc->'coggins'->>'file', v_doc->'coggins'->>'path', '') <> ''
                                 THEN jsonb_build_object('name', v_doc->'coggins'->>'name', 'uploadedAt', v_doc->'coggins'->>'uploadedAt')
                                 ELSE NULL END
        ));
    END LOOP;

    RETURN jsonb_build_object(
        'showName',  p_show_name,
        'exhibitor', COALESCE(NULLIF(p_booking->>'exhibitorName', ''), 'Exhibitor'),
        'orderRef',  upper(left(COALESCE(p_booking->>'id', ''), 8)),
        'horses',    v_horses
    );
END;
$$;

REVOKE ALL ON FUNCTION public._horse_doc_slots(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._horse_doc_apply(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._horse_doc_view(jsonb, text) FROM PUBLIC;

-- ── the one place an edit happens ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._horse_doc_edit(
    p_show_id    uuid,
    p_booking_id text,
    p_secret     text,
    p_action     text,      -- 'rename' | 'add' | 'remove'
    p_index      int,
    p_name       text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_data     jsonb;
    v_pname    text;
    v_bookings jsonb;
    v_booking  jsonb;
    v_index    int;
    v_slots    jsonb;
    v_horse    text;
    v_old      text;
    v_msg      text;
    v_now      text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
BEGIN
    IF p_show_id IS NULL OR COALESCE(p_booking_id, '') = '' OR COALESCE(p_secret, '') = ''
       OR p_action NOT IN ('rename', 'add', 'remove') THEN
        RAISE EXCEPTION 'Invalid link' USING ERRCODE = '22023';
    END IF;

    v_horse := trim(regexp_replace(COALESCE(p_name, ''), '[[:cntrl:]]', ' ', 'g'));
    IF char_length(v_horse) > 60 THEN
        RAISE EXCEPTION 'That name is too long' USING ERRCODE = '22023';
    END IF;

    SELECT project_data, project_name INTO v_data, v_pname
      FROM public.projects
     WHERE id = p_show_id
       FOR UPDATE;

    v_bookings := COALESCE(v_data->'stallingService'->'bookings', '[]'::jsonb);

    SELECT ord - 1, elem INTO v_index, v_booking
      FROM jsonb_array_elements(v_bookings) WITH ORDINALITY AS t(elem, ord)
     WHERE elem->>'id' = p_booking_id
     LIMIT 1;

    IF v_booking IS NULL
       OR COALESCE(v_data->'horseDocSecrets'->>p_booking_id, '') = ''
       OR v_data->'horseDocSecrets'->>p_booking_id <> p_secret
       OR v_booking->>'status' = 'cancelled' THEN
        RAISE EXCEPTION 'Invalid link' USING ERRCODE = '22023';
    END IF;

    v_slots := public._horse_doc_slots(v_booking);

    IF p_action = 'add' THEN
        IF v_horse = '' THEN
            RAISE EXCEPTION 'Please type the horse''s name' USING ERRCODE = '22023';
        END IF;
        IF jsonb_array_length(v_slots) >= 50 THEN
            RAISE EXCEPTION 'A booking can have up to 50 horses' USING ERRCODE = '22023';
        END IF;
        v_slots := v_slots || jsonb_build_array(jsonb_build_object('name', v_horse));
        v_msg := 'Horse added: ' || v_horse || ' (exhibitor link)';
    ELSE
        IF p_index IS NULL OR p_index < 0 OR p_index >= jsonb_array_length(v_slots) THEN
            RAISE EXCEPTION 'No such horse on this booking' USING ERRCODE = '22023';
        END IF;
        v_old := COALESCE(NULLIF(v_slots->p_index->>'name', ''), 'Horse ' || (p_index + 1));

        IF p_action = 'rename' THEN
            IF v_horse = '' THEN
                RAISE EXCEPTION 'Please type the horse''s name' USING ERRCODE = '22023';
            END IF;
            IF COALESCE(v_slots->p_index->>'name', '') = v_horse THEN
                RETURN public._horse_doc_view(v_booking, v_pname);
            END IF;
            v_slots := jsonb_set(v_slots, ARRAY[p_index::text, 'name'], to_jsonb(v_horse), false);
            v_msg := 'Horse renamed: ' || v_old || ' to ' || v_horse || ' (exhibitor link)';
        ELSE
            IF jsonb_array_length(v_slots) <= 1 THEN
                RAISE EXCEPTION 'A booking needs at least one horse' USING ERRCODE = '22023';
            END IF;
            SELECT COALESCE(jsonb_agg(s ORDER BY ord), '[]'::jsonb) INTO v_slots
              FROM jsonb_array_elements(v_slots) WITH ORDINALITY AS t(s, ord)
             WHERE ord - 1 <> p_index;
            v_msg := 'Horse removed: ' || v_old || ' (exhibitor link)';
        END IF;
    END IF;

    v_booking := public._horse_doc_apply(v_booking, v_slots) || jsonb_build_object(
        'activityLog', COALESCE(v_booking->'activityLog', '[]'::jsonb)
                       || jsonb_build_array(jsonb_build_object('at', v_now, 'message', v_msg))
    );

    v_data := jsonb_set(
        v_data,
        '{stallingService,bookings}',
        jsonb_set(v_bookings, ARRAY[v_index::text], v_booking, false),
        true
    );

    UPDATE public.projects SET project_data = v_data WHERE id = p_show_id;

    RETURN public._horse_doc_view(v_booking, v_pname);
END;
$$;

REVOKE ALL ON FUNCTION public._horse_doc_edit(uuid, text, text, text, int, text) FROM PUBLIC;

-- ── the three calls the exhibitor's page makes ───────────────────────────────

-- Same name and arguments as before; it now renames ANY horse (it used to refuse a name
-- the exhibitor had typed at booking time).
CREATE OR REPLACE FUNCTION public.set_horse_doc_name(
    p_show_id    uuid,
    p_booking_id text,
    p_secret     text,
    p_index      int,
    p_horse_name text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public._horse_doc_edit(p_show_id, p_booking_id, p_secret, 'rename', p_index, p_horse_name);
$$;

CREATE OR REPLACE FUNCTION public.add_horse_doc_horse(
    p_show_id    uuid,
    p_booking_id text,
    p_secret     text,
    p_horse_name text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public._horse_doc_edit(p_show_id, p_booking_id, p_secret, 'add', NULL, p_horse_name);
$$;

CREATE OR REPLACE FUNCTION public.remove_horse_doc_horse(
    p_show_id    uuid,
    p_booking_id text,
    p_secret     text,
    p_index      int
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public._horse_doc_edit(p_show_id, p_booking_id, p_secret, 'remove', p_index, NULL);
$$;

REVOKE ALL ON FUNCTION public.set_horse_doc_name(uuid, text, text, int, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_horse_doc_horse(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_horse_doc_horse(uuid, text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_horse_doc_name(uuid, text, text, int, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_horse_doc_horse(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_horse_doc_horse(uuid, text, text, int) TO anon, authenticated;
