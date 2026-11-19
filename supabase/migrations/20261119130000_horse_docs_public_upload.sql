-- Horse health papers: the exhibitor's own upload link (Robert, 2026-11-18).
--
-- The manager copies (Phase B) or emails (Phase C) a private link to each exhibitor.
-- On their phone, with no login, they type the horse names and upload a Health
-- Certificate (CVI) and a Coggins for each horse. Same idea as the delivery QR links
-- (20261031120000_delivery_qr_rpcs.sql / 20261031140000_delivery_photos.sql):
--
--   * The link is the credential: project_data.horseDocSecrets[bookingId] is 32 random hex
--     characters. It sits in its own map on the show, NOT on the booking, because the
--     customer booking page returns the whole booking record.
--   * Files go to the PRIVATE bucket 'horse-health-docs' (created in
--     20261119120000_horse_health_docs_bucket.sql), in a folder named after the order:
--
--         horse-health-docs / {showId} / {bookingId} / {secret} / {file}
--
--     The upload policy below lets anyone add a file ONLY when that folder's secret
--     matches the show's stored secret. Reading stays signed-in staff only.
--   * The booking stores just the FILE NAME (horseDocs[i].certificate.file), never the
--     folder, so the secret is never copied onto the booking.
--   * All writes go through SECURITY DEFINER functions that lock the show row
--     (SELECT ... FOR UPDATE), so a Housing save at the same moment is not overwritten.
--     A wrong or missing secret gets one generic error, so nothing can be probed.

-- ── helpers (not callable by the public) ─────────────────────────────────────

-- The horse names on a booking, blanks removed (same as the Master List).
CREATE OR REPLACE FUNCTION public._horse_doc_names(p_booking jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN jsonb_typeof(p_booking->'horseNames') = 'array' THEN
            COALESCE((SELECT jsonb_agg(e)
                        FROM jsonb_array_elements(p_booking->'horseNames') e
                       WHERE jsonb_typeof(e) = 'string' AND btrim(e #>> '{}') <> ''), '[]'::jsonb)
        WHEN jsonb_typeof(p_booking->'horseNames') = 'string' THEN
            COALESCE((SELECT jsonb_agg(btrim(x))
                        FROM unnest(string_to_array(p_booking->>'horseNames', ',')) x
                       WHERE btrim(x) <> ''), '[]'::jsonb)
        WHEN COALESCE(p_booking->>'horseName', '') <> '' THEN jsonb_build_array(p_booking->>'horseName')
        ELSE '[]'::jsonb
    END;
$$;

-- How many horse slots a booking has: the count it states, or more if names / papers exist.
CREATE OR REPLACE FUNCTION public._horse_doc_slot_count(p_booking jsonb)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT GREATEST(
        CASE WHEN jsonb_typeof(p_booking->'horseCount') = 'number' THEN (p_booking->>'horseCount')::numeric::int ELSE 0 END,
        jsonb_array_length(public._horse_doc_names(p_booking)),
        CASE WHEN jsonb_typeof(p_booking->'horseDocs') = 'array' THEN jsonb_array_length(p_booking->'horseDocs') ELSE 0 END
    );
$$;

-- What the exhibitor's page draws.
CREATE OR REPLACE FUNCTION public._horse_doc_view(p_booking jsonb, p_show_name text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_names  jsonb := public._horse_doc_names(p_booking);
    v_docs   jsonb := CASE WHEN jsonb_typeof(p_booking->'horseDocs') = 'array' THEN p_booking->'horseDocs' ELSE '[]'::jsonb END;
    v_count  int   := public._horse_doc_slot_count(p_booking);
    v_horses jsonb := '[]'::jsonb;
    i        int;
    v_doc    jsonb;
    v_name   text;
BEGIN
    FOR i IN 0 .. v_count - 1 LOOP
        v_doc  := COALESCE(v_docs->i, '{}'::jsonb);
        v_name := COALESCE(NULLIF(v_names->>i, ''), NULLIF(v_doc->>'name', ''), '');
        v_horses := v_horses || jsonb_build_array(jsonb_build_object(
            'index',        i,
            'name',         v_name,
            'nameLocked',   COALESCE(v_names->>i, '') <> '',
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

REVOKE ALL ON FUNCTION public._horse_doc_names(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._horse_doc_slot_count(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._horse_doc_view(jsonb, text) FROM PUBLIC;

-- ── Is this upload path backed by a valid horse-docs secret? ─────────────────

CREATE OR REPLACE FUNCTION public.horse_doc_upload_allowed(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_parts  text[] := string_to_array(COALESCE(p_name, ''), '/');
    v_show   uuid;
    v_secret text;
BEGIN
    IF COALESCE(array_length(v_parts, 1), 0) <> 4 THEN
        RETURN false;
    END IF;
    BEGIN
        v_show := v_parts[1]::uuid;
    EXCEPTION WHEN others THEN
        RETURN false;
    END;
    IF v_parts[4] !~ '^[A-Za-z0-9._-]{1,80}$' THEN
        RETURN false;
    END IF;

    SELECT project_data->'horseDocSecrets'->>v_parts[2] INTO v_secret
      FROM public.projects
     WHERE id = v_show;

    RETURN COALESCE(v_secret, '') <> '' AND v_secret = v_parts[3];
END;
$$;

REVOKE ALL ON FUNCTION public.horse_doc_upload_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.horse_doc_upload_allowed(text) TO anon, authenticated;

drop policy if exists "horse-health-docs upload with secret link" on storage.objects;
create policy "horse-health-docs upload with secret link"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'horse-health-docs' and public.horse_doc_upload_allowed(name));

-- ── 1. Read what the exhibitor's page needs ──────────────────────────────────

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

    RETURN public._horse_doc_view(v_booking, v_name);
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
       OR p_kind NOT IN ('certificate', 'coggins')
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

    v_label := CASE p_kind WHEN 'coggins' THEN 'Coggins' ELSE 'Health Certificate' END;
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

    RETURN public._horse_doc_view(v_booking, v_name);
END;
$$;

-- ── 3. Type a horse's name (only when the booking has none for that horse) ───

CREATE OR REPLACE FUNCTION public.set_horse_doc_name(
    p_show_id    uuid,
    p_booking_id text,
    p_secret     text,
    p_index      int,
    p_horse_name text
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
    v_horse    text;
BEGIN
    IF p_show_id IS NULL OR COALESCE(p_booking_id, '') = '' OR COALESCE(p_secret, '') = ''
       OR p_index IS NULL OR p_index < 0 OR p_index > 49 THEN
        RAISE EXCEPTION 'Invalid link' USING ERRCODE = '22023';
    END IF;

    v_horse := trim(regexp_replace(COALESCE(p_horse_name, ''), '[[:cntrl:]]', ' ', 'g'));
    IF char_length(v_horse) > 60 THEN
        RAISE EXCEPTION 'That name is too long' USING ERRCODE = '22023';
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

    -- A name the exhibitor gave at booking time is theirs; it is not changed here.
    IF COALESCE(public._horse_doc_names(v_booking)->>p_index, '') <> '' THEN
        RETURN public._horse_doc_view(v_booking, v_name);
    END IF;

    v_docs := CASE WHEN jsonb_typeof(v_booking->'horseDocs') = 'array' THEN v_booking->'horseDocs' ELSE '[]'::jsonb END;
    WHILE jsonb_array_length(v_docs) <= p_index LOOP
        v_docs := v_docs || jsonb_build_array('{}'::jsonb);
    END LOOP;
    v_docs := jsonb_set(v_docs, ARRAY[p_index::text],
                        COALESCE(v_docs->p_index, '{}'::jsonb) || jsonb_build_object('name', v_horse), false);

    v_booking := v_booking || jsonb_build_object('horseDocs', v_docs);

    v_data := jsonb_set(
        v_data,
        '{stallingService,bookings}',
        jsonb_set(v_bookings, ARRAY[v_index::text], v_booking, false),
        true
    );

    UPDATE public.projects SET project_data = v_data WHERE id = p_show_id;

    RETURN public._horse_doc_view(v_booking, v_name);
END;
$$;

REVOKE ALL ON FUNCTION public.get_horse_doc_request(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_horse_doc(uuid, text, text, int, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_horse_doc_name(uuid, text, text, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_horse_doc_request(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_horse_doc(uuid, text, text, int, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_horse_doc_name(uuid, text, text, int, text) TO anon, authenticated;
