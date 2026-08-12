-- Public access to score-sheet QR records, one at a time instead of the lot.
--
-- score_sheet_qr_codes is read straight from the browser by /s/:id,
-- /s/:id/results and /event-results/:id, none of which need a login. Verified
-- against production: an anonymous request with no filter returned 200 rows
-- (the cap I asked for, not the total) — show names, judge names, and a link to
-- every completed scored sheet, including shows the office had never published.
--
-- RLS cannot say "only if you filter by id", so the page has to stop reading the
-- table directly. These two functions give it exactly what it draws:
--
--   get_score_sheet_qr(id)              one record
--   list_posted_score_sheets(project)   the posted sheets for one show
--
-- Both apply the publish rule themselves, so it holds even when someone calls
-- the API directly rather than using the page.
--
-- Stage A: functions only. Nothing calls them yet, no policy changes.

-- Shared publish rule, matching src/lib/showPublishing.js.
CREATE OR REPLACE FUNCTION public.show_results_published(p_project_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(bool_or(
        lower(COALESCE(p.status, '')) IN ('published', 'final', 'publication')
        OR p.project_data->'moduleStatuses'->>'results' = 'published'
    ), false)
    FROM public.projects p
    WHERE p_project_id IS NOT NULL
      AND p.id::text = p_project_id;
$$;

REVOKE ALL ON FUNCTION public.show_results_published(text) FROM PUBLIC;

-- ── One QR record ───────────────────────────────────────────────────────────
-- Returns the whole row so the print/rebuild code keeps working, minus the
-- poster's account id and email, which nothing on the page displays.
--
-- The completed-sheet fields are held back until the show is published. The page
-- already hid the button; the link itself was still in the payload, so anyone
-- reading the response saw it anyway.
--
-- Signed-in users always see everything, so the office can check its own work
-- before publishing — the same rule /s/:id already applies.
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

    IF NOT (v_published OR auth.uid() IS NOT NULL) THEN
        v_out := v_out - 'posted_sheet_url' - 'posted_sheet_path' - 'posted_at' - 'posted_by_name';
    END IF;

    RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_score_sheet_qr(uuid) TO anon, authenticated;

-- ── The posted sheets for one show ──────────────────────────────────────────
-- Returns { published: bool, sheets: [...] } so the page can tell "not released
-- yet" apart from "released, nothing posted" without a second query.
--
-- Matching mirrors ShowResultsPage: by project_id first, then by show name,
-- because a show built as two records (housing + pattern book) can carry either
-- id on its QR rows.
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
        RETURN NULL;              -- show not found
    END IF;

    v_published := public.show_results_published(p_project_id::text);

    -- Signed-in staff can look before the office releases them.
    IF NOT (v_published OR auth.uid() IS NOT NULL) THEN
        RETURN jsonb_build_object('published', false, 'sheets', '[]'::jsonb);
    END IF;

    SELECT COALESCE(jsonb_agg(s ORDER BY s->>'class_name', s->>'division'), '[]'::jsonb)
      INTO v_sheets
      FROM (
        SELECT jsonb_build_object(
                   'id',             q.id,
                   'class_name',     q.class_name,
                   'division',       q.division,
                   'judge_name',     q.judge_name,
                   'show_date',      q.show_date,
                   'posted_sheet_url', q.posted_sheet_url,
                   'posted_at',      q.posted_at,
                   'posted_by_name', q.posted_by_name
               ) AS s
        FROM public.score_sheet_qr_codes q
        WHERE q.posted_sheet_url IS NOT NULL
          AND q.project_id::text = p_project_id::text
      ) byproject;

    -- Fall back to the show name when nothing carries this project id.
    IF jsonb_array_length(v_sheets) = 0 THEN
        SELECT COALESCE(jsonb_agg(s ORDER BY s->>'class_name', s->>'division'), '[]'::jsonb)
          INTO v_sheets
          FROM (
            SELECT jsonb_build_object(
                       'id',             q.id,
                       'class_name',     q.class_name,
                       'division',       q.division,
                       'judge_name',     q.judge_name,
                       'show_date',      q.show_date,
                       'posted_sheet_url', q.posted_sheet_url,
                       'posted_at',      q.posted_at,
                       'posted_by_name', q.posted_by_name
                   ) AS s
            FROM public.score_sheet_qr_codes q
            WHERE q.posted_sheet_url IS NOT NULL
              AND q.show_name = v_name
          ) byname;
    END IF;

    RETURN jsonb_build_object('published', v_published, 'sheets', v_sheets);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_posted_score_sheets(uuid) TO anon, authenticated;
