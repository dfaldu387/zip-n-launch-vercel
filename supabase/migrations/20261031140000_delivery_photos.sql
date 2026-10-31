-- Delivery photos (Robert, 2026-10-30): after a QR delivery the driver can take a
-- photo of the delivered items at the stalls, so "there is no question or
-- clarification in the future". The Master List shows who delivered and opens the
-- photos, each with its time stamp.
--
-- Same credential as the delivery QR itself (20261031120000_delivery_qr_rpcs.sql):
-- project_data.deliverySecrets[bookingId]. Photos go to a PRIVATE bucket, in a
-- folder named after the order:
--
--     delivery-photos / {showId} / {bookingId} / {secret} / {file}.jpg
--
-- * The upload policy lets anyone (the driver has no account) add a file ONLY when
--   that folder's secret matches the show's stored secret, so a stranger cannot fill
--   the bucket. Images only, 5 MB each.
-- * Reading is for signed-in staff only (they get a short-lived link from the app).
-- * The booking stores just the FILE NAME, never the folder: the customer booking
--   page returns the whole booking and must not see the secret that is in the path.

-- ── 1. The private bucket ────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('delivery-photos', 'delivery-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
   set public = false,
       file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. Is this upload path backed by a valid delivery secret? ────────────────

CREATE OR REPLACE FUNCTION public.delivery_photo_upload_allowed(p_name text)
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

    SELECT project_data->'deliverySecrets'->>v_parts[2] INTO v_secret
      FROM public.projects
     WHERE id = v_show;

    RETURN COALESCE(v_secret, '') <> '' AND v_secret = v_parts[3];
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_photo_upload_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_photo_upload_allowed(text) TO anon, authenticated;

drop policy if exists "delivery-photos upload with secret link" on storage.objects;
create policy "delivery-photos upload with secret link"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'delivery-photos' and public.delivery_photo_upload_allowed(name));

drop policy if exists "delivery-photos staff read" on storage.objects;
create policy "delivery-photos staff read"
  on storage.objects for select to authenticated
  using (bucket_id = 'delivery-photos');

-- ── 3. Record an uploaded photo on the order ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.add_delivery_photo(
    p_show_id    uuid,
    p_booking_id text,
    p_secret     text,
    p_item_ids   text[],
    p_file       text,
    p_by         text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_data     jsonb;
    v_bookings jsonb;
    v_booking  jsonb;
    v_index    int;
    v_photos   jsonb;
    v_log      jsonb;
    v_who      text;
    v_now      text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
BEGIN
    IF p_show_id IS NULL OR COALESCE(p_booking_id, '') = '' OR COALESCE(p_secret, '') = ''
       OR COALESCE(p_file, '') !~ '^[A-Za-z0-9._-]{1,80}$' THEN
        RAISE EXCEPTION 'Invalid delivery link' USING ERRCODE = '22023';
    END IF;

    v_who := trim(regexp_replace(COALESCE(p_by, ''), '[[:cntrl:]]', ' ', 'g'));
    IF char_length(v_who) < 2 OR char_length(v_who) > 60 THEN
        RAISE EXCEPTION 'Enter the name of the person delivering' USING ERRCODE = '22023';
    END IF;

    SELECT project_data INTO v_data
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

    -- Only a file that really sits in this order's folder can be attached.
    IF NOT EXISTS (
        SELECT 1 FROM storage.objects
         WHERE bucket_id = 'delivery-photos'
           AND name = p_show_id::text || '/' || p_booking_id || '/' || p_secret || '/' || p_file
    ) THEN
        RAISE EXCEPTION 'Photo not found' USING ERRCODE = '22023';
    END IF;

    v_photos := COALESCE(v_booking->'deliveryPhotos', '[]'::jsonb);
    IF jsonb_array_length(v_photos) >= 6 THEN
        RAISE EXCEPTION 'This order already has the maximum number of photos' USING ERRCODE = '22023';
    END IF;

    v_photos := v_photos || jsonb_build_array(jsonb_build_object(
        'file', p_file,
        'at', v_now,
        'by', v_who,
        'itemIds', to_jsonb(COALESCE(p_item_ids, ARRAY[]::text[]))
    ));
    v_log := COALESCE(v_booking->'activityLog', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'at', v_now,
        'message', 'Delivery photo added by ' || v_who
    ));

    v_booking := v_booking || jsonb_build_object('deliveryPhotos', v_photos, 'activityLog', v_log);

    v_data := jsonb_set(
        v_data,
        '{stallingService,bookings}',
        jsonb_set(v_bookings, ARRAY[v_index::text], v_booking, false),
        true
    );

    UPDATE public.projects SET project_data = v_data WHERE id = p_show_id;

    RETURN jsonb_build_object('photoCount', jsonb_array_length(v_photos));
END;
$$;

REVOKE ALL ON FUNCTION public.add_delivery_photo(uuid, text, text, text[], text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_delivery_photo(uuid, text, text, text[], text, text) TO anon, authenticated;
