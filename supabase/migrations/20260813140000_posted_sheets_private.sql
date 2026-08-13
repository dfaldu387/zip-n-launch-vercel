-- Recognise posted sheets that live in the private bucket.
--
-- Completed sheets used to be written to project_files, a PUBLIC bucket, so each
-- one became a permanent web address that opened for anyone with the link — no
-- account, no publish check. Hiding the button never touched the file.
--
-- New sheets now go to a separate private bucket and the row keeps only the
-- path; posted_sheet_url stays NULL. That null IS the flag:
--
--     posted_sheet_url set   → an older public sheet, served by that url
--     only posted_sheet_path → private, the page asks for a signed link
--
-- Nothing already stored is moved or rewritten, so every sheet posted before
-- this keeps working exactly as it does today.
--
-- These two functions only needed to stop treating posted_sheet_url as the test
-- for "has a sheet been posted", and to hand the path back so the page can sign
-- it.

CREATE OR REPLACE FUNCTION public.get_score_sheet_qr(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row       public.score_sheet_qr_codes%ROWTYPE;
    v_out       jsonb;
    v_published boolean;
BEGIN
    IF p_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_row FROM public.score_sheet_qr_codes WHERE id = p_id;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_out := to_jsonb(v_row) - 'posted_by' - 'posted_by_email';

    v_published := public.show_results_published(v_row.project_id::text);

    -- Until the show is published the public gets none of the completed-sheet
    -- fields — including the path, which is what a signed link is made from.
    IF NOT (v_published OR auth.uid() IS NOT NULL) THEN
        v_out := v_out - 'posted_sheet_url' - 'posted_sheet_path' - 'posted_at' - 'posted_by_name';
    END IF;

    RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_score_sheet_qr(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_posted_score_sheets(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name      text;
    v_published boolean;
    v_sheets    jsonb;
BEGIN
    IF p_project_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT p.project_name INTO v_name
      FROM public.projects p
     WHERE p.id = p_project_id;

    IF v_name IS NULL THEN
        RETURN NULL;
    END IF;

    v_published := public.show_results_published(p_project_id::text);

    IF NOT (v_published OR auth.uid() IS NOT NULL) THEN
        RETURN jsonb_build_object('published', false, 'sheets', '[]'::jsonb);
    END IF;

    -- "A sheet has been posted" is now url OR path, not url alone.
    SELECT COALESCE(jsonb_agg(s ORDER BY s->>'class_name', s->>'division'), '[]'::jsonb)
      INTO v_sheets
      FROM (
        SELECT jsonb_build_object(
                   'id',                q.id,
                   'class_name',        q.class_name,
                   'division',          q.division,
                   'judge_name',        q.judge_name,
                   'show_date',         q.show_date,
                   'posted_sheet_url',  q.posted_sheet_url,
                   'posted_sheet_path', q.posted_sheet_path,
                   'posted_at',         q.posted_at,
                   'posted_by_name',    q.posted_by_name
               ) AS s
        FROM public.score_sheet_qr_codes q
        WHERE (q.posted_sheet_url IS NOT NULL OR q.posted_sheet_path IS NOT NULL)
          AND q.project_id::text = p_project_id::text
      ) byproject;

    IF jsonb_array_length(v_sheets) = 0 THEN
        SELECT COALESCE(jsonb_agg(s ORDER BY s->>'class_name', s->>'division'), '[]'::jsonb)
          INTO v_sheets
          FROM (
            SELECT jsonb_build_object(
                       'id',                q.id,
                       'class_name',        q.class_name,
                       'division',          q.division,
                       'judge_name',        q.judge_name,
                       'show_date',         q.show_date,
                       'posted_sheet_url',  q.posted_sheet_url,
                       'posted_sheet_path', q.posted_sheet_path,
                       'posted_at',         q.posted_at,
                       'posted_by_name',    q.posted_by_name
                   ) AS s
            FROM public.score_sheet_qr_codes q
            WHERE (q.posted_sheet_url IS NOT NULL OR q.posted_sheet_path IS NOT NULL)
              AND q.show_name = v_name
          ) byname;
    END IF;

    RETURN jsonb_build_object('published', v_published, 'sheets', v_sheets);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_posted_score_sheets(uuid) TO anon, authenticated;
