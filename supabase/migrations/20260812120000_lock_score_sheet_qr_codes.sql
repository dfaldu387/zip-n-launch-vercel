-- Close public.score_sheet_qr_codes.
--
-- It carried three policies, all of them wide open:
--
--   score_sheet_qr_codes_anon_insert  INSERT  public         WITH CHECK true
--   score_sheet_qr_codes_public_read  SELECT  public         USING true
--   authenticated can post scored sheet UPDATE authenticated USING true
--
-- So a signed-out visitor could list every row (verified on production: 200 rows,
-- 182 judge names, plus a link to each completed scored sheet — including shows
-- the office had never published) and could insert rows of their own. Any
-- logged-in account, meanwhile, could overwrite the posted sheet on ANY record,
-- for any show, replacing a judge's scored sheet with a file of their choosing.
--
-- /s/:id, /s/:id/results and /event-results/:id now read through
-- get_score_sheet_qr() and list_posted_score_sheets(), so nothing signed-out
-- needs the table.

-- Who may act on a show: its owner, an admin, or someone assigned to it as a
-- judge or staff member. SECURITY DEFINER so it runs outside RLS and cannot
-- re-enter the policy that calls it.
CREATE OR REPLACE FUNCTION public.can_manage_show(p_project_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p_project_id IS NOT NULL
          AND p.id::text = p_project_id
          AND (
                p.user_id = auth.uid()
             OR public.is_admin()
             OR public.can_read_assigned_project(p.id)
          )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_show(text) TO authenticated;

-- ── Read ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "score_sheet_qr_codes_public_read" ON public.score_sheet_qr_codes;

-- Signed-in people still read the table directly in the customer portal (the
-- pattern book dialog looks up the QR rows it just created), so authenticated
-- keeps its read. Anonymous visitors go through the two functions.
DROP POLICY IF EXISTS "Signed-in users can read score sheet QR codes" ON public.score_sheet_qr_codes;
CREATE POLICY "Signed-in users can read score sheet QR codes"
ON public.score_sheet_qr_codes FOR SELECT TO authenticated
USING (true);

-- ── Insert ──────────────────────────────────────────────────────────────────
-- QR rows are created while generating score sheets, which requires an account.
-- Ownership is deliberately NOT required: a pattern book links to a show project
-- its author may not own, and blocking that would break sheet generation.
DROP POLICY IF EXISTS "score_sheet_qr_codes_anon_insert" ON public.score_sheet_qr_codes;
DROP POLICY IF EXISTS "Signed-in users can create score sheet QR codes" ON public.score_sheet_qr_codes;
CREATE POLICY "Signed-in users can create score sheet QR codes"
ON public.score_sheet_qr_codes FOR INSERT TO authenticated
WITH CHECK (true);

-- ── Update ──────────────────────────────────────────────────────────────────
-- Posting a completed sheet is the show's own people: the organiser, an admin,
-- or an assigned judge or staff member. "Any logged-in account" was never the
-- intention — the page even says "Posting is staff-only" — it was just never
-- enforced anywhere.
--
-- Rows with no project attached keep the old rule, since there is no show to
-- check them against.
DROP POLICY IF EXISTS "authenticated can post scored sheet" ON public.score_sheet_qr_codes;
DROP POLICY IF EXISTS "Show people can post a scored sheet" ON public.score_sheet_qr_codes;
CREATE POLICY "Show people can post a scored sheet"
ON public.score_sheet_qr_codes FOR UPDATE TO authenticated
USING ( project_id IS NULL OR public.can_manage_show(project_id::text) )
WITH CHECK ( project_id IS NULL OR public.can_manage_show(project_id::text) );

-- To undo, if something signed-out turns out to still need the table:
--   CREATE POLICY "score_sheet_qr_codes_public_read"
--   ON public.score_sheet_qr_codes FOR SELECT TO public USING (true);
-- Prefer putting that page on get_score_sheet_qr() instead.
