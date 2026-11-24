-- Scoring Portal: the horses on one judge's score sheet.
--
-- One row = one horse (one "work order") on one sheet. A sheet is one class + judge,
-- identified by sheet_key (the key built by src/lib/scoringClasses.js) inside a show.
--
--   work_order       1, 2, 3 ... in the order horses were added (shown as WO-001)
--   back_number      the exhibitor / back number written on the rider (text, e.g. "1001")
--   maneuver_scores  one entry per maneuver, null = not scored yet     (used from step 3c)
--   penalties        [{ "id", "name", "kind", "points", "count" }]      (used from step 3c)
--
-- For now only the show owner and admins can use it. Judge logins are still an open
-- question for Robert.
--
-- ids are plain text with no foreign key on purpose, like scoring_rules.

CREATE TABLE IF NOT EXISTS public.scoring_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id          text NOT NULL,
  sheet_key        text NOT NULL,
  work_order       integer NOT NULL,
  back_number      text NOT NULL,
  maneuver_scores  jsonb NOT NULL DEFAULT '[]'::jsonb,
  penalties        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scoring_entries_work_order_key UNIQUE (show_id, sheet_key, work_order),
  CONSTRAINT scoring_entries_back_number_key UNIQUE (show_id, sheet_key, back_number),
  CONSTRAINT scoring_entries_scores_is_array CHECK (jsonb_typeof(maneuver_scores) = 'array'),
  CONSTRAINT scoring_entries_penalties_is_array CHECK (jsonb_typeof(penalties) = 'array')
);

CREATE INDEX IF NOT EXISTS scoring_entries_sheet_idx ON public.scoring_entries (show_id, sheet_key);

ALTER TABLE public.scoring_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Show owners and admins manage scoring entries" ON public.scoring_entries;
CREATE POLICY "Show owners and admins manage scoring entries"
  ON public.scoring_entries FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = scoring_entries.show_id AND p.user_id::text = auth.uid()::text
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = scoring_entries.show_id AND p.user_id::text = auth.uid()::text
    )
  );

NOTIFY pgrst, 'reload schema';
