-- Required documents (Robert, 2026-11-19): a third paper (Registration Papers) and a
-- per-show choice of which papers are asked for.
--
-- Run AFTER 20261120120000_horse_docs_edit_horses.sql. Safe to run twice.
--
--   * The show keeps its choice at project_data.stallingService.requiredDocs
--     ({ certificate, coggins, registration } booleans, set in Housing -> Fees).
--     A show that never set it asks for Certificate + Coggins, as before.
--   * The exhibitor's page gets that choice as `required`, plus every horse's
--     `registration` paper, so it draws only the slots the show wants.

-- The show's choice, with defaults filled in.
CREATE OR REPLACE FUNCTION public._horse_doc_required(p_data jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT jsonb_build_object(
        'certificate',  CASE WHEN jsonb_typeof(p_data->'stallingService'->'requiredDocs'->'certificate') = 'boolean'
                             THEN (p_data->'stallingService'->'requiredDocs'->>'certificate')::boolean ELSE true END,
        'coggins',      CASE WHEN jsonb_typeof(p_data->'stallingService'->'requiredDocs'->'coggins') = 'boolean'
                             THEN (p_data->'stallingService'->'requiredDocs'->>'coggins')::boolean ELSE true END,
        'registration', CASE WHEN jsonb_typeof(p_data->'stallingService'->'requiredDocs'->'registration') = 'boolean'
                             THEN (p_data->'stallingService'->'requiredDocs'->>'registration')::boolean ELSE false END
    );
$$;

-- What the exhibitor's page draws, now with the registration paper and the show's choice.
CREATE OR REPLACE FUNCTION public._horse_doc_view(p_booking jsonb, p_show_name text, p_required jsonb)
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
    k        text;
    v_entry  jsonb;
BEGIN
    FOR i IN 0 .. jsonb_array_length(v_slots) - 1 LOOP
        v_doc := v_slots->i;
        v_entry := jsonb_build_object('index', i, 'name', COALESCE(v_doc->>'name', ''), 'nameLocked', false);
        FOREACH k IN ARRAY ARRAY['certificate', 'coggins', 'registration'] LOOP
            v_entry := v_entry || jsonb_build_object(k,
                CASE WHEN COALESCE(v_doc->k->>'file', v_doc->k->>'path', '') <> ''
                     THEN jsonb_build_object('name', v_doc->k->>'name', 'uploadedAt', v_doc->k->>'uploadedAt')
                     ELSE NULL END);
        END LOOP;
        v_horses := v_horses || jsonb_build_array(v_entry);
    END LOOP;

    RETURN jsonb_build_object(
        'showName',  p_show_name,
        'exhibitor', COALESCE(NULLIF(p_booking->>'exhibitorName', ''), 'Exhibitor'),
        'orderRef',  upper(left(COALESCE(p_booking->>'id', ''), 8)),
        'required',  COALESCE(p_required, public._horse_doc_required('{}'::jsonb)),
        'horses',    v_horses
    );
END;
$$;

-- The old two-argument call keeps working (the horse-edit functions use it); the page
-- keeps the `required` it was given at load, so those replies need not repeat it.
CREATE OR REPLACE FUNCTION public._horse_doc_view(p_booking jsonb, p_show_name text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT public._horse_doc_view(p_booking, p_show_name, NULL::jsonb);
$$;

REVOKE ALL ON FUNCTION public._horse_doc_required(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._horse_doc_view(jsonb, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._horse_doc_view(jsonb, text) FROM PUBLIC;

-- ── read, and record a paper (now also 'registration') ───────────────────────

CREATE OR REPLACE FUNCTION public.get_horse_doc_request(
    p_show_id    uuid,
    p_booking_id text,
    p_secret     text
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
        RAISE EXCEPTION 'Invalid link' USING ERRCODE = '22023';
    END IF;

    SELECT project_data, project_name INTO v_data, v_name
      FROM public.projects
     WHERE id = p_show_id;

    SELECT elem INTO v_booking
      FROM jsonb_array_elements(COALESCE(v_data->'stallingService'->'bookings', '[]'::jsonb)) AS elem
     WHERE elem->>'id' = p_booking_id
     LIMIT 1;

    IF v_booking IS NULL
       OR COALESCE(v_data->'horseDocSecrets'->>p_booking_id, '') = ''
       OR v_data->'horseDocSecrets'->>p_booking_id <> p_secret
       OR v_booking->>'status' = 'cancelled' THEN
        RAISE EXCEPTION 'Invalid link' USING ERRCODE = '22023';
    END IF;

    RETURN public._horse_doc_view(v_booking, v_name, public._horse_doc_required(v_data));
END;
$$;

-- ── 2. Record an uploaded paper on a horse ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.add_horse_doc(
    p_show_id    uuid,
    p_booking_id text,
    p_secret     text,
    p_index      int,
    p_kind       text,
    p_file       text,
    p_orig_name  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_data     jsonb;
    v_name     text;
    v_bookings jsonb;
    v_booking  jsonb;
    v_index    int;
    v_docs     jsonb;
    v_entry    jsonb;
    v_log      jsonb;
    v_label    text;
    v_horse    text;
    v_now      text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
BEGIN
    IF p_show_id IS NULL OR COALESCE(p_booking_id, '') = '' OR COALESCE(p_secret, '') = ''
       OR COALESCE(p_file, '') !~ '^[A-Za-z0-9._-]{1,80}$'
       OR p_kind NOT IN ('certificate', 'coggins', 'registration')
       OR p_index IS NULL OR p_index < 0 OR p_index > 49 THEN
        RAISE EXCEPTION 'Invalid link' USING ERRCODE = '22023';
    END IF;

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
       OR COALESCE(v_data->'horseDocSecrets'->>p_booking_id, '') = ''
       OR v_data->'horseDocSecrets'->>p_booking_id <> p_secret
       OR v_booking->>'status' = 'cancelled' THEN
        RAISE EXCEPTION 'Invalid link' USING ERRCODE = '22023';
    END IF;

    IF p_index >= public._horse_doc_slot_count(v_booking) THEN
        RAISE EXCEPTION 'No such horse on this booking' USING ERRCODE = '22023';
    END IF;

    -- Only a file that really sits in this order's folder can be attached.
    IF NOT EXISTS (
        SELECT 1 FROM storage.objects
         WHERE bucket_id = 'horse-health-docs'
           AND name = p_show_id::text || '/' || p_booking_id || '/' || p_secret || '/' || p_file
    ) THEN
        RAISE EXCEPTION 'File not found' USING ERRCODE = '22023';
    END IF;

    v_docs := CASE WHEN jsonb_typeof(v_booking->'horseDocs') = 'array' THEN v_booking->'horseDocs' ELSE '[]'::jsonb END;
    WHILE jsonb_array_length(v_docs) <= p_index LOOP
        v_docs := v_docs || jsonb_build_array('{}'::jsonb);
    END LOOP;

    v_entry := COALESCE(v_docs->p_index, '{}'::jsonb) || jsonb_build_object(
        p_kind, jsonb_build_object(
            'file', p_file,
            'name', left(regexp_replace(COALESCE(p_orig_name, ''), '[[:cntrl:]]', ' ', 'g'), 120),
            'uploadedAt', v_now,
            'viaLink', true
        )
    );
    v_docs := jsonb_set(v_docs, ARRAY[p_index::text], v_entry, false);

    v_label := CASE p_kind WHEN 'coggins' THEN 'Coggins' WHEN 'registration' THEN 'Registration Papers' ELSE 'Health Certificate' END;
    v_horse := COALESCE(NULLIF(public._horse_doc_names(v_booking)->>p_index, ''), NULLIF(v_entry->>'name', ''), 'Horse ' || (p_index + 1));
    v_log := COALESCE(v_booking->'activityLog', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'at', v_now,
        'message', v_label || ' uploaded for ' || v_horse || ' (exhibitor link)'
    ));

    v_booking := v_booking || jsonb_build_object('horseDocs', v_docs, 'activityLog', v_log);

    v_data := jsonb_set(
        v_data,
        '{stallingService,bookings}',
        jsonb_set(v_bookings, ARRAY[v_index::text], v_booking, false),
        true
    );

    UPDATE public.projects SET project_data = v_data WHERE id = p_show_id;

    RETURN public._horse_doc_view(v_booking, v_name, public._horse_doc_required(v_data));
END;
$$;


REVOKE ALL ON FUNCTION public.get_horse_doc_request(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_horse_doc(uuid, text, text, int, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_horse_doc_request(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_horse_doc(uuid, text, text, int, text, text, text) TO anon, authenticated;
